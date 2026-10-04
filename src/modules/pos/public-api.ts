// --- Domain ---
export {
  CashSession,
  type CashSessionStatus,
  type OpenCashSessionProps,
} from "./domain/entities/cash-session.entity";
export {
  SaleOrder,
  type PosPaymentMethod,
  type SaleOrderItemProps,
  type SalePaymentProps,
  type CreateSaleOrderProps,
} from "./domain/entities/sale-order.entity";
export {
  EscPosReceiptBuilder,
  type StoreReceiptHeader,
  type CustomerReceiptInfo,
  type ReceiptItemLine,
  type ReceiptPaymentLine,
  type GenerateReceiptProps,
} from "./domain/services/esc-pos-receipt-builder";
export { type PosRepository } from "./domain/repositories/pos.repository";

// --- Application Use Cases ---
export {
  OpenCashSessionUseCase,
  type OpenCashSessionDto,
} from "./application/use-cases/open-cash-session.use-case";
export {
  CloseCashSessionUseCase,
  type CloseCashSessionDto,
} from "./application/use-cases/close-cash-session.use-case";
export {
  ProcessSaleCheckoutUseCase,
  type ProcessSaleCheckoutDto,
  type ProcessSaleCheckoutResult,
  type CheckoutItemDto,
  type CheckoutPaymentDto,
} from "./application/use-cases/process-sale-checkout.use-case";

// --- Infrastructure & Database ---
export {
  cashSessions,
  saleOrders,
  saleOrderItems,
  salePayments,
  cashSessionStatusEnum,
  paymentMethodEnum,
  type CashSessionRow,
  type SaleOrderRow,
  type SaleOrderItemRow,
  type SalePaymentRow,
} from "./infrastructure/database/schema/pos.schema";
export { DrizzlePosRepository } from "./infrastructure/persistence/drizzle-pos.repository";
