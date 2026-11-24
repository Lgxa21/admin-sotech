"use client";

import { useState } from "react";

export default function BrandColorsField({ initial }: { initial: string[] }) {
  const [colors, setColors] = useState(initial.join(", "));
  const [selected, setSelected] = useState("#6F2DA8");
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-semibold">Colores de marca
        <input name="colors" className="input" value={colors} onChange={(event) => setColors(event.currentTarget.value)}
          placeholder="#6F2DA8, #FFFFFF" maxLength={500} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" aria-label="Elegir color" className="h-11 w-12 rounded border border-line bg-paper p-1"
          value={selected} onChange={(event) => setSelected(event.currentTarget.value.toUpperCase())} />
        <button type="button" className="btn min-h-11" onClick={() => {
          const current = colors.split(/[\s,;]+/).filter(Boolean);
          if (current.length < 12 && !current.some((color) => color.toUpperCase() === selected)) {
            setColors([...current, selected].join(", "));
          }
        }}>Añadir color</button>
      </div>
    </div>
  );
}
