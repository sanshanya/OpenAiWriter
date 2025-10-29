// app/_bootstrap/SyncBootstrap.tsx
"use client";

import * as React from "react";
import { initializeLeaderElection, teardownLeaderElection } from "@/lib/leader";
import { startSyncLoop, stopSyncLoop } from "@/lib/sync-loop";

export function SyncBootstrap() {
  React.useEffect(() => {
    // 1) 仅在浏览器且开启开关时运行
    if (typeof window === "undefined") return;
    if (process.env.NEXT_PUBLIC_ENABLE_SYNC !== "true") return;

    // 2) 初始化选主，并把 isLeader 函数交给同步循环
    const isLeader = initializeLeaderElection();
    startSyncLoop(isLeader);

    // 3) 清理：避免 StrictMode 下的双挂载造成重复循环/定时器泄露
    return () => {
      stopSyncLoop();
      teardownLeaderElection();
    };
  }, []);

  return null; // 这是个“副作用组件”，不渲染 UI
}
