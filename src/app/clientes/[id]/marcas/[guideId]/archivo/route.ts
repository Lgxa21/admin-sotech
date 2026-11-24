import { and, eq } from "drizzle-orm";
import { brandGuides, db } from "@/db";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/form";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; guideId: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const { id, guideId } = await params;
  if (!isUuid(id) || !isUuid(guideId)) return new Response(null, { status: 404 });
  const [file] = await db.select({ data: brandGuides.fileData, name: brandGuides.fileName, type: brandGuides.fileType })
    .from(brandGuides).where(and(eq(brandGuides.id, guideId), eq(brandGuides.clientId, id)));
  if (!file?.data || !file.name || !file.type) return new Response(null, { status: 404 });
  const filename = encodeURIComponent(file.name.toWellFormed()).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16)}`);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
