import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { brandGuides, db } from "@/db";

export async function listBrandGuides(clientId: string) {
  return db.select({
    id: brandGuides.id, name: brandGuides.name, isCompany: brandGuides.isCompany,
    colors: brandGuides.colors, shapes: brandGuides.shapes, typography: brandGuides.typography,
    logoRules: brandGuides.logoRules, notes: brandGuides.notes, fileName: brandGuides.fileName,
  }).from(brandGuides).where(eq(brandGuides.clientId, clientId)).orderBy(desc(brandGuides.isCompany), asc(brandGuides.name));
}

export type BrandGuide = Awaited<ReturnType<typeof listBrandGuides>>[number];
