// --- Value Objects & Domain ---
export {
  AccessKey,
  type GenerateAccessKeyProps,
  type SriDocumentType,
  type SriEnvironment,
} from "./domain/value-objects/access-key.vo";
export {
  ElectronicInvoice,
  type ElectronicInvoiceStatus,
  type CreateElectronicInvoiceProps,
} from "./domain/entities/electronic-invoice.entity";
export {
  InvoiceXmlBuilder,
  type CompanyTaxInfo,
  type BuyerTaxInfo,
  type InvoiceDetailItem,
  type PaymentInfo,
  type BuildInvoiceXmlProps,
  type BuildCreditNoteXmlProps,
} from "./domain/services/invoice-xml-builder";
export { XadesSigner, type XadesSigningOptions } from "./domain/services/xades-signer";
export {
  type BillingSriRepository,
  type OutboxQueueItem,
} from "./domain/repositories/billing-sri.repository";

// --- Application Use Cases ---
export { GetNextSequentialUseCase } from "./application/use-cases/get-next-sequential.use-case";
export {
  CreateElectronicInvoiceUseCase,
  type CreateElectronicInvoiceDto,
  type CreateElectronicInvoiceResult,
} from "./application/use-cases/create-electronic-invoice.use-case";
export {
  ProcessSriOutboxBatchUseCase,
  type ProcessOutboxBatchResult,
} from "./application/use-cases/process-sri-outbox-batch.use-case";

// --- Infrastructure & Database ---
export {
  sriCompanyConfigs,
  sriSequentials,
  electronicInvoices,
  sriOutboxQueue,
  sriEnvironmentEnum,
  sriInvoiceStatusEnum,
  type SriCompanyConfigRow,
  type SriSequentialRow,
  type ElectronicInvoiceRow,
  type SriOutboxQueueRow,
} from "./infrastructure/database/schema/billing-sri.schema";
export {
  SriSoapClient,
  type SriReceptionResponse,
  type SriAuthorizationResponse,
} from "./infrastructure/soap/sri-soap-client";
export { DrizzleBillingSriRepository } from "./infrastructure/persistence/drizzle-billing-sri.repository";
