"use client";
import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "@/app/actions/notifications";

type State = "cargando" | "no-soportado" | "ios-instalar" | "bloqueado" | "activo" | "inactivo" | "sin-configurar";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Activa las notificaciones de la app en este dispositivo.
export default function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("cargando");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!publicKey) return setState("sin-configurar");
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(ios && !standalone ? "ios-instalar" : "no-soportado");
      if (Notification.permission === "denied") return setState("bloqueado");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "activo" : "inactivo");
    })().catch(() => setState("no-soportado"));
  }, [publicKey]);

  const enable = async () => {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "bloqueado" : "inactivo"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey!) });
      const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
      setState(r.ok ? "activo" : "inactivo");
      setMsg(r.ok ? "Listo: este dispositivo recibirá los avisos." : "No se pudo guardar. Intenta de nuevo.");
    } catch { setMsg("No se pudo activar en este navegador."); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("inactivo");
    } finally { setBusy(false); }
  };

  const text: Record<State, string> = {
    "cargando": "Revisando este dispositivo…",
    "no-soportado": "Este navegador no admite notificaciones.",
    "ios-instalar": "En iPhone, primero instala la app: en Safari toca Compartir y luego “Agregar a inicio”. Ábrela desde el ícono y vuelve aquí.",
    "bloqueado": "Bloqueaste las notificaciones para este sitio. Permítelas en los ajustes del navegador y recarga la página.",
    "activo": "Este dispositivo recibe los avisos.",
    "inactivo": "Este dispositivo todavía no recibe avisos.",
    "sin-configurar": "Las notificaciones al celular aún no están configuradas en el servidor.",
  };

  return (
    <div className="grid gap-3 rounded-2xl bg-canvas p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${state === "activo" ? "bg-cyan" : state === "bloqueado" ? "bg-magenta" : "bg-ink/25"}`} aria-hidden="true" />
        {text[state]}
      </p>
      {state === "inactivo" && <div><button type="button" disabled={busy} onClick={enable} className="btn-primary">{busy ? "Activando…" : "Activar en este dispositivo"}</button></div>}
      {state === "activo" && <div><button type="button" disabled={busy} onClick={disable} className="btn btn-sm">Desactivar en este dispositivo</button></div>}
      {msg && <p className="text-sm" role="status">{msg}</p>}
    </div>
  );
}
