import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function sslOption() {
  if (process.env.DATABASE_SSL !== "true") return undefined;
  // Por defecto verifica el certificado. Solo con DATABASE_SSL_INSECURE=true se relaja (p. ej. algunos hosts gestionados).
  return { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" };
}

const globalForDb = globalThis as unknown as { pool?: Pool };
const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: sslOption(),
  });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;
// En producción también reutilizamos el pool si el módulo se evalúa más de una vez.
else globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export * from "./schema";
