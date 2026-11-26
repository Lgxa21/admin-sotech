import { and, eq } from "drizzle-orm";
import { brandGuides, clients, db, studioBrandAssets } from "@/db";
import { isUuid } from "@/lib/form";
import { getStudioUser, studioBrandHeaders, visibleStudioBrands } from "@/lib/studio-brands";
import { isStudioBrandAsset } from "@/lib/studio-brand-fields";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const user = await getStudioUser();
  const { id, kind } = await params;
  if (!user || !isUuid(id) || (kind !== "manual" && !isStudioBrandAsset(kind))) {
    return new Response(null, { status: 404, headers: studioBrandHeaders });
  }

  const where = and(eq(brandGuides.id, id), visibleStudioBrands(user));
  const [file] = kind === "manual"
    ? await db.select({ data: brandGuides.fileData, type: brandGuides.fileType, name: brandGuides.fileName })
        .from(brandGuides).innerJoin(clients, eq(brandGuides.clientId, clients.id)).where(where)
    : await db.select({ data: studioBrandAssets.data, type: studioBrandAssets.contentType, name: studioBrandAssets.name })
        .from(studioBrandAssets).innerJoin(brandGuides, eq(studioBrandAssets.guideId, brandGuides.id))
        .innerJoin(clients, eq(brandGuides.clientId, clients.id)).where(and(where, eq(studioBrandAssets.kind, kind)));
  if (!file?.data || !file.type) return new Response(null, { status: 404, headers: studioBrandHeaders });

  const headers = new Headers({ ...studioBrandHeaders, "Content-Type": file.type });
  if (kind === "manual" && file.name) {
    const filename = encodeURIComponent(file.name.toWellFormed()).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16)}`);
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
  }
  return new Response(new Uint8Array(file.data), { headers });
}
