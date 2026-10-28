import { requireRole } from "@/lib/auth";
import { saveDoc } from "@/app/actions/docs";
import DocForm from "@/components/DocForm";

export const metadata = { title: "Nuevo documento" };

export default async function NewDoc() {
  await requireRole("DIRECCION", "ADMINISTRACION");
  return (
    <div className="grid gap-5">
      <h1 className="h1">Nuevo documento</h1>
      <DocForm action={saveDoc.bind(null, null)} cancelHref="/biblioteca" />
    </div>
  );
}
