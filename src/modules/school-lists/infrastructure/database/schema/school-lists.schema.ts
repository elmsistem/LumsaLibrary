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
import { customers } from "../../../../stakeholders/infrastructure/database/schema/stakeholders.schema";
import { cashSessions } from "../../../../pos/infrastructure/database/schema/pos.schema";
import {
  products,
  productPresentations,
} from "../../../../catalog/infrastructure/database/schema/catalog.schema";

export const schoolListStatusEnum = pgEnum("school_list_status_enum", [
  "DRAFT",
  "QUOTED",
  "RESERVED",
  "DISPATCHED",
  "CANCELLED",
]);

/**
 * Instituciones Educativas (Colegios, Escuelas y Jardines de infantes).
 */
export const schoolInstitutions = pgTable("school_institutions", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  city: varchar("city", { length: 100 }).notNull(),
  regime: varchar("regime", { length: 20 }).default("SIERRA").notNull(), // 'COSTA' | 'SIERRA'
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Listas de útiles escolares prediseñadas o por estudiante.
 */
export const schoolLists = pgTable(
  "school_lists",
  {
    id: uuid("id").primaryKey(),
    institutionId: uuid("institution_id").references(() => schoolInstitutions.id),
    gradeLevel: varchar("grade_level", { length: 100 }).notNull(), // Ej: "5to de Básica"
    academicYear: varchar("academic_year", { length: 20 }).notNull(), // Ej: "2026-2027"
    studentName: varchar("student_name", { length: 150 }),
    customerId: uuid("customer_id").references(() => customers.id),
    status: schoolListStatusEnum("status").default("DRAFT").notNull(),
    totalQuotedCents: integer("total_quoted_cents").default(0).notNull(),
    advancePaymentCents: integer("advance_payment_cents").default(0).notNull(), // Abonos acumulados
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_school_lists_institution").on(table.institutionId),
    index("idx_school_lists_status").on(table.status),
    index("idx_school_lists_customer").on(table.customerId),
  ]
);

/**
 * Ítems detallados de la lista de útiles escolares.
 */
export const schoolListItems = pgTable(
  "school_list_items",
  {
    id: uuid("id").primaryKey(),
    schoolListId: uuid("school_list_id")
      .notNull()
      .references(() => schoolLists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    presentationId: uuid("presentation_id")
      .notNull()
      .references(() => productPresentations.id),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    isReserved: boolean("is_reserved").default(false).notNull(),
    isDelivered: boolean("is_delivered").default(false).notNull(),
    substituteProductId: uuid("substitute_product_id").references(() => products.id),
  },
  (table) => [index("idx_school_list_items_list").on(table.schoolListId)]
);

/**
 * Registro de abonos / anticipos financieros de listas escolares en la caja activa.
 */
export const schoolListAdvances = pgTable(
  "school_list_advances",
  {
    id: uuid("id").primaryKey(),
    schoolListId: uuid("school_list_id")
      .notNull()
      .references(() => schoolLists.id, { onDelete: "cascade" }),
    cashSessionId: uuid("cash_session_id")
      .notNull()
      .references(() => cashSessions.id),
    amountCents: integer("amount_cents").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
    receiptCode: varchar("receipt_code", { length: 50 }).notNull().unique(), // Ej: REC-ANT-2026-00001
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_school_advances_list").on(table.schoolListId),
    index("idx_school_advances_session").on(table.cashSessionId),
  ]
);

export type SchoolInstitutionRow = typeof schoolInstitutions.$inferSelect;
export type SchoolListRow = typeof schoolLists.$inferSelect;
export type SchoolListItemRow = typeof schoolListItems.$inferSelect;
export type SchoolListAdvanceRow = typeof schoolListAdvances.$inferSelect;
