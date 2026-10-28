export const DOC_CATEGORIES: Record<string, { label: string; hint: string; tone: string; moneyOnly?: boolean }> = {
  protocolo: { label: "Protocolo", hint: "Cómo y por dónde nos comunicamos", tone: "bg-yellow text-ink" },
  mensaje: { label: "Mensajes predefinidos", hint: "Textos listos para copiar y enviar al cliente", tone: "bg-cyan text-ink" },
  proceso: { label: "Procesos", hint: "Paso a paso de cómo trabajamos", tone: "bg-ink text-paper" },
  guia: { label: "Guía para nuevos", hint: "Lo que necesita saber quien llega", tone: "bg-ink/10 text-ink" },
  tarifas: { label: "Tarifas", hint: "Precios vigentes", tone: "bg-magenta text-white", moneyOnly: true },
};
