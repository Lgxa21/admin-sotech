import { asc, eq, sql } from "drizzle-orm";
import { brandGuides, clients, db, studioBrandAssets } from "@/db";
import { getStudioUser, studioBrandHeaders, visibleStudioBrands } from "@/lib/studio-brands";
import type { StudioBrandAsset } from "@/lib/studio-brand-fields";

export async function GET() {
  const user = await getStudioUser();
  if (!user) return new Response(null, { status: 404, headers: studioBrandHeaders });

  const brands = await db.select({
    id: brandGuides.id, name: brandGuides.name, client: clients.name, isCompany: brandGuides.isCompany,
    colors: brandGuides.colors, shapes: brandGuides.shapes, typography: brandGuides.typography,
    logoRules: brandGuides.logoRules, notes: brandGuides.notes, studioShape: brandGuides.studioShape,
    hasManual: sql<boolean>`${brandGuides.fileName} is not null`,
    assets: sql<StudioBrandAsset[]>`array(select ${studioBrandAssets.kind} from ${studioBrandAssets} where ${studioBrandAssets.guideId} = ${brandGuides.id})`,
  }).from(brandGuides).innerJoin(clients, eq(brandGuides.clientId, clients.id))
    .where(visibleStudioBrands(user)).orderBy(asc(clients.name), asc(brandGuides.name));

  return Response.json({ brands }, { headers: studioBrandHeaders });
}
