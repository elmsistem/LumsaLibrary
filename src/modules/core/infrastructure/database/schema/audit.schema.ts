import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Tabla de Auditoría Inmutable del Sistema (Módulo 00).
 * Registra cada operación crítica (anulaciones, cierres de caja, ajustes de stock).
 */
export const systemAuditLogs = pgTable(
  "system_audit_logs",
  {
    id: uuid("id").primaryKey(),
    module: varchar("module", { length: 50 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    entityName: varchar("entity_name", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    userId: uuid("user_id"),
    payloadBefore: jsonb("payload_before"),
    payloadAfter: jsonb("payload_after"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_entity").on(table.entityName, table.entityId),
    index("idx_audit_created_at").on(table.createdAt),
  ]
);

export type SystemAuditLog = typeof systemAuditLogs.$inferSelect;
export type NewSystemAuditLog = typeof systemAuditLogs.$inferInsert;
