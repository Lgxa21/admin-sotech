// Textos y orden de las etapas, servicios y prioridades tal como los definió el cliente.
export const STATUSES = [
  "RECIBIDO", "BRIEF_REVISION", "EN_PRODUCCION", "REVISION_INTERNA", "ENVIADO_CLIENTE",
  "AJUSTES", "APROBADO", "ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  RECIBIDO: "Recibido",
  BRIEF_REVISION: "Brief en revisión",
  EN_PRODUCCION: "En producción",
  REVISION_INTERNA: "Revisión interna",
  ENVIADO_CLIENTE: "Enviado al cliente",
  AJUSTES: "Ajustes",
  APROBADO: "Aprobado",
  ENTREGADO: "Publicado / entregado",
  FACTURADO: "Facturado",
  PAGO_PROVEEDORES: "Pago a proveedores",
};

// Color por grupo de etapas: entrada, producción, cliente, cierre.
export const STATUS_TONE: Record<Status, string> = {
  RECIBIDO: "bg-muted/15 text-muted",
  BRIEF_REVISION: "bg-muted/15 text-muted",
  EN_PRODUCCION: "bg-accent/15 text-accent",
  REVISION_INTERNA: "bg-accent/15 text-accent",
  ENVIADO_CLIENTE: "bg-warn/15 text-warn",
  AJUSTES: "bg-warn/15 text-warn",
  APROBADO: "bg-good/15 text-good",
  ENTREGADO: "bg-good/15 text-good",
  FACTURADO: "bg-good/15 text-good",
  PAGO_PROVEEDORES: "bg-ink/10 text-ink",
};

export const SERVICES = [
  "REDES_SOCIALES", "DISENO_GRAFICO", "BRANDING", "FOTO_VIDEO", "DESARROLLO_WEB",
  "EVENTOS_BTL", "IMPRESION_POP", "TRADE_MARKETING", "OTRO",
] as const;
export type Service = (typeof SERVICES)[number];
export const SERVICE_LABEL: Record<Service, string> = {
  REDES_SOCIALES: "Redes sociales",
  DISENO_GRAFICO: "Diseño gráfico",
  BRANDING: "Branding",
  FOTO_VIDEO: "Foto y video",
  DESARROLLO_WEB: "Desarrollo web",
  EVENTOS_BTL: "Eventos y BTL",
  IMPRESION_POP: "Impresión / POP",
  TRADE_MARKETING: "Trade marketing",
  OTRO: "Otro",
};

export const PRIORITIES = ["BAJA", "MEDIA", "ALTA", "URGENTE"] as const;
export type PriorityT = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<PriorityT, string> = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", URGENTE: "Urgente" };
export const PRIORITY_TONE: Record<PriorityT, string> = {
  BAJA: "text-muted", MEDIA: "text-ink", ALTA: "text-warn", URGENTE: "text-bad font-semibold",
};

export const TASK_STATUSES = ["POR_ACEPTAR", "PENDIENTE", "EN_CURSO", "LISTA"] as const;
export type TaskStatusT = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatusT, string> = {
  POR_ACEPTAR: "Por aceptar", PENDIENTE: "Pendiente", EN_CURSO: "En curso", LISTA: "Lista",
};

export const ROLES = ["DIRECCION", "ADMINISTRACION", "PRODUCCION", "FREELANCER"] as const;
export type RoleT = (typeof ROLES)[number];
export const ROLE_LABEL: Record<RoleT, string> = {
  DIRECCION: "Dirección", ADMINISTRACION: "Administración", PRODUCCION: "Producción", FREELANCER: "Freelancer",
};

export const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("es-VE", { day: "2-digit", month: "short", timeZone: "America/Caracas" }) : "—";
export const fmtDateTime = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Caracas" }) : "—";
export const fmtMoney = (v: string | number | null | undefined, cur: "USD" | "VES") =>
  v == null || v === "" ? "—" : (cur === "USD" ? "US$ " : "Bs. ") + Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// yyyy-mm-dd para inputs type=date, en hora de Caracas
export const toInputDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Caracas" }) : "";
export const fromInputDate = (s: FormDataEntryValue | null) => {
  const v = typeof s === "string" ? s.trim() : "";
  return v ? new Date(`${v}T18:00:00-04:00`) : null; // fin del día laboral en Caracas
};
