import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-10 w-10" />
          <div>
            <p className="font-display text-lg font-bold leading-tight">Sotech</p>
            <p className="text-sm text-muted">Órdenes, tareas y clientes</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
