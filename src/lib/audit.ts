import "server-only";
import { db, auditEvents } from "@/db";

export async function audit(
  kind: string,
  opts: { actorId?: string | null; entityType?: string; entityId?: string; detail?: Record<string, unknown> } = {},
) {
  await db.insert(auditEvents).values({
    kind,
    actorId: opts.actorId ?? null,
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
    detail: opts.detail ?? {},
  });
}
