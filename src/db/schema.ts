// Sistema administrativo Sotech - Caracasprint
// Fase 1 (núcleo): usuarios y roles, clientes, órdenes, tareas, comentarios, historial y avisos.
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, numeric, jsonb, serial, index, date, uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["DIRECCION", "ADMINISTRACION", "PRODUCCION", "FREELANCER"]);
export const orderStatusEnum = pgEnum("order_status", [
  "RECIBIDO", "BRIEF_REVISION", "EN_PRODUCCION", "REVISION_INTERNA", "ENVIADO_CLIENTE",
  "AJUSTES", "APROBADO", "ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES",
]);
export const serviceEnum = pgEnum("service_type", [
  "REDES_SOCIALES", "DISENO_GRAFICO", "BRANDING", "FOTO_VIDEO", "DESARROLLO_WEB",
  "EVENTOS_BTL", "IMPRESION_POP", "TRADE_MARKETING", "OTRO",
]);
export const priorityEnum = pgEnum("priority", ["BAJA", "MEDIA", "ALTA", "URGENTE"]);
export const currencyEnum = pgEnum("currency", ["USD", "VES"]);
export const taskStatusEnum = pgEnum("task_status", ["POR_ACEPTAR", "PENDIENTE", "EN_CURSO", "LISTA"]);
export const costKindEnum = pgEnum("cost_kind", ["PROVEEDOR", "GASTO"]);
export const costStatusEnum = pgEnum("cost_status", ["PENDIENTE", "PAGADO"]);
export const quoteStatusEnum = pgEnum("quote_status", ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA"]);
export const approvalStatusEnum = pgEnum("approval_status", ["PENDIENTE", "APROBADO", "CAMBIOS", "ANULADO"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("PRODUCCION"),
  area: text("area"),
  phone: text("phone"), // WhatsApp, formato internacional: 584121234567
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyWhatsapp: boolean("notify_whatsapp").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Dispositivos donde la persona activó las notificaciones de la app.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("push_user_idx").on(t.userId)]);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  taxId: text("tax_id"),
  brandManualUrl: text("brand_manual_url"),
  socialNotes: text("social_notes"),
  contractNotes: text("contract_notes"),
  renewalDate: ts("renewal_date"),
  notes: text("notes"),
  requestToken: text("request_token").unique(),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: serial("number").notNull().unique(),
  title: text("title").notNull(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  serviceType: serviceEnum("service_type").notNull(),
  status: orderStatusEnum("status").notNull().default("RECIBIDO"),
  priority: priorityEnum("priority").notNull().default("MEDIA"),
  brief: text("brief"),
  copy: text("copy"),
  platform: text("platform"),
  formats: text("formats"),
  referenceLinks: text("reference_links"),
  requestedAt: ts("requested_at").notNull().defaultNow(),
  dueDate: ts("due_date"),
  ownerId: uuid("owner_id").references(() => users.id),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  budget: numeric("budget", { precision: 12, scale: 2 }),
  currency: currencyEnum("currency").notNull().default("USD"),
  revisionRoundsIncluded: integer("revision_rounds_included").notNull().default(2),
  revisionRoundsUsed: integer("revision_rounds_used").notNull().default(0),
  invoiceNumber: text("invoice_number"),
  internalNotes: text("internal_notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  retainerId: uuid("retainer_id"),
  period: text("period"), // "2026-11" para la orden mensual de una iguala
  source: text("source").notNull().default("interno"), // interno | cliente | cotizacion | iguala
  statusChangedAt: ts("status_changed_at").notNull().defaultNow(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [
  index("orders_status_idx").on(t.status), index("orders_client_idx").on(t.clientId), index("orders_owner_idx").on(t.ownerId),
  uniqueIndex("orders_retainer_period_idx").on(t.retainerId, t.period),
]);

export type ChecklistItem = { text: string; done: boolean };

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  assigneeId: uuid("assignee_id").references(() => users.id),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  status: taskStatusEnum("status").notNull().default("PENDIENTE"),
  dueDate: ts("due_date"),
  checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
  publishAt: ts("publish_at"), // fecha de publicación programada (calendario de contenidos)
  channel: text("channel"), // red o medio donde se publica: Instagram, TikTok…
  acceptedAt: ts("accepted_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("tasks_assignee_idx").on(t.assigneeId, t.status), index("tasks_order_idx").on(t.orderId), index("tasks_publish_idx").on(t.publishAt)]);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("comentario"), // comentario | cambio_cliente | urgencia
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("comments_order_idx").on(t.orderId, t.createdAt)]);

export const statusChanges = pgTable("status_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  from: orderStatusEnum("from_status"),
  to: orderStatusEnum("to_status").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  note: text("note"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("status_changes_order_idx").on(t.orderId, t.createdAt)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  kind: text("kind").notNull().default("general"), // tarea | mencion | urgencia | cliente | estado | finanzas | general
  urgent: boolean("urgent").notNull().default(false),
  read: boolean("read").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.read, t.createdAt)]);

// ---------- Dinero ----------
// Tasa del día: bolívares por 1 USD. Cada movimiento guarda la tasa con la que se registró.
export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  day: date("day").notNull().unique(),
  rate: numeric("rate", { precision: 16, scale: 4 }).notNull(),
  source: text("source"),
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("PROVEEDOR"), // FREELANCER | PROVEEDOR
  userId: uuid("user_id").references(() => users.id),
  contact: text("contact"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Cobros: dinero que entra de un cliente, asociado a una orden cuando se puede.
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull(),
  rate: numeric("rate", { precision: 16, scale: 4 }),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  paidOn: date("paid_on").notNull(),
  notes: text("notes"),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("payments_order_idx").on(t.orderId), index("payments_client_idx").on(t.clientId), index("payments_day_idx").on(t.paidOn)]);

