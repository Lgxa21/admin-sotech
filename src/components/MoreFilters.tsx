"use client";
import { useState } from "react";

// En el celular los filtros se pliegan; en pantallas grandes siempre se ven.
export default function MoreFilters({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(active);
  return (
    <>
      <div className={open ? "contents" : "hidden lg:contents"}>{children}</div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn lg:hidden" aria-expanded={open}>
        {open ? "Menos filtros" : "Más filtros"}
      </button>
    </>
  );
}
