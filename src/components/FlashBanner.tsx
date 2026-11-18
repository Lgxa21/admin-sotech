"use client";
import { useSearchParams } from "next/navigation";

/** Banner unificado para ?error= y ?ok= en la URL. */
export default function FlashBanner() {
  const sp = useSearchParams();
  const error = sp.get("error");
  const ok = sp.get("ok");
  if (error) return <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{error}</p>;
  if (ok) return <p role="status" className="card px-5 py-3 text-sm font-semibold text-ink bg-yellow/40">{ok}</p>;
  return null;
}
