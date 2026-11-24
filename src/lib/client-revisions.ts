import "server-only";
import { and, eq } from "drizzle-orm";
import { approvalLinks, comments, db, orders, statusChanges, tasks } from "@/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Order = typeof orders.$inferSelect;

export async function invalidateApprovalLinks(tx: Transaction, orderId: string) {
  await tx.update(approvalLinks).set({ status: "ANULADO" })
    .where(and(eq(approvalLinks.orderId, orderId), eq(approvalLinks.status, "PENDIENTE")));
}

// The caller locks the order before recording the decision for the current version.
export async function recordClientRevision(
  tx: Transaction,
  order: Order,
  actorId: string,
  description: string,
  requestedBy: string,
  now = new Date(),
) {
  const round = order.revisionRoundsUsed + 1;
  const title = `Cambios del cliente, ronda ${round}`;
  await tx.update(orders).set({ status: "AJUSTES", statusChangedAt: now, updatedAt: now, revisionRoundsUsed: round })
    .where(eq(orders.id, order.id));
  await invalidateApprovalLinks(tx, order.id);
  await tx.insert(statusChanges).values({
    orderId: order.id, from: order.status, to: "AJUSTES", userId: actorId, note: requestedBy,
  });
  await tx.insert(comments).values({
    orderId: order.id, authorId: actorId, kind: "cambio_cliente", body: `${requestedBy} (ronda ${round}):\n\n${description}`,
  });
  await tx.insert(tasks).values({
    orderId: order.id, title, notes: description, assigneeId: order.ownerId, createdById: actorId, status: "PENDIENTE",
  });
  return round;
}
