import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card grid max-w-lg gap-4 px-6 py-8">
      <h1 className="h2">No encontramos esa página</h1>
      <p className="text-sm text-muted">Puede que el enlace esté vencido o que no tengas acceso.</p>
      <div><Link href="/" className="btn-primary">Volver a Hoy</Link></div>
    </div>
  );
}
