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
} from "drizzle-orm/pg-core";

export const taxRateEnum = pgEnum("tax_rate_enum", [
  "IVA_0",
  "IVA_15",
  "NO_OBJETO",
  "EXENTO",
]);

export const unitTypeEnum = pgEnum("unit_type_enum", [
  "UNIDAD",
  "PLIEGO",
  "METRO",
  "JUEGO",
  "SERVICIO",
]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  parentId: uuid("parent_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    sku: varchar("sku", { length: 50 }).notNull().unique(),
    barcode: varchar("barcode", { length: 100 }).unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    brandId: uuid("brand_id").references(() => brands.id),
    taxRate: taxRateEnum("tax_rate").default("IVA_15").notNull(),
    minUnit: unitTypeEnum("min_unit").default("UNIDAD").notNull(),
    isService: boolean("is_service").default(false).notNull(),
    minStockAlert: numeric("min_stock_alert", { precision: 10, scale: 2 })
      .default("5.00")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_products_barcode").on(table.barcode),
    index("idx_products_name").on(table.name),
  ]
);

export const productPresentations = pgTable(
  "product_presentations",
  {
    id: uuid("id").primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // "Unidad", "Docena", "Caja x 50"
    conversionFactor: numeric("conversion_factor", { precision: 10, scale: 4 })
      .default("1.0000")
      .notNull(),
    barcode: varchar("barcode", { length: 100 }).unique(),
    retailPriceCents: integer("retail_price_cents").notNull(),
    wholesalePriceCents: integer("wholesale_price_cents").notNull(),
    minWholesaleQuantity: integer("min_wholesale_quantity").default(1).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_presentations_product_id").on(table.productId),
    index("idx_presentations_barcode").on(table.barcode),
  ]
);

export type CategoryRow = typeof categories.$inferSelect;
export type BrandRow = typeof brands.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ProductPresentationRow = typeof productPresentations.$inferSelect;