// Costos de una orden: pagos a proveedores o freelancers, y gastos (pauta, impresión…).
export const costs = pgTable("costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  kind: costKindEnum("kind").notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  concept: text("concept").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull(),
  rate: numeric("rate", { precision: 16, scale: 4 }),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  status: costStatusEnum("status").notNull().default("PENDIENTE"),
  paidOn: date("paid_on"),
  method: text("method"),
  reference: text("reference"),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("costs_order_idx").on(t.orderId), index("costs_status_idx").on(t.status)]);

// ---------- Cotizaciones ----------
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: serial("number").notNull().unique(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  status: quoteStatusEnum("status").notNull().default("BORRADOR"),
  currency: currencyEnum("currency").notNull().default("USD"),
  validUntil: date("valid_until"),
  notes: text("notes"),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const quoteItems = pgTable("quote_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  position: integer("position").notNull().default(0),
});

// ---------- Igualas ----------
export type RetainerItem = { title: string; qty: number };
export const retainers = pgTable("retainers", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  serviceType: serviceEnum("service_type").notNull().default("REDES_SOCIALES"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("USD"),
  items: jsonb("items").$type<RetainerItem[]>().notNull().default([]),
  ownerId: uuid("owner_id").references(() => users.id),
  dueDay: integer("due_day").notNull().default(28),
  revisionRounds: integer("revision_rounds").notNull().default(2),
  startPeriod: text("start_period").notNull(), // "2026-11"
  endPeriod: text("end_period"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------- Enlace de aprobación para el cliente ----------
export const approvalLinks = pgTable("approval_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  pieceUrl: text("piece_url"),
  message: text("message"),
  round: integer("round").notNull().default(1),
  status: approvalStatusEnum("status").notNull().default("PENDIENTE"),
  clientName: text("client_name"),
  clientComment: text("client_comment"),
  respondedAt: ts("responded_at"),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("approval_links_order_idx").on(t.orderId)]);

// ---------- Biblioteca interna ----------
export const docs = pgTable("docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull().default("proceso"), // protocolo | proceso | mensaje | tarifas | guia
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  position: integer("position").notNull().default(0),
  updatedById: uuid("updated_by_id").references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("docs_category_idx").on(t.category, t.position)]);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, { fields: [orders.clientId], references: [clients.id] }),
  owner: one(users, { fields: [orders.ownerId], references: [users.id] }),
  tasks: many(tasks),
  comments: many(comments),
  statusChanges: many(statusChanges),
  payments: many(payments),
  costs: many(costs),
  approvalLinks: many(approvalLinks),
}));
export const clientsRelations = relations(clients, ({ many }) => ({ orders: many(orders), quotes: many(quotes), retainers: many(retainers), payments: many(payments) }));
export const tasksRelations = relations(tasks, ({ one }) => ({
  order: one(orders, { fields: [tasks.orderId], references: [orders.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
}));
export const commentsRelations = relations(comments, ({ one }) => ({
  order: one(orders, { fields: [comments.orderId], references: [orders.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));
export const statusChangesRelations = relations(statusChanges, ({ one }) => ({
  order: one(orders, { fields: [statusChanges.orderId], references: [orders.id] }),
  user: one(users, { fields: [statusChanges.userId], references: [users.id] }),
}));
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  order: one(orders, { fields: [notifications.orderId], references: [orders.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  client: one(clients, { fields: [payments.clientId], references: [clients.id] }),
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  createdBy: one(users, { fields: [payments.createdById], references: [users.id] }),
}));
export const costsRelations = relations(costs, ({ one }) => ({
  order: one(orders, { fields: [costs.orderId], references: [orders.id] }),
  supplier: one(suppliers, { fields: [costs.supplierId], references: [suppliers.id] }),
}));
export const suppliersRelations = relations(suppliers, ({ many }) => ({ costs: many(costs) }));
export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, { fields: [quotes.clientId], references: [clients.id] }),
  order: one(orders, { fields: [quotes.orderId], references: [orders.id] }),
  items: many(quoteItems),
}));
export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
}));
export const retainersRelations = relations(retainers, ({ one }) => ({
  client: one(clients, { fields: [retainers.clientId], references: [clients.id] }),
  owner: one(users, { fields: [retainers.ownerId], references: [users.id] }),
}));
export const approvalLinksRelations = relations(approvalLinks, ({ one }) => ({
  order: one(orders, { fields: [approvalLinks.orderId], references: [orders.id] }),
  createdBy: one(users, { fields: [approvalLinks.createdById], references: [users.id] }),
}));
