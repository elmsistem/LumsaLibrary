import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const idTypeEnum = pgEnum("id_type_enum", [
  "CEDULA",
  "RUC",
  "PASAPORTE",
  "CONSUMIDOR_FINAL",
  "EXTERIOR",
]);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey(),
    idType: idTypeEnum("id_type").notNull(),
    idNumber: varchar("id_number", { length: 20 }).notNull().unique(),
    legalName: varchar("legal_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
    creditLimitCents: integer("credit_limit_cents").default(0).notNull(),
    currentDebtCents: integer("current_debt_cents").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_customers_id_number").on(table.idNumber),
    index("idx_customers_legal_name").on(table.legalName),
  ]
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey(),
    ruc: varchar("ruc", { length: 13 }).notNull().unique(),
    legalName: varchar("legal_name", { length: 255 }).notNull(),
    commercialName: varchar("commercial_name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
    contactPerson: varchar("contact_person", { length: 150 }),
    creditDays: integer("credit_days").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_suppliers_ruc").on(table.ruc)]
);

export type CustomerRow = typeof customers.$inferSelect;
export type NewCustomerRow = typeof customers.$inferInsert;
export type SupplierRow = typeof suppliers.$inferSelect;
export type NewSupplierRow = typeof suppliers.$inferInsert;
