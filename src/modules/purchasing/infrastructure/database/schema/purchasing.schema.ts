import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { suppliers } from "@/modules/stakeholders/public-api";
import { warehouses } from "@/modules/inventory/public-api";
import { products, productPresentations } from "@/modules/catalog/public-api";

export const purchaseStatusEnum = pgEnum("purchase_status_enum", [
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
]);

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    invoiceNumber: varchar("invoice_number", { length: 17 }).notNull(), // Formato SRI: 001-001-000000123
    authorizationNumber: varchar("authorization_number", { length: 49 }), // Clave de acceso o número de autorización SRI
    emissionDate: timestamp("emission_date", { withTimezone: true }).notNull(),
    subtotal0Cents: integer("subtotal_0_cents").default(0).notNull(),
    subtotal15Cents: integer("subtotal_15_cents").default(0).notNull(),
    totalDiscountCents: integer("total_discount_cents").default(0).notNull(),
    totalIvaCents: integer("total_iva_cents").default(0).notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    status: purchaseStatusEnum("status").default("DRAFT").notNull(),
    xmlFilePath: text("xml_file_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_supplier_invoice").on(table.supplierId, table.invoiceNumber),
    index("idx_purchases_supplier").on(table.supplierId),
    index("idx_purchases_warehouse").on(table.warehouseId),
  ]
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    presentationId: uuid("presentation_id")
      .notNull()
      .references(() => productPresentations.id),
    supplierProductCode: varchar("supplier_product_code", { length: 100 }),
    quantityBought: numeric("quantity_bought", { precision: 10, scale: 2 }).notNull(),
    unitCostCents: integer("unit_cost_cents").notNull(),
    taxRate: varchar("tax_rate", { length: 20 }).notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (table) => [
    index("idx_purchase_items_purchase").on(table.purchaseId),
    index("idx_purchase_items_product").on(table.productId),
  ]
);

export const supplierProductMappings = pgTable(
  "supplier_product_mappings",
  {
    id: uuid("id").primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    supplierCode: varchar("supplier_code", { length: 100 }).notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    presentationId: uuid("presentation_id")
      .notNull()
      .references(() => productPresentations.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_supplier_mapping").on(table.supplierId, table.supplierCode),
  ]
);

export const supplierDebts = pgTable(
  "supplier_debts",
  {
    id: uuid("id").primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    totalDebtCents: integer("total_debt_cents").notNull(),
    paidAmountCents: integer("paid_amount_cents").default(0).notNull(),
    isSettled: boolean("is_settled").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_supplier_debts_supplier").on(table.supplierId),
    index("idx_supplier_debts_purchase").on(table.purchaseId),
  ]
);

export type PurchaseRow = typeof purchases.$inferSelect;
export type NewPurchaseRow = typeof purchases.$inferInsert;
export type PurchaseItemRow = typeof purchaseItems.$inferSelect;
export type NewPurchaseItemRow = typeof purchaseItems.$inferInsert;
export type SupplierProductMappingRow = typeof supplierProductMappings.$inferSelect;
export type NewSupplierProductMappingRow = typeof supplierProductMappings.$inferInsert;
export type SupplierDebtRow = typeof supplierDebts.$inferSelect;
export type NewSupplierDebtRow = typeof supplierDebts.$inferInsert;
