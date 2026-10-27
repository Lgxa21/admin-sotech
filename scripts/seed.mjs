// Crea la cuenta inicial de dirección si no hay usuarios.
// Con SEED_DEMO=1 agrega además datos de ejemplo (marcados como "ejemplo") para probar el sistema.
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
const q = (text, params) => pool.query(text, params);

const { rows: [{ n }] } = await q("select count(*)::int as n from users");
if (n === 0) {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Sin usuarios: define ADMIN_EMAIL y ADMIN_PASSWORD para crear la cuenta inicial.");
  } else {
    await q("insert into users (name, email, password_hash, role) values ($1, $2, $3, 'DIRECCION')",
      [process.env.ADMIN_NAME || "Dirección", email, await bcrypt.hash(password, 10)]);
    console.log(`Cuenta inicial creada: ${email}`);
  }
}

if (process.env.SEED_DEMO === "1") {
  const { rows: [{ c }] } = await q("select count(*)::int as c from clients");
  if (c > 0) {
    console.log("Ya hay clientes: no se agregan datos de ejemplo.");
  } else {
    const hash = await bcrypt.hash("ejemplo123", 10);
    const team = [
      ["Ana (ejemplo)", "ana@ejemplo.test", "ADMINISTRACION", "Administración"],
      ["Carlos (ejemplo)", "carlos@ejemplo.test", "PRODUCCION", "Diseño"],
      ["María (ejemplo)", "maria@ejemplo.test", "PRODUCCION", "Redes sociales"],
      ["Luis (ejemplo)", "luis@ejemplo.test", "PRODUCCION", "Foto y video"],
      ["Pedro (ejemplo)", "pedro@ejemplo.test", "FREELANCER", "Motion"],
    ];
    const ids = {};
    for (const [name, email, role, area] of team) {
      const { rows: [r] } = await q("insert into users (name, email, password_hash, role, area) values ($1,$2,$3,$4,$5) on conflict (email) do update set name = excluded.name returning id", [name, email, hash, role, area]);
      ids[email.split("@")[0]] = r.id;
    }
    const { rows: [admin] } = await q("select id from users where role = 'DIRECCION' order by created_at limit 1");
    const cl = {};
    for (const [key, name, contact] of [["cafe", "Café Ávila (ejemplo)", "Gabriela Rojas"], ["farma", "Farmacia Central (ejemplo)", "José Pérez"], ["moda", "Tienda Lirio (ejemplo)", "Valentina Díaz"]]) {
      const { rows: [r] } = await q("insert into clients (name, contact_name, contract_notes) values ($1,$2,$3) returning id", [name, contact, "Iguala mensual de ejemplo: 12 posts y 8 historias, 2 rondas de cambios."]);
      cl[key] = r.id;
    }
    const day = (d) => new Date(Date.now() + d * 864e5);
    const orders = [
      ["12 posts de noviembre", "cafe", "REDES_SOCIALES", "EN_PRODUCCION", "MEDIA", 5, "maria", 450, true],
      ["Banner para la feria", "farma", "IMPRESION_POP", "REVISION_INTERNA", "ALTA", 2, "carlos", 180, false],
      ["Video de lanzamiento", "moda", "FOTO_VIDEO", "ENVIADO_CLIENTE", "ALTA", 1, "luis", 900, false],
      ["Rediseño de menú", "cafe", "DISENO_GRAFICO", "AJUSTES", "MEDIA", -1, "carlos", 120, false],
      ["Campaña Black Friday", "moda", "REDES_SOCIALES", "BRIEF_REVISION", "URGENTE", 6, "maria", 600, false],
      ["Material POP para farmacia", "farma", "TRADE_MARKETING", "RECIBIDO", "BAJA", 12, null, 350, false],
      ["Sesión de fotos de producto", "moda", "FOTO_VIDEO", "ENTREGADO", "MEDIA", -4, "luis", 300, false],
    ];
    for (const [title, ck, service, status, priority, due, owner, budget, rec] of orders) {
      const { rows: [o] } = await q(
        `insert into orders (title, client_id, service_type, status, priority, due_date, owner_id, created_by_id, budget, currency, is_recurring, brief, status_changed_at, revision_rounds_used)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'USD',$10,$11,$12,$13) returning id`,
        [title, cl[ck], service, status, priority, day(due), owner ? ids[owner] : null, admin.id, budget, rec,
          "Pedido de ejemplo para probar el sistema. Bórralo cuando empieces con datos reales.", day(status === "EN_PRODUCCION" ? -5 : -1), status === "AJUSTES" ? 1 : 0]);
      await q("insert into status_changes (order_id, from_status, to_status, user_id, note) values ($1, null, 'RECIBIDO', $2, 'Orden creada')", [o.id, admin.id]);
      if (owner) {
        await q("insert into tasks (order_id, title, assignee_id, created_by_id, status, due_date, checklist) values ($1,$2,$3,$4,$5,$6,$7)",
          [o.id, `Producción: ${title.toLowerCase()}`, ids[owner], admin.id, status === "ENTREGADO" ? "LISTA" : "EN_CURSO", day(due - 1),
            JSON.stringify([{ text: "Primera versión", done: true }, { text: "Ajustes internos", done: false }, { text: "Exportar formatos", done: false }])]);
      }
      if (title === "Video de lanzamiento") {
        await q("insert into tasks (order_id, title, assignee_id, created_by_id, status, due_date) values ($1,$2,$3,$4,'POR_ACEPTAR',$5)",
          [o.id, "Animación del logo para el cierre", ids.pedro, admin.id, day(0)]);
        await q("insert into comments (order_id, author_id, body) values ($1,$2,$3)", [o.id, ids.luis, "Subí la versión 1 al Drive. @Pedro ¿puedes con la animación del cierre para mañana?"]);
      }
    }
    console.log("Datos de ejemplo creados. Contraseña de las cuentas de ejemplo: ejemplo123");
  }
}

await pool.end();
