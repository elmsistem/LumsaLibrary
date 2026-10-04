import { ElectronicInvoice, ElectronicInvoiceStatus } from "../entities/electronic-invoice.entity";
import { SriCompanyConfigRow } from "../../infrastructure/database/schema/billing-sri.schema";

export interface OutboxQueueItem {
  id: string;
  invoiceId: string;
  attempts: number;
}

export interface BillingSriRepository {
  /**
   * Obtiene e incrementa de forma atómica el siguiente secuencial oficial (9 dígitos)
   * para el establecimiento, punto de emisión y tipo de documento especificados.
   */
  getNextSequential(
    establishmentCode: string,
    emissionPointCode: string,
    documentTypeCode: string
  ): Promise<string>;

  getCompanyConfig(): Promise<SriCompanyConfigRow | null>;
  saveCompanyConfig(config: SriCompanyConfigRow): Promise<void>;

  saveInvoice(invoice: ElectronicInvoice): Promise<void>;
  findInvoiceById(id: string): Promise<ElectronicInvoice | null>;
  findInvoiceByAccessKey(accessKey: string): Promise<ElectronicInvoice | null>;

  // --- Cola de Envíos Asíncronos (Outbox) ---
  enqueueOutbox(invoiceId: string): Promise<void>;
  fetchPendingOutboxBatch(limit?: number): Promise<OutboxQueueItem[]>;
  updateOutboxStatus(id: string, success: boolean, error?: string): Promise<void>;
  updateInvoiceStatus(
    id: string,
    status: ElectronicInvoiceStatus,
    authNumber?: string,
    authDate?: Date,
    errorMsg?: string
  ): Promise<void>;
}
