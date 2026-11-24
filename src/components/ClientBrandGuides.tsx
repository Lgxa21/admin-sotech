import { saveBrandGuide } from "@/app/actions/brand-guides";
import type { BrandGuide } from "@/lib/brand-guides";
import BrandManualField from "./BrandManualField";
import BrandColorsField from "./BrandColorsField";
import SubmitButton from "./SubmitButton";

export default function ClientBrandGuides({ clientId, guides, previousUrl }: {
  clientId: string; guides: BrandGuide[]; previousUrl?: string | null;
}) {
  const company = guides.find((guide) => guide.isCompany);
  const brands = guides.filter((guide) => !guide.isCompany);
  return (
    <section id="marcas" aria-labelledby="marcas-title" className="card grid min-w-0 scroll-mt-24 gap-4 p-4 sm:p-6">
      <h2 id="marcas-title" className="h2">Marcas y manuales</h2>
      {previousUrl && /^https?:\/\//i.test(previousUrl) && (
        <a href={previousUrl} target="_blank" rel="noreferrer" className="w-fit text-sm font-semibold underline">
          Abrir enlace al manual de la empresa
        </a>
      )}
      {company ? <GuideCard clientId={clientId} guide={company} /> : (
        <details className="rounded-xl border border-line px-3">
          <summary className="cursor-pointer py-3 text-sm font-bold">+ Agregar manual de la empresa</summary>
          <GuideForm clientId={clientId} isCompany />
        </details>
      )}
      <div className="grid gap-3">
        <h3 className="text-base font-bold">Submarcas y marcas distribuidas</h3>
        {brands.map((guide) => <GuideCard key={guide.id} clientId={clientId} guide={guide} />)}
        <details className="rounded-xl border border-line px-3">
          <summary className="cursor-pointer py-3 text-sm font-bold">+ Agregar marca</summary>
          <GuideForm clientId={clientId} isCompany={false} />
        </details>
      </div>
    </section>
  );
}

function GuideCard({ clientId, guide }: { clientId: string; guide: BrandGuide }) {
  const rules = [
    ["Formas y esquinas", guide.shapes],
    ["Tipografías", guide.typography],
    ["Uso del logo", guide.logoRules],
    ["Otras reglas", guide.notes],
  ];
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border border-line p-3 sm:p-4">
      {guide.isCompany && <p className="label m-0">Manual de la empresa</p>}
      <h3 className="break-words font-bold">{guide.name}</h3>
      {guide.fileName && (
        <a href={`/clientes/${clientId}/marcas/${guide.id}/archivo`} className="w-fit break-all text-sm font-semibold underline">
          Descargar {guide.fileName}
        </a>
      )}
      {guide.colors.length > 0 && (
        <ul aria-label="Colores de marca" className="flex flex-wrap gap-2">
          {guide.colors.map((color) => (
            <li key={color} className="flex items-center gap-1.5 rounded-lg bg-canvas px-2 py-1 text-xs font-mono">
              <span aria-hidden="true" className="h-4 w-4 rounded border border-line" style={{ backgroundColor: color }} />{color}
            </li>
          ))}
        </ul>
      )}
      <dl className="grid gap-2 sm:grid-cols-2">
        {rules.filter(([, value]) => value).map(([label, value]) => (
          <div key={label ?? ""}><dt className="label">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm">{value}</dd></div>
        ))}
      </dl>
      <details className="border-t border-line">
        <summary className="cursor-pointer py-3 text-sm font-semibold underline">Editar manual</summary>
        <GuideForm clientId={clientId} isCompany={guide.isCompany} guide={guide} />
      </details>
    </article>
  );
}

function GuideForm({ clientId, isCompany, guide }: { clientId: string; isCompany: boolean; guide?: BrandGuide }) {
  return (
    <form className="order-form grid min-w-0 gap-3 pb-3" action={saveBrandGuide.bind(null, clientId, guide?.id ?? null, isCompany)}>
      {!isCompany && <label className="grid gap-1 text-sm font-semibold">Nombre de la marca
        <input name="name" className="input" required maxLength={120} defaultValue={guide?.name} placeholder="Ej. Milka" />
      </label>}
      <BrandManualField replacing={Boolean(guide?.fileName)} />
      {guide?.fileName && <label className="flex gap-2 text-sm"><input name="removeManual" type="checkbox" /> Quitar el archivo al guardar</label>}
      <BrandColorsField initial={guide?.colors ?? []} />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Formas y esquinas
          <textarea className="input" name="shapes" rows={2} maxLength={1000} defaultValue={guide?.shapes ?? ""}
            placeholder="Ej. Bordes redondeados y curvas suaves" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Tipografías
          <textarea className="input" name="typography" rows={2} maxLength={1000} defaultValue={guide?.typography ?? ""}
            placeholder="Ej. Montserrat para títulos" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Uso del logo
          <textarea className="input" name="logoRules" rows={2} maxLength={2000} defaultValue={guide?.logoRules ?? ""}
            placeholder="Ej. Usar la versión blanca sobre fondo oscuro" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Otras reglas
          <textarea className="input" name="notes" rows={2} maxLength={3000} defaultValue={guide?.notes ?? ""}
            placeholder="Ej. Evitar degradados" />
        </label>
      </div>
      <div><SubmitButton pendingLabel="Guardando…">Guardar manual</SubmitButton></div>
    </form>
  );
}
