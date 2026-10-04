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
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { customers } from "../../../../stakeholders/infrastructure/database/schema/stakeholders.schema";

export const sriEnvironmentEnum = pgEnum("sri_environment_enum", ["TEST", "PRODUCTION"]);

export const sriInvoiceStatusEnum = pgEnum("sri_invoice_status_enum", [
  "PENDING_GENERATION",
  "SIGNED",
  "TRANSMITTED",
  "RECEIVED",
  "AUTHORIZED",
  "REJECTED",
  "NOT_AUTHORIZED",
  "CANCELLED",
]);

/**
 * Configuración fiscal del emisor / librería ante el SRI.
 */
export const sriCompanyConfigs = pgTable("sri_company_configs", {
  id: uuid("id").primaryKey(),
  ruc: varchar("ruc", { length: 13 }).notNull().unique(),
  legalName: varchar("legal_name", { length: 255 }).notNull(),
  tradeName: varchar("trade_name", { length: 255 }).notNull(),
  mainAddress: text("main_address").notNull(),
  branchAddress: text("branch_address").notNull(),
  establishmentCode: varchar("establishment_code", { length: 3 }).default("001").notNull(),
  emissionPointCode: varchar("emission_point_code", { length: 3 }).default("001").notNull(),
  isAccountingObligated: boolean("is_accounting_obligated").default(false).notNull(),
  isRimpeEntrepreneur: boolean("is_rimpe_entrepreneur").default(false).notNull(),
  isRimpePopularBusiness: boolean("is_rimpe_popular_business").default(false).notNull(),
  retentionAgentResolution: varchar("retention_agent_resolution", { length: 50 }),
  environment: sriEnvironmentEnum("environment").default("TEST").notNull(),
  certificateP12Path: varchar("certificate_p12_path", { length: 255 }),
  certificatePasswordHash: text("certificate_password_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Control atómico de secuenciales por establecimiento, punto de emisión y tipo de comprobante.
 * 01: Factura, 04: Nota de Crédito, 07: Retención.
 */
export const sriSequentials = pgTable(
  "sri_sequentials",
  {
    establishmentCode: varchar("establishment_code", { length: 3 }).notNull(),
    emissionPointCode: varchar("emission_point_code", { length: 3 }).notNull(),
    documentTypeCode: varchar("document_type_code", { length: 2 }).notNull(),
    currentSequential: integer("current_sequential").default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.establishmentCode, table.emissionPointCode, table.documentTypeCode],
    }),
  ]
);

/**
 * Comprobantes electrónicos legales (Facturas y Notas de Crédito).
 */
export const electronicInvoices = pgTable(
  "electronic_invoices",
  {
    id: uuid("id").primaryKey(),
    documentTypeCode: varchar("document_type_code", { length: 2 }).default("01").notNull(), // '01': Factura, '04': Nota de Crédito
    accessKey: varchar("access_key", { length: 49 }).notNull().unique(),
    establishmentCode: varchar("establishment_code", { length: 3 }).notNull(),
    emissionPointCode: varchar("emission_point_code", { length: 3 }).notNull(),
    sequentialNumber: varchar("sequential_number", { length: 9 }).notNull(),
    emissionDate: timestamp("emission_date", { withTimezone: true }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    saleOrderId: uuid("sale_order_id"),
    status: sriInvoiceStatusEnum("status").default("PENDING_GENERATION").notNull(),
    // Campos específicos para Notas de Crédito (Tipo 04)
    modifiedInvoiceNumber: varchar("modified_invoice_number", { length: 17 }), // Ej: 001-001-000000125
    modifiedInvoiceAccessKey: varchar("modified_invoice_access_key", { length: 49 }),
    modificationReason: text("modification_reason"),
    // Valores monetarios en centavos enteros (Money)
    subtotal0Cents: integer("subtotal_0_cents").default(0).notNull(),
    subtotal15Cents: integer("subtotal_15_cents").default(0).notNull(),
    totalDiscountCents: integer("total_discount_cents").default(0).notNull(),
    totalIvaCents: integer("total_iva_cents").default(0).notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    // Datos de autorización del SRI
    authorizationNumber: varchar("authorization_number", { length: 49 }),
    authorizationDate: timestamp("authorization_date", { withTimezone: true }),
    sriErrorMessage: text("sri_error_message"),
    xmlSignedPath: text("xml_signed_path"),
    ridePdfPath: text("ride_pdf_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_invoices_access_key").on(table.accessKey),
    index("idx_invoices_status").on(table.status),
    unique("uq_doc_sequential").on(
      table.establishmentCode,
      table.emissionPointCode,
      table.documentTypeCode,
      table.sequentialNumber
    ),
  ]
);

/**
 * Cola de envío asíncrono y reintentos (Transactional Outbox Pattern).
 * Permite que las cajas registradoras cobren y entreguen el comprobante sin depender
 * de la latencia o disponibilidad de los servidores del SRI.
 */
export const sriOutboxQueue = pgTable(
  "sri_outbox_queue",
  {
    id: uuid("id").primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => electronicInvoices.id, { onDelete: "cascade" }),
    attempts: integer("attempts").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    isProcessing: boolean("is_processing").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_sri_queue_processing").on(table.isProcessing, table.nextRetryAt),
  ]
);

export type SriCompanyConfigRow = typeof sriCompanyConfigs.$inferSelect;
export type SriSequentialRow = typeof sriSequentials.$inferSelect;
export type ElectronicInvoiceRow = typeof electronicInvoices.$inferSelect;
export type SriOutboxQueueRow = typeof sriOutboxQueue.$inferSelect;
