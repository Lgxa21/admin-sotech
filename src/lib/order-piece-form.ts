import "server-only";
import { imageType } from "./upload-types";
import { and, eq, inArray, isNotNull, notInArray, or } from "drizzle-orm";
import { db, orderReferences } from "@/db";
import { isUuid, str } from "./form";
import { MAX_IMAGE_BYTES, MAX_PIECES, MAX_UPLOAD_BYTES, PIECE_DIRECTIONS, PIECE_UNITS, type OrderPiece } from "./order-pieces";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reference = Omit<typeof orderReferences.$inferInsert, "orderId">;

export async function readOrderDetails(form: FormData) {
  const ids = form.getAll("pieceId").map(String);
  if (ids.length > MAX_PIECES || new Set(ids).size !== ids.length || ids.some((id) => !isUuid(id))) {
    throw new Error("Revisa la lista de piezas.");
  }

  const pieces = ids.map((id): OrderPiece => {
    const field = (name: string, limit: number) => str(form, `piece:${id}:${name}`, limit) ?? "";
    const name = field("name", 120);
    if (!name) throw new Error("Escribe un nombre para cada pieza.");
    const quantity = Number(field("quantity", 8));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999999) throw new Error(`Revisa la cantidad de «${name}».`);
    const unit = PIECE_UNITS.find((unit) => unit === field("unit", 4));
    const hasDimensions = ["width", "height", "depth"].some((key) => field(key, 20));
    if (hasDimensions && !unit) throw new Error(`Selecciona la unidad de «${name}».`);
    const dimension = (key: string) => {
      const value = field(key, 20);
      if (value && (!/^\d{1,8}(?:[.,]\d{1,6})?$/.test(value) || Number(value.replace(",", ".")) <= 0)) {
        throw new Error(`Usa medidas positivas en «${name}», por ejemplo 1,25.`);
      }
      return value;
    };
    return {
      id, name, quantity, unit: unit ?? "cm", width: dimension("width"), height: dimension("height"), depth: dimension("depth"),
      material: field("material", 180), finish: field("finish", 180),
      instructions: field("instructions", 5000),
      directions: Object.fromEntries(PIECE_DIRECTIONS.map(({ key }) => [key, field(`direction:${key}`, key === "design" ? 5000 : 600)])),
      copy: field("copy", 5000),
      components: form.getAll(`piece:${id}:component`).slice(0, 30).map((entry) => String(entry).trim().slice(0, 180)).filter(Boolean),
    };
  });

  const references: Reference[] = [];
  let total = 0;
  for (const pieceId of [null, ...ids]) {
    for (const file of form.getAll(`references:${pieceId ?? "order"}`)) {
      if (typeof file === "string" || !file.size) continue;
      total += file.size;
      if (file.size > MAX_IMAGE_BYTES || total > MAX_UPLOAD_BYTES) throw new Error("Las fotos deben pesar hasta 5 MB cada una y 15 MB en total por guardado.");
      if (references.length >= 30) throw new Error("Adjunta hasta 30 fotos por guardado.");
      const data = Buffer.from(await file.arrayBuffer());
      const contentType = imageType(data);
      if (!contentType) throw new Error(`«${file.name}» debe ser una imagen JPG, PNG o WebP.`);
      references.push({ pieceId, name: file.name.slice(0, 200), contentType, data });
    }
  }
  const removed = form.getAll("removeReference").map(String).filter(isUuid);
  return { pieces, references, removed };
}

export async function saveOrderReferences(tx: Transaction, orderId: string, details: Awaited<ReturnType<typeof readOrderDetails>>) {
  const ids = details.pieces.map(({ id }) => id);
  const removedPiece = ids.length
    ? and(isNotNull(orderReferences.pieceId), notInArray(orderReferences.pieceId, ids))
    : isNotNull(orderReferences.pieceId);
  await tx.delete(orderReferences).where(and(eq(orderReferences.orderId, orderId),
    or(removedPiece, details.removed.length ? inArray(orderReferences.id, details.removed) : undefined)));
  if (details.references.length) {
    await tx.insert(orderReferences).values(details.references.map((reference) => ({ ...reference, orderId })));
  }
}

export async function listOrderReferences(orderId: string) {
  return db.select({ id: orderReferences.id, name: orderReferences.name, pieceId: orderReferences.pieceId })
    .from(orderReferences).where(eq(orderReferences.orderId, orderId));
}
