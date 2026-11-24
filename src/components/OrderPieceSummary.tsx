import { PIECE_DIRECTIONS, referenceUrl, type OrderPiece, type OrderReference } from "@/lib/order-pieces";

export function ReferenceGallery({ orderId, references }: { orderId: string; references: OrderReference[] }) {
  if (!references.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {references.map((file) => (
        <li key={file.id} className="min-w-0">
          <a className="grid gap-1 rounded-xl bg-canvas p-2" href={referenceUrl(orderId, file.id)} target="_blank" rel="noreferrer">
            <img src={referenceUrl(orderId, file.id)} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-contain" />
            <span className="truncate text-xs font-semibold" title={file.name}>{file.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function OrderPieceSummary({ orderId, pieces, references }: { orderId: string; pieces: OrderPiece[]; references: OrderReference[] }) {
  if (!pieces.length) return null;
  return (
    <section className="card grid gap-4 px-6 py-6" aria-labelledby="order-pieces">
      <h2 id="order-pieces" className="h2">Piezas del pedido</h2>
      {pieces.map((piece) => {
        const specs = [
          ["Alto", piece.height && `${piece.height} ${piece.unit}`],
          ["Ancho", piece.width && `${piece.width} ${piece.unit}`],
          ["Profundidad", piece.depth && `${piece.depth} ${piece.unit}`],
          ["Material", piece.material],
          ["Acabado", piece.finish],
        ].filter(([, value]) => value);
        return (
          <article key={piece.id} className="grid min-w-0 gap-3 rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="break-words text-base font-bold">{piece.name}</h3>
              <span className="text-sm text-muted">Cantidad {piece.quantity}</span>
            </div>
            {specs.length > 0 && (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}
              </dl>
            )}
            {PIECE_DIRECTIONS.map(({ key, label }) => {
              const value = piece.directions?.[key] || (key === "design" ? piece.instructions : undefined);
              return value && <div key={key}><h4 className="label">{label}</h4><p className="whitespace-pre-wrap break-words text-sm">{value}</p></div>;
            })}
            {piece.components.length > 0 && (
              <div><h4 className="label">Partes</h4><ol className="list-inside list-decimal text-sm">
                {piece.components.map((item, index) => <li key={index} className="break-words">{item}</li>)}
              </ol></div>
            )}
            {piece.copy && <div><h4 className="label">Texto que debe aparecer</h4><p className="whitespace-pre-wrap break-words text-sm">{piece.copy}</p></div>}
            <ReferenceGallery orderId={orderId} references={references.filter((file) => file.pieceId === piece.id)} />
          </article>
        );
      })}
    </section>
  );
}
