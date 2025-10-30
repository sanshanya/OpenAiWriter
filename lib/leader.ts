"use client";

/**
 * Leader Election（健壮版）
 *
 * 优先使用 navigator.locks（浏览器原子锁，自动释放）。
 * 回退方案：BroadcastChannel + localStorage 基于“短租约”的乐观并发 CAS。
 *
 * 对外 API：
 *   const isLeader = initializeLeaderElection(); // 返回 () => boolean
 *   // 可选：订阅变更
 *   const off = subscribeLeaderChange((v) => { console.log("leader?", v) });
 *   // 需要停止（单测或卸载）：
 *   teardownLeaderElection();
 */

const LOCK_NAME = "aiwriter-leader-lock";
const BC_NAME = "aiwriter-leader";
const BC_STATUS = "aiwriter-leader-status";
const LS_KEY = "aiwriter:leader:lease"; // 回退方案用：{ leaderId, leaseUntil }

type LeaderLease = { leaderId: string; leaseUntil: number };

// --------- 内部可观测状态 ----------
let _isLeader = false;
let _stopped = false;
const _leaderId = randomId();
const _leaseMs = 5000; // 回退方案租约时长
const _renewIntervalMs = 1500; // 回退方案续约频率
let _bc: BroadcastChannel | null = null;
let _bcStatus: BroadcastChannel | null = null;
let _renewTimer: number | null = null;
let _locksRunning = false;   // 标记 locks.request 正在持有回调

// 事件订阅（给外部快速响应）
type Listener = (isLeader: boolean) => void;
const listeners = new Set<Listener>();
function emitChange() {
  for (const fn of listeners) {
    try { fn(_isLeader); } catch {}
  }
  // 广播“领导变更”（让其他标签更快检测到）
  _bcStatus?.postMessage({ type: "leader-changed", leader: _isLeader ? _leaderId : null });
}
export function subscribeLeaderChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 供外部使用：返回当前是否为 Leader
let amILeader = () => _isLeader;

// --------- 工具 ----------
function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function now() {
  return Date.now();
}

type NavigatorLocks = Navigator & {
  locks?: {
    request(name: string, callback: () => Promise<void> | void): Promise<void>;
  };
};

function getLocksApi(): NavigatorLocks["locks"] | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as NavigatorLocks;
  return nav.locks ?? null;
}

// --------- navigator.locks 路径 ----------
async function runWithLock() {
  if (_stopped) return;

  // 防并发重入保护
  if (_locksRunning) return;
  _locksRunning = true;

  try {
    // 说明：不使用 ifAvailable，而是直接请求锁。
    // 若已有持有者，回调会排队等待；持有者关闭页面后浏览器会自动释放并唤醒下一个。
    // 这样可以自然实现“卸任→继任”的队列语义，避免双主。
    const locks = getLocksApi();
    if (!locks) return;
    await locks.request(LOCK_NAME, async () => {
      if (_stopped) return;

      // 成功获得锁，成为 Leader
      _isLeader = true;
      emitChange();

      // 在持有期间周期性广播心跳（便于观测，并让回退方案也能感知）
      startHeartbeats();

      // 持有到页面卸载或主动 teardown。返回前不要结束 Promise。
      await new Promise<void>((resolve) => {
        // 当 stop() 被调用时，结束回调、释放锁
        const off = subscribeLeaderChange((v) => {
          if (!v && _stopped) {
            off();
            resolve();
          }
        });
      });

      stopHeartbeats();
      // 离开锁区域：此时浏览器会释放锁，队列中的下一位会被唤醒
    });
  } catch (e) {
    // 某些环境可能抛错：忽略并回退
    console.warn("[Leader] locks.request error, falling back", e);
  } finally {
    _locksRunning = false;
  }
}

// 心跳（仅用于观测/兼容回退，并非选主所必需）
let _hbTimer: number | null = null;
function startHeartbeats() {
  stopHeartbeats();
  _hbTimer = window.setInterval(() => {
    _bc?.postMessage({ type: "heartbeat", t: now(), leaderId: _leaderId });
  }, 1000);
}
function stopHeartbeats() {
  if (_hbTimer) {
    clearInterval(_hbTimer);
    _hbTimer = null;
  }
}

// --------- 回退路径：BroadcastChannel + localStorage（带租约） ----------
function readLease(): LeaderLease | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj as LeaderLease;
  } catch {
    return null;
  }
}
function writeLease(x: LeaderLease) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(x));
  } catch {}
}

