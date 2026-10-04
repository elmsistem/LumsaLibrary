import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "../env/env.schema";
import * as auditSchema from "./schema/audit.schema";

export const schema = {
  ...auditSchema,
};

export type AppDatabase = NodePgDatabase<typeof schema>;

let poolInstance: Pool | null = null;
let dbInstance: AppDatabase | null = null;

/**
 * Retorna el pool de conexiones a PostgreSQL.
 * Se inicializa bajo demanda para no bloquear builds estáticos de Next.js.
 */
export function getDbPool(): Pool {
  if (!poolInstance) {
    const env = getEnv();
    poolInstance = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]: Error inesperado en conexión inactiva:", err);
    });
  }
  return poolInstance;
}

/**
 * Retorna la instancia tipada de Drizzle ORM conectada a PostgreSQL.
 */
export function getDb(): AppDatabase {
  if (!dbInstance) {
    const pool = getDbPool();
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}
