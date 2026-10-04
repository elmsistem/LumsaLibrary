import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { products } from "../../../../catalog/infrastructure/database/schema/catalog.schema";

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type_enum", [
  "PURCHASE_ENTRY",
  "SALE_EXIT",
  "INTERNAL_DAMAGE",
  "PHYSICAL_COUNT_ADJUSTMENT",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "WAREHOUSE_TRANSFER",
]);

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  address: text("address"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Libro Mayor Inmutable de Movimientos de Inventario (Kardex).
 * PROHIBIDO realizar UPDATE o DELETE sobre esta tabla.
 */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),
    quantityUnits: numeric("quantity_units", { precision: 12, scale: 4 }).notNull(),
    unitCostCents: integer("unit_cost_cents").notNull(),
    averageCostCents: integer("average_cost_cents").notNull(),
    balanceUnits: numeric("balance_units", { precision: 12, scale: 4 }).notNull(),
    referenceId: uuid("reference_id"),
    referenceCode: varchar("reference_code", { length: 100 }),
    notes: text("notes"),
    userId: uuid("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_kardex_product_wh").on(table.productId, table.warehouseId),
    index("idx_kardex_created_at").on(table.createdAt),
  ]
);

/**
 * Snapshot de balance actual para alto rendimiento en lecturas de mostrador y bloqueos FOR UPDATE.
 */
export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    currentStockUnits: numeric("current_stock_units", { precision: 12, scale: 4 })
      .default("0.0000")
      .notNull(),
    currentPmpCents: integer("current_pmp_cents").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.warehouseId, table.productId] }),
    check("chk_non_negative_stock", sql`${table.currentStockUnits} >= 0`),
  ]
);

export type WarehouseRow = typeof warehouses.$inferSelect;
export type InventoryMovementRow = typeof inventoryMovements.$inferSelect;
export type InventoryBalanceRow = typeof inventoryBalances.$inferSelect;