function tryAcquireLease(): boolean {
  const nowTs = now();
  const cur = readLease();
  if (!cur || cur.leaseUntil <= nowTs) {
    // 租约过期或不存在 → 抢占
    writeLease({ leaderId: _leaderId, leaseUntil: nowTs + _leaseMs });
    // 双检，确认写入仍有效（防极小概率竞态）
    const check = readLease();
    if (check && check.leaderId === _leaderId) {
      return true;
    }
  }
  return cur?.leaderId === _leaderId && cur.leaseUntil > nowTs;
}

function renewLeaseIfLeader() {
  if (!_isLeader) return;
  const cur = readLease();
  if (!cur || cur.leaderId !== _leaderId) {
    // 被外部改写或丢失 → 立即降级，等待下一轮抢占
    becomeFollower();
    return;
  }
  writeLease({ leaderId: _leaderId, leaseUntil: now() + _leaseMs });
}

function becomeLeaderFallback() {
  if (_isLeader) return;
  if (tryAcquireLease()) {
    _isLeader = true;
    emitChange();
  }
}

function becomeFollower() {
  if (!_isLeader) return;
  _isLeader = false;
  emitChange();
}

function startFallbackLoop() {
  stopFallbackLoop();

  // 初始尝试争抢
  becomeLeaderFallback();

  _renewTimer = window.setInterval(() => {
    if (_stopped) return;

    const lease = readLease();
    const nowTs = now();

    // 1) 若自己是 leader，定期续约
    if (_isLeader) {
      renewLeaseIfLeader();
      return;
    }

    // 2) 不是 leader：若租约已过期，尝试抢占
    if (!lease || lease.leaseUntil <= nowTs) {
      becomeLeaderFallback();
    }
  }, _renewIntervalMs);
}

function stopFallbackLoop() {
  if (_renewTimer) {
    clearInterval(_renewTimer);
    _renewTimer = null;
  }
}

// --------- BroadcastChannel 事件（两路通道：心跳&状态改变） ----------
function setupBroadcastChannels() {
  teardownBroadcastChannels();

  _bc = new BroadcastChannel(BC_NAME);
  _bc.onmessage = (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "heartbeat") {
      // 仅观测用途；在 locks 路径下，这不是选主依据
      // 在回退路径下，可据此调整租约策略（这里保持简单：不处理）
      // console.debug("[Leader] heartbeat from", msg.leaderId);
    }
  };

  _bcStatus = new BroadcastChannel(BC_STATUS);
  _bcStatus.onmessage = (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== "object") return;

    // 其他标签发来的“leader-changed”通知：加快本地感知
    if (msg.type === "leader-changed") {
      // 在 locks 路径下，无需动作；在回退路径下，可触发一次快速争抢
      if (!getLocksApi()) {
        // 快速检查是否需要抢占（例如对方卸任）
        const lease = readLease();
        if (!lease || lease.leaseUntil <= now()) {
          becomeLeaderFallback();
        }
      }
    }
  };
}

function teardownBroadcastChannels() {
  if (_bc) {
    _bc.close();
    _bc = null;
  }
  if (_bcStatus) {
    _bcStatus.close();
    _bcStatus = null;
  }
}

// --------- 页面可见性：不影响锁，但可用于降低无主状态时的抢占噪声 ----------
function setupVisibilityHooks() {
  const onHide = () => {
    // 可选：页面隐藏时在回退模式降低争抢频率或主动放弃租约
    // 这里保持中性行为：不自动放弃，避免频繁主从切换
  };
  const onShow = () => {
    // 可选：页面回来后快速确认主从地位
    if (!getLocksApi()) {
      const lease = readLease();
      if (!lease || lease.leaseUntil <= now()) {
        becomeLeaderFallback();
      }
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
    else onShow();
  });
}

// --------- Public API ----------
export function initializeLeaderElection(): () => boolean {
  if (_stopped) _stopped = false;

  setupBroadcastChannels();
  setupVisibilityHooks();

  // 优先硬锁
  if (getLocksApi()) {
    // 启动即进入锁队列；只有持有期间才是 leader
    runWithLock();
  } else {
    // 回退方案：租约 + 续约
    startFallbackLoop();
  }

  // 页面卸载/关闭时清理（locks 会自动释放；我们只需停止本地计时器&广播）
  window.addEventListener("pagehide", teardownLeaderElection);
  window.addEventListener("beforeunload", teardownLeaderElection);

  amILeader = () => _isLeader;
  return amILeader;
}

export function teardownLeaderElection() {
  if (_stopped) return;
  _stopped = true;

  // 结束回退循环
  stopFallbackLoop();

  // 停止心跳
  stopHeartbeats();

  // 关闭广播通道
  teardownBroadcastChannels();

  // 通知监听者（多用于测试环境）
  if (_isLeader) {
    _isLeader = false;
    emitChange();
  }
}
