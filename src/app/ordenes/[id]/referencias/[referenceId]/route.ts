import { and, eq } from "drizzle-orm";
import { db, orderReferences } from "@/db";
import { canAccessOrder } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/form";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; referenceId: string }> }) {
  const { id, referenceId } = await params;
  const user = await requireUser();
  if (!isUuid(id) || !isUuid(referenceId) || !(await canAccessOrder(user, id))) return new Response(null, { status: 404 });

  const [reference] = await db.select({ data: orderReferences.data, contentType: orderReferences.contentType })
    .from(orderReferences).where(and(eq(orderReferences.orderId, id), eq(orderReferences.id, referenceId)));
  if (!reference) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(reference.data), {
    headers: { "Content-Type": reference.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
