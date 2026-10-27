import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <main className="min-h-dvh grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="hidden md:flex flex-col justify-between bg-ink p-12 text-canvas">
        <Logo size={40} />
        <div className="grid gap-4">
          <p className="eyebrow !text-canvas/60">Sotech · Caracasprint</p>
          <p className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em]" style={{ fontStretch: "112%" }}>
            Cada orden, de la <span className="bg-cyan px-1.5 text-ink">idea</span> a la <span className="bg-magenta px-1.5">aprobación</span> y al <span className="bg-yellow px-1.5 text-ink">cobro</span>.
          </p>
        </div>
        <p className="text-sm text-canvas/60">Órdenes, tareas y clientes en un solo lugar.</p>
      </section>
      <section className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-sm grid gap-8">
          <div className="md:hidden"><Logo size={36} light={false} /></div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
