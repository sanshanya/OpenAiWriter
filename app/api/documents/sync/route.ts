// app/api/documents/sync/route.ts
import { NextResponse } from "next/server";

type ServerDoc = {
  id: string;
  title: string;
  content: string;            // JSON string
  version: number;
  updatedAt: number;
  deletedAt?: number | null;
};

// 模拟后端存储（内存态，开发期够用）
const store = new Map<string, ServerDoc>();

export async function POST(req: Request) {
  const body = await req.json();
  const docs = (body?.documents ?? []) as ServerDoc[];

  const synced: string[] = [];
  const conflicts: Array<{
    id: string;
    clientVersion: number;
    serverVersion: number;
    serverContent: string;
    serverDeletedAt?: number | null;
    serverUpdatedAt: number;
    serverTitle?: string;
  }> = [];

  for (const d of docs) {
    const srv = store.get(d.id);
    if (!srv) {
      store.set(d.id, d);
      synced.push(d.id);
      continue;
    }
    // 简单冲突策略：客户端版本 <= 服务器版本 → 冲突
    if ((d.version ?? 1) <= (srv.version ?? 1)) {
      conflicts.push({
        id: d.id,
        clientVersion: d.version ?? 1,
        serverVersion: srv.version ?? 1,
        serverContent: srv.content,
        serverDeletedAt: srv.deletedAt ?? null,
        serverUpdatedAt: srv.updatedAt,
        serverTitle: srv.title,
      });
      continue;
    }
    // 否则接受客户端版本
    store.set(d.id, d);
    synced.push(d.id);
  }

  // 模拟网络/处理耗时
  await new Promise((r) => setTimeout(r, 80));

  return NextResponse.json({ success: true, synced, conflicts });
}
