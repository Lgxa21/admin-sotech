"use client";
import { useEffect, useRef } from "react";
import { briefTemplate, isBriefTemplate } from "@/lib/briefs";

// Brief que se llena con las preguntas del servicio elegido, mientras no se haya escrito nada propio.
export default function BriefField({ serviceSelectId, defaultValue, id = "brief", name = "brief", rows = 9, required, placeholder }: {
  serviceSelectId: string; defaultValue?: string | null; id?: string; name?: string; rows?: number; required?: boolean; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const sel = document.getElementById(serviceSelectId) as HTMLSelectElement | null;
    const ta = ref.current;
    if (!sel || !ta) return;
    const fill = () => { if (isBriefTemplate(ta.value)) ta.value = briefTemplate(sel.value); };
    if (!defaultValue) fill();
    sel.addEventListener("change", fill);
    return () => sel.removeEventListener("change", fill);
  }, [serviceSelectId, defaultValue]);
  return <textarea ref={ref} id={id} name={name} rows={rows} required={required} defaultValue={defaultValue ?? ""} placeholder={placeholder} className="input" />;
}
