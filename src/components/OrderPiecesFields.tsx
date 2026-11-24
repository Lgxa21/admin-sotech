"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MAX_PIECES, PIECE_UNITS, referenceUrl, type OrderPiece, type OrderReference } from "@/lib/order-pieces";

const browserId = () => crypto.randomUUID();

export function ReferenceField({ field, orderId, references }: { field: string; orderId?: string; references: OrderReference[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    const entries = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(entries);
    return () => entries.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [files]);

  function saveSelection(next: File[]) {
    if (!inputRef.current) return;
    const selection = new DataTransfer();
    next.forEach((file) => selection.items.add(file));
    inputRef.current.files = selection.files;
    setFiles(next);
  }

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    saveSelection([...files, ...Array.from(event.currentTarget.files ?? [])]);
  }

  return (
    <div className="grid gap-2">
      <div className="rounded-xl border border-dashed border-line bg-canvas/60 p-3">
        <button type="button" className="btn min-h-11 bg-paper" onClick={() => inputRef.current?.click()}>
          + Adjuntar fotos
        </button>
        <input ref={inputRef} name={`references:${field}`} type="file" accept="image/jpeg,image/png,image/webp" multiple
          onChange={selectImages} hidden />
        <p className="mt-2 text-xs text-muted">JPG, PNG o WebP · hasta 5 MB por foto y 15 MB en total</p>
      </div>
      {(previews.length > 0 || references.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {orderId && references.map((file) => (
            <li key={file.id} className="min-w-0 rounded-xl bg-canvas p-2">
              <a href={referenceUrl(orderId, file.id)} target="_blank" rel="noreferrer" className="grid gap-1">
                <img src={referenceUrl(orderId, file.id)} alt="" className="aspect-video w-full rounded-lg object-contain" />
                <span className="truncate text-xs font-semibold">{file.name}</span>
              </a>
              <label className="mt-1 flex gap-1 text-xs"><input type="checkbox" name="removeReference" value={file.id} /> Quitar al guardar</label>
            </li>
          ))}
          {previews.map((file, index) => (
            <li key={file.url} className="min-w-0 rounded-xl bg-canvas p-2">
              <img src={file.url} alt="" className="aspect-video w-full rounded-lg object-contain" />
              <p className="truncate text-xs">{file.name}</p>
              <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => saveSelection(files.filter((_, position) => position !== index))}
                aria-label={`Quitar ${file.name}`}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OrderPiecesFields({ initial, references, orderId }: { initial: OrderPiece[]; references: OrderReference[]; orderId?: string }) {
  const [pieces, setPieces] = useState<{ id: string; values?: OrderPiece }[]>(() => initial.map((piece) => ({ id: piece.id, values: piece })));
  return (
    <section className="card grid min-w-0 gap-3 p-3 sm:gap-4 sm:p-5" aria-labelledby="piece-heading">
      <div>
        <h2 id="piece-heading" className="h2">Piezas del pedido</h2>
        <p className="mt-1 text-sm text-muted">Agrega una ficha por cada pieza distinta. Si son iguales, indica la cantidad en una sola ficha.</p>
      </div>
      {pieces.map(({ id, values }, index) => (
        <PieceFields key={id} id={id} index={index} values={values} orderId={orderId}
          references={references.filter((file) => file.pieceId === id)}
          remove={() => setPieces((current) => current.filter((piece) => piece.id !== id))} />
      ))}
      {pieces.length < MAX_PIECES && <button type="button" className="btn w-fit"
        onClick={() => setPieces((current) => [...current, { id: browserId(), values: undefined }])}>
        + Agregar pieza
      </button>}
    </section>
  );
}

function PieceFields({ id, index, values, references, orderId, remove }: {
  id: string; index: number; values?: OrderPiece; references: OrderReference[]; orderId?: string; remove: () => void;
}) {
  const [hasDimensions, setHasDimensions] = useState(Boolean(values?.width || values?.height || values?.depth));
  const measureRefs = useRef<Partial<Record<"height" | "width" | "depth", HTMLInputElement>>>({});
  const [name, setName] = useState(values?.name ?? "");
  const [components, setComponents] = useState(() => (values?.components ?? []).map((value, key) => ({ key: String(key), value })));
  const key = (field: string) => `piece:${id}:${field}`;
  return (
    <fieldset className="m-0 min-w-0 w-full max-w-full rounded-2xl border border-line p-3 sm:p-4">
      <legend className="max-w-full break-all px-2 text-sm font-bold sm:text-base">Pieza {index + 1}{name && ` · ${name}`}</legend>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4">
        <input type="hidden" name="pieceId" value={id} />
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_7rem] sm:gap-3">
          <label className="grid gap-1 text-sm font-semibold">Nombre de la pieza
            <input className="input" name={key("name")} value={name} onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Ej. Mini-cabezal" required maxLength={120} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Cantidad
            <input className="input" name={key("quantity")} type="number" min={1} max={999999} defaultValue={values?.quantity ?? 1} required />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([["height", "Alto"], ["width", "Ancho"], ["depth", "Profundidad"]] as const).map(([field, label]) => (
            <label key={field} className="grid gap-1 text-sm font-semibold">{label}
              <input className="input min-w-0" name={key(field)} inputMode="decimal" pattern="[0-9]{1,8}([.,][0-9]{1,6})?"
                title="Escribe una medida como 1,25" defaultValue={values?.[field]}
                ref={(input) => { if (input) measureRefs.current[field] = input; }}
                onChange={() => setHasDimensions(Object.values(measureRefs.current).some((input) => input.value !== ""))} />
            </label>
          ))}
          <label className="grid gap-1 text-sm font-semibold">Unidad
            <select className="input" name={key("unit")} defaultValue={values?.width || values?.height || values?.depth ? values.unit : ""} required={hasDimensions}>
              <option value="">Elegir</option>
              {PIECE_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">Indicaciones para esta pieza
          <textarea className="input" name={key("instructions")} rows={2} maxLength={5000} defaultValue={values?.instructions}
            placeholder="Ej. Adaptar el exhibidor a cuatro niveles." />
        </label>
        <ReferenceField field={id} references={references} orderId={orderId} />
        <details open={values?.components.length || values?.material || values?.finish || values?.copy ? true : undefined} className="group rounded-xl border border-line">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
            Materiales, textos y partes <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="grid min-w-0 gap-3 px-3 pb-3">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <label className="grid gap-1 text-sm font-semibold">Material<input className="input" name={key("material")} maxLength={180} defaultValue={values?.material} /></label>
              <label className="grid gap-1 text-sm font-semibold">Acabado<input className="input" name={key("finish")} maxLength={180} defaultValue={values?.finish} /></label>
            </div>
            <label className="grid gap-1 text-sm font-semibold">Texto que debe aparecer<textarea className="input" name={key("copy")} maxLength={5000} rows={2} defaultValue={values?.copy} /></label>
            {components.map((part, position) => (
              <div key={part.key} className="flex items-end gap-2">
                <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">Parte {position + 1}
                  <input className="input" name={key("component")} maxLength={180} defaultValue={part.value} placeholder="Ej. Peldaño 1 · Milka" />
                </label>
                <button type="button" className="btn btn-sm" onClick={() => setComponents((current) => current.filter((item) => item.key !== part.key))}
                  aria-label={`Quitar parte ${position + 1}`}>Quitar</button>
              </div>
            ))}
            {components.length < 30 && <button type="button" className="btn btn-sm w-fit"
              onClick={() => setComponents((current) => [...current, { key: browserId(), value: "" }])}>+ Agregar parte</button>}
          </div>
        </details>
        <button type="button" className="min-h-11 w-fit text-sm font-semibold text-bad underline" onClick={() => {
          if (window.confirm(`¿Quitar la pieza ${index + 1} y sus referencias de esta orden?`)) remove();
        }}>Quitar pieza</button>
      </div>
    </fieldset>
  );
}
