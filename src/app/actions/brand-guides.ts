"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { brandGuides, clients, db } from "@/db";
import { requireRole } from "@/lib/auth";
import { fail, isUuid, ok, str } from "@/lib/form";
import { imageType } from "@/lib/upload-types";

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
  const fields = {
    name, colors: [...new Set(colors.map((color) => color.toUpperCase()))],
    shapes: str(form, "shapes", 1000), typography: str(form, "typography", 1000),
    logoRules: str(form, "logoRules", 2000), notes: str(form, "notes", 3000),
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
  if (guideId) {
    const [saved] = await db.update(brandGuides).set({ ...fields, ...attachment })
      .where(and(eq(brandGuides.id, guideId), eq(brandGuides.clientId, clientId), eq(brandGuides.isCompany, isCompany)))
      .returning({ id: brandGuides.id }).catch((error: { cause?: { code?: string } }) => {
        if (error.cause?.code === "23505") fail(path, "Ya existe una marca con ese nombre.");
        throw error;
      });
    if (!saved) fail(path, "La ficha de marca ya no está disponible.");
  } else {
    const [saved] = await db.insert(brandGuides).values({ clientId, isCompany, ...fields, ...attachment })
      .onConflictDoNothing().returning({ id: brandGuides.id });
    if (!saved) fail(path, isCompany ? "El manual de la empresa ya existe. Abre su ficha para editarlo." : "Ya existe una marca con ese nombre.");
  }
  revalidatePath(`/clientes/${clientId}`);
  ok(path, "Manual de marca guardado.");
}
