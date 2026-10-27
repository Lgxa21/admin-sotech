// Sistema administrativo Sotech - Caracasprint
// Fase 1 (núcleo): usuarios y roles, clientes, órdenes, tareas, comentarios, historial y avisos.
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, numeric, jsonb, serial, index,
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

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("PRODUCCION"),
  area: text("area"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

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
  statusChangedAt: ts("status_changed_at").notNull().defaultNow(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("orders_status_idx").on(t.status), index("orders_client_idx").on(t.clientId), index("orders_owner_idx").on(t.ownerId)]);

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
  acceptedAt: ts("accepted_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("tasks_assignee_idx").on(t.assigneeId, t.status), index("tasks_order_idx").on(t.orderId)]);

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
  urgent: boolean("urgent").notNull().default(false),
  read: boolean("read").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.read, t.createdAt)]);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, { fields: [orders.clientId], references: [clients.id] }),
  owner: one(users, { fields: [orders.ownerId], references: [users.id] }),
  tasks: many(tasks),
  comments: many(comments),
  statusChanges: many(statusChanges),
}));
export const clientsRelations = relations(clients, ({ many }) => ({ orders: many(orders) }));
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
