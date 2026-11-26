import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { brandGuides, db, studioBrandAssets } from "@/db";

export async function listBrandGuides(clientId: string) {
  const guides = await db.select({
    id: brandGuides.id, name: brandGuides.name, isCompany: brandGuides.isCompany,
    colors: brandGuides.colors, shapes: brandGuides.shapes, typography: brandGuides.typography,
    logoRules: brandGuides.logoRules, notes: brandGuides.notes, fileName: brandGuides.fileName, studioShape: brandGuides.studioShape,
  }).from(brandGuides).where(eq(brandGuides.clientId, clientId)).orderBy(desc(brandGuides.isCompany), asc(brandGuides.name));
  if (!guides.length) return [];
  const assets = await db.select({ guideId: studioBrandAssets.guideId, kind: studioBrandAssets.kind, name: studioBrandAssets.name })
    .from(studioBrandAssets).where(inArray(studioBrandAssets.guideId, guides.map(({ id }) => id)));
  return guides.map((guide) => ({ ...guide, studioAssets: assets.filter(({ guideId }) => guideId === guide.id) }));
}

export type BrandGuide = Awaited<ReturnType<typeof listBrandGuides>>[number];
