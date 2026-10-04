// --- Domain Entities & Value Objects ---
export {
  Purchase,
  type PurchaseStatus,
  type CreatePurchaseProps,
} from "./domain/entities/purchase.entity";
export {
  PurchaseItem,
  type CreatePurchaseItemProps,
} from "./domain/entities/purchase-item.entity";
export {
  SupplierDebt,
  type CreateSupplierDebtProps,
} from "./domain/entities/supplier-debt.entity";
export {
  SupplierProductMapping,
  type CreateSupplierProductMappingProps,
} from "./domain/entities/supplier-product-mapping.entity";

// --- Domain Services ---
export {
  SriXmlInvoiceParserService,
  type ParsedSupplierInvoice,
  type ParsedSupplierInvoiceItem,
} from "./domain/services/sri-xml-invoice-parser.service";

// --- Domain Repositories ---
export { type PurchaseRepository } from "./domain/repositories/purchase.repository";

// --- Application Use Cases ---
export {
  ParseSupplierXmlInvoiceUseCase,
  type ParseSupplierXmlInvoiceInput,
  type ParseSupplierXmlInvoiceResult,
  type MatchedInvoiceItemDto,
} from "./application/use-cases/parse-supplier-xml-invoice.use-case";

export {
  ConfirmPurchaseUseCase,
  type ConfirmPurchaseInput,
  type ConfirmPurchaseItemInput,
  type ConfirmPurchaseResult,
} from "./application/use-cases/confirm-purchase.use-case";

// --- Infrastructure & Database ---
export {
  purchases,
  purchaseItems,
  supplierProductMappings,
  supplierDebts,
  purchaseStatusEnum,
  type PurchaseRow,
  type NewPurchaseRow,
  type PurchaseItemRow,
  type NewPurchaseItemRow,
  type SupplierProductMappingRow,
  type NewSupplierProductMappingRow,
  type SupplierDebtRow,
  type NewSupplierDebtRow,
} from "./infrastructure/database/schema/purchasing.schema";

export { DrizzlePurchaseRepository } from "./infrastructure/persistence/drizzle-purchase.repository";
