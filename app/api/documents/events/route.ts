// app/api/documents/events/route.ts
import { NextResponse } from "next/server";

type ServerDoc = {
  id: string;
  title: string;
  content: string;            // JSON string
  version: number;
  updatedAt: number;
  deletedAt?: number | null;
};

// 简易内存存储（开发期）
const store = new Map<string, ServerDoc>();

export async function POST(req: Request) {
  const body = await req.json();
  const events = (body?.events ?? []) as Array<{
    id: string;
    docId: string;
    kind: "create" | "update" | "delete";
    version: number;
    updatedAt: number;
    deletedAt?: number | null;
    content?: string;
    idempotencyKey: string;
  }>;

  const ackedVersions: Record<string, number> = {};
  const acceptedIds: string[] = [];
  const conflicts: Array<{
    id: string;
    clientVersion: number;
    serverVersion: number;
    serverContent: string;
    serverDeletedAt?: number | null;
    serverUpdatedAt: number;
    serverTitle?: string;
  }> = [];

  for (const ev of events) {
    const cur = store.get(ev.docId);
    const curV = cur?.version ?? 0;

    if (ev.version <= curV) {
      // 幂等/冲突：<= 当前版本的事件视为重复或冲突
      if (ev.version < curV) {
        // 真冲突：客户端比服务器旧
        if (cur) {
          conflicts.push({
            id: ev.docId,
            clientVersion: ev.version,
            serverVersion: cur.version,
            serverContent: cur.content,
            serverDeletedAt: cur.deletedAt ?? null,
            serverUpdatedAt: cur.updatedAt,
            serverTitle: cur.title,
          });
        }
      }
      // 无论如何，最高确认版本还是 curV
      ackedVersions[ev.docId] = Math.max(ackedVersions[ev.docId] ?? 0, curV);
      continue;
    }

    // 接受新版本
    const next: ServerDoc = {
      id: ev.docId,
      title: cur?.title ?? "", // 事件可以不带 title，这里用现有的；若带了就覆盖
      content: cur?.content ?? "[]",
      version: ev.version,
      updatedAt: ev.updatedAt,
      deletedAt: ev.deletedAt ?? null,
    };
    if (ev.kind !== "delete" && typeof ev.content === "string") {
      next.content = ev.content;
    }
    // 如果希望事件里能携带 title，可在前端 outbox 里加上，后端这里覆盖
    store.set(ev.docId, next);

    ackedVersions[ev.docId] = Math.max(ackedVersions[ev.docId] ?? 0, ev.version);
    acceptedIds.push(ev.id);
  }

  // 模拟耗时
  await new Promise((r) => setTimeout(r, 50));

  return NextResponse.json({ success: true, ackedVersions, acceptedIds, conflicts });
}
