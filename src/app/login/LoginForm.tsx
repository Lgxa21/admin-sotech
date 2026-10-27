"use client";
import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action} className="grid gap-5">
      <h1 className="h1">Entrar</h1>
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="text-sm font-semibold text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary py-3 text-[15px]" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
