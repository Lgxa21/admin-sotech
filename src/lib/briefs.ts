// Preguntas del brief según el tipo de servicio. Se usan como punto de partida al crear una orden o un pedido.
const Q: Record<string, string[]> = {
  REDES_SOCIALES: ["Objetivo", "Mensaje principal", "Público", "Redes y formatos (post, historia, reel…)", "Cantidad de piezas", "Fechas de publicación", "Textos o copy", "Referencias"],
  DISENO_GRAFICO: ["Qué pieza se necesita", "Objetivo", "Medidas y formato", "Textos que lleva", "Logos y colores (manual de marca)", "Referencias", "Formato de entrega"],
  BRANDING: ["Nombre de la marca", "A qué se dedica", "Público", "Personalidad en 3 palabras", "Competencia", "Lo que le gusta y lo que no", "Entregables (logo, paleta, tipografías, manual)"],
  FOTO_VIDEO: ["Qué se va a fotografiar o grabar", "Objetivo y dónde se usará", "Lugar y fecha", "Cantidad de fotos o duración del video", "Formatos (vertical, horizontal)", "Guion, música o locución", "Referencias"],
  DESARROLLO_WEB: ["Tipo de sitio", "Secciones", "Funciones (formularios, tienda, blog…)", "Contenido disponible (textos, fotos)", "Dominio y hosting", "Referencias", "Fecha de lanzamiento"],
  EVENTOS_BTL: ["Tipo de evento o activación", "Fecha, hora y lugar", "Cantidad de asistentes", "Objetivo", "Materiales y montaje", "Proveedores", "Presupuesto disponible"],
  IMPRESION_POP: ["Pieza", "Medidas", "Cantidad", "Material y acabado", "¿El arte está listo o hay que diseñarlo?", "Fecha y lugar de entrega", "¿Lleva instalación?"],
  TRADE_MARKETING: ["Punto de venta o cadena", "Piezas (exhibidores, habladores, cenefas…)", "Medidas y cantidades", "Material", "Fecha de instalación", "Lineamientos de la marca o de la cadena"],
  OTRO: ["Qué se necesita", "Objetivo", "Fecha", "Referencias"],
};

export const briefTemplate = (service: string) => (Q[service] ?? Q.OTRO).map((q) => `${q}:\n`).join("\n");
export const isBriefTemplate = (text: string) => !text.trim() || Object.keys(Q).some((k) => text.trim() === briefTemplate(k).trim());

// Quita las preguntas que quedaron sin responder; si no queda nada, devuelve null.
export function cleanBrief(text: string | null | undefined) {
  if (!text) return null;
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b && !/^[^\n]{1,80}:$/.test(b));
  const out = blocks.join("\n\n").trim();
  return out || null;
}
