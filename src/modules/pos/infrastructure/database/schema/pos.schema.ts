import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { customers } from "../../../../stakeholders/infrastructure/database/schema/stakeholders.schema";
import { warehouses } from "../../../../inventory/infrastructure/database/schema/inventory.schema";
import {
  products,
  productPresentations,
} from "../../../../catalog/infrastructure/database/schema/catalog.schema";

export const cashSessionStatusEnum = pgEnum("cash_session_status_enum", ["OPEN", "CLOSED"]);

export const paymentMethodEnum = pgEnum("payment_method_enum", [
  "CASH",
  "BANK_TRANSFER_DEUNA",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "STORE_CREDIT",
  "TAX_WITHHOLDING_RECEIVED",
  "CUSTOMER_ADVANCE_APPLIED",
]);

/**
 * Sesiones y turnos de caja de mostrador.
 * Vinculados directamente a un punto de emisión del SRI.
 */
export const cashSessions = pgTable(
  "cash_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    terminalCode: varchar("terminal_code", { length: 50 }).notNull(),
    establishmentCode: varchar("establishment_code", { length: 3 }).default("001").notNull(),
    emissionPointCode: varchar("emission_point_code", { length: 3 }).default("001").notNull(),
    openingTime: timestamp("opening_time", { withTimezone: true }).defaultNow().notNull(),
    closingTime: timestamp("closing_time", { withTimezone: true }),
    initialFloatCents: integer("initial_float_cents").notNull(), // Fondo inicial de sencillo
    declaredCashCents: integer("declared_cash_cents"), // Declarado por cajero en cierre ciego
    expectedCashCents: integer("expected_cash_cents"), // Calculado automáticamente por el sistema
    discrepancyCents: integer("discrepancy_cents"), // Sobrante (+) o Faltante (-)
    status: cashSessionStatusEnum("status").default("OPEN").notNull(),
    closingNotes: text("closing_notes"),
  },
  (table) => [
    index("idx_cash_sessions_user_status").on(table.userId, table.status),
    index("idx_cash_sessions_terminal").on(table.terminalCode),
  ]
);

/**
 * Órdenes y tickets de venta en mostrador.
 */
export const saleOrders = pgTable(
  "sale_orders",
  {
    id: uuid("id").primaryKey(),
    sequentialCode: varchar("sequential_code", { length: 50 }).notNull().unique(), // Ej: VTA-2026-0000001
    cashSessionId: uuid("cash_session_id")
      .notNull()
      .references(() => cashSessions.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    subtotal0Cents: integer("subtotal_0_cents").default(0).notNull(),
    subtotal15Cents: integer("subtotal_15_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    ivaCents: integer("iva_cents").default(0).notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    changeCents: integer("change_cents").default(0).notNull(), // Vuelto entregado al cliente
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_sales_cash_session").on(table.cashSessionId),
    index("idx_sales_customer").on(table.customerId),
    index("idx_sales_created_at").on(table.createdAt),
  ]
);

/**
 * Líneas de detalle de la orden de venta.
 */
export const saleOrderItems = pgTable(
  "sale_order_items",
  {
    id: uuid("id").primaryKey(),
    saleOrderId: uuid("sale_order_id")
      .notNull()
      .references(() => saleOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    presentationId: uuid("presentation_id")
      .notNull()
      .references(() => productPresentations.id),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxRate: varchar("tax_rate", { length: 20 }).default("IVA_15").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (table) => [index("idx_sale_items_order").on(table.saleOrderId)]
);

/**
 * Pagos realizados para la orden de venta (soporte de pagos mixtos).
 */
export const salePayments = pgTable(
  "sale_payments",
  {
    id: uuid("id").primaryKey(),
    saleOrderId: uuid("sale_order_id")
      .notNull()
      .references(() => saleOrders.id, { onDelete: "cascade" }),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    amountCents: integer("amount_cents").notNull(),
    referenceCode: varchar("reference_code", { length: 100 }), // Lote, voucher o comprobante DeUna
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_sale_payments_order").on(table.saleOrderId)]
);

export type CashSessionRow = typeof cashSessions.$inferSelect;
export type SaleOrderRow = typeof saleOrders.$inferSelect;
export type SaleOrderItemRow = typeof saleOrderItems.$inferSelect;
export type SalePaymentRow = typeof salePayments.$inferSelect;
