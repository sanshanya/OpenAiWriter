"use client";

const ENABLE = process.env.NEXT_PUBLIC_ENABLE_SYNC === "true";

let loopTimer: number | null = null;

export function startSyncLoop(isLeader: () => boolean) {
  if (!ENABLE) return;
  if (loopTimer) return;
  const tick = async () => {
    try {
      if (isLeader() && navigator.onLine) {
        // 读取 outbox（你们已有 outbox.ts），做一次批处理：
        // 1) 取事件 → 合并/去重
        // 2) 发送 → ACK
        // 3) 压缩 outbox
        console.log("[SyncLoop] Tick: Leader is syncing...");
      }
    } catch {
      // 忽略一次错误，退避在 outbox/内部
    } finally {
      loopTimer = window.setTimeout(tick, 15000); // 低频后台
    }
  };
  loopTimer = window.setTimeout(tick, 15000);
}

export function stopSyncLoop() {
  if (loopTimer) window.clearTimeout(loopTimer);
  loopTimer = null;
}