"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { brandGuides, clients, db, studioBrandAssets } from "@/db";
import { requireRole } from "@/lib/auth";
import { fail, isUuid, ok, str } from "@/lib/form";
import { imageType } from "@/lib/upload-types";
import { isStudioBrandAsset, STUDIO_BRAND_ASSETS, STUDIO_SHAPES, type StudioBrandAsset, type StudioShape } from "@/lib/studio-brand-fields";

function fontType(data: Buffer) {
  const signature = data.toString("ascii", 0, 4);
  if (signature === "wOF2") return "font/woff2";
  if (signature === "wOFF") return "font/woff";
  if (signature === "OTTO") return "font/otf";
  if (data.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0]))) return "font/ttf";
  return null;
}

export async function saveBrandGuide(clientId: string, guideId: string | null, isCompany: boolean, form: FormData) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const path = `/clientes/${clientId}#marcas`;
  if (!isUuid(clientId) || (guideId && !isUuid(guideId))) fail("/clientes", "Revisa la empresa o la marca.");
  const client = await db.query.clients.findFirst({ columns: { name: true }, where: eq(clients.id, clientId) });
  if (!client) fail("/clientes", "La empresa ya no está disponible.");
  const name = isCompany ? client.name : str(form, "name", 120);
  if (!name) fail(path, "Escribe el nombre de la marca.");
  const colors = (str(form, "colors", 500) ?? "").split(/[\s,;]+/).filter(Boolean);
  if (colors.length > 12 || colors.some((color) => !/^#[a-f\d]{6}$/i.test(color))) {
    fail(path, "Usa hasta 12 colores en formato HEX, por ejemplo #6F2DA8.");
  }
  const studioShape = str(form, "studioShape") ?? "none";
  if (!Object.hasOwn(STUDIO_SHAPES, studioShape)) fail(path, "Selecciona una figura válida para Content Studio.");
  const fields = {
    name, colors: [...new Set(colors.map((color) => color.toUpperCase()))],
    shapes: str(form, "shapes", 1000), typography: str(form, "typography", 1000),
    logoRules: str(form, "logoRules", 2000), notes: str(form, "notes", 3000), studioShape: studioShape as StudioShape,
  };
  const file = form.get("manual");
  let attachment: Pick<typeof brandGuides.$inferInsert, "fileName" | "fileType" | "fileData"> = {};
  if (file instanceof File && file.size) {
    if (file.size > 10 * 1024 * 1024) fail(path, "El manual puede pesar hasta 10 MB.");
    const data = Buffer.from(await file.arrayBuffer());
    const type = data.toString("ascii", 0, 5) === "%PDF-" ? "application/pdf" : imageType(data);
    if (!type) fail(path, "Adjunta un manual en PDF, JPG, PNG o WebP.");
    attachment = { fileName: file.name.slice(0, 200), fileType: type, fileData: data };
  } else if (form.get("removeManual") === "on") {
    attachment = { fileName: null, fileType: null, fileData: null };
  }
  const uploads: Omit<typeof studioBrandAssets.$inferInsert, "guideId">[] = [];
  const removals: StudioBrandAsset[] = [];
  for (const kind of Object.keys(STUDIO_BRAND_ASSETS).filter(isStudioBrandAsset)) {
    const asset = form.get(`studio-${kind}`);
    const { label, font } = STUDIO_BRAND_ASSETS[kind];
    if (asset instanceof File && asset.size) {
      const maxMb = font ? 1 : 2;
      if (asset.size > maxMb * 1024 * 1024) fail(path, `${label} puede pesar hasta ${maxMb} MB.`);
      const data = Buffer.from(await asset.arrayBuffer());
      const contentType = font ? fontType(data) : imageType(data);
      if (!contentType) fail(path, `${label}: usa un archivo ${font ? "WOFF2, WOFF, OTF o TTF" : "PNG, JPG o WebP"}.`);
      uploads.push({ kind, name: asset.name.slice(0, 200), contentType, data });
    } else if (form.get(`remove-studio-${kind}`) === "on") {
      removals.push(kind);
    }
  }

  await db.transaction(async (tx) => {
    const [saved] = guideId
      ? await tx.update(brandGuides).set({ ...fields, ...attachment })
          .where(and(eq(brandGuides.id, guideId), eq(brandGuides.clientId, clientId), eq(brandGuides.isCompany, isCompany)))
          .returning({ id: brandGuides.id })
      : await tx.insert(brandGuides).values({ clientId, isCompany, ...fields, ...attachment })
          .onConflictDoNothing().returning({ id: brandGuides.id });
    if (!saved) fail(path, guideId ? "La ficha de marca ya no está disponible." : isCompany ? "El manual de la empresa ya existe. Abre su ficha para editarlo." : "Ya existe una marca con ese nombre.");
    for (const upload of uploads) {
      await tx.insert(studioBrandAssets).values({ guideId: saved.id, ...upload })
        .onConflictDoUpdate({ target: [studioBrandAssets.guideId, studioBrandAssets.kind], set: upload });
    }
    for (const kind of removals) {
      await tx.delete(studioBrandAssets).where(and(eq(studioBrandAssets.guideId, saved.id), eq(studioBrandAssets.kind, kind)));
    }
  }).catch((error: { cause?: { code?: string } }) => {
    if (error.cause?.code === "23505") fail(path, "Ya existe una marca con ese nombre.");
    throw error;
  });
  revalidatePath(`/clientes/${clientId}`);
  ok(path, "Manual de marca guardado.");
}
