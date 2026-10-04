import { eq, and, lte, sql } from "drizzle-orm";
import { AppDatabase, Money, generateUUIDv7 } from "@/modules/core/public-api";
import { ElectronicInvoice, ElectronicInvoiceStatus } from "../../domain/entities/electronic-invoice.entity";
import { AccessKey } from "../../domain/value-objects/access-key.vo";
import {
  BillingSriRepository,
  OutboxQueueItem,
} from "../../domain/repositories/billing-sri.repository";
import {
  sriCompanyConfigs,
  sriSequentials,
  electronicInvoices,
  sriOutboxQueue,
  SriCompanyConfigRow,
  ElectronicInvoiceRow,
} from "../database/schema/billing-sri.schema";

export class DrizzleBillingSriRepository implements BillingSriRepository {
  constructor(private readonly db: AppDatabase) {}

  public async getNextSequential(
    establishmentCode: string,
    emissionPointCode: string,
    documentTypeCode: string
  ): Promise<string> {
    const result = await this.db
      .insert(sriSequentials)
      .values({
        establishmentCode,
        emissionPointCode,
        documentTypeCode,
        currentSequential: 1,
      })
      .onConflictDoUpdate({
        target: [
          sriSequentials.establishmentCode,
          sriSequentials.emissionPointCode,
          sriSequentials.documentTypeCode,
        ],
        set: {
          currentSequential: sql`${sriSequentials.currentSequential} + 1`,
        },
      })
      .returning({ currentSequential: sriSequentials.currentSequential });

    const currentSeq = result[0]?.currentSequential ?? 1;
    return String(currentSeq).padStart(9, "0");
  }

  public async getCompanyConfig(): Promise<SriCompanyConfigRow | null> {
    const rows = await this.db.select().from(sriCompanyConfigs).limit(1);
    return rows[0] || null;
  }

  public async saveCompanyConfig(config: SriCompanyConfigRow): Promise<void> {
    await this.db
      .insert(sriCompanyConfigs)
      .values(config)
      .onConflictDoUpdate({
        target: sriCompanyConfigs.id,
        set: {
          legalName: config.legalName,
          tradeName: config.tradeName,
          mainAddress: config.mainAddress,
          branchAddress: config.branchAddress,
          isAccountingObligated: config.isAccountingObligated,
          isRimpeEntrepreneur: config.isRimpeEntrepreneur,
          isRimpePopularBusiness: config.isRimpePopularBusiness,
          environment: config.environment,
          updatedAt: new Date(),
        },
      });
  }

  public async saveInvoice(invoice: ElectronicInvoice): Promise<void> {
    await this.db
      .insert(electronicInvoices)
      .values({
        id: invoice.getId(),
        documentTypeCode: invoice.getDocumentTypeCode(),
        accessKey: invoice.getAccessKey().getValue(),
        establishmentCode: invoice.getEstablishmentCode(),
        emissionPointCode: invoice.getEmissionPointCode(),
        sequentialNumber: invoice.getSequentialNumber(),
        emissionDate: invoice.getEmissionDate(),
        customerId: invoice.getCustomerId(),
        saleOrderId: invoice.getSaleOrderId(),
        status: invoice.getStatus(),
        subtotal0Cents: invoice.getSubtotal0().toCents(),
        subtotal15Cents: invoice.getSubtotal15().toCents(),
        totalDiscountCents: invoice.getTotalDiscount().toCents(),
        totalIvaCents: invoice.getTotalIva().toCents(),
        totalAmountCents: invoice.getTotalAmount().toCents(),
        authorizationNumber: invoice.getAuthorizationNumber(),
        authorizationDate: invoice.getAuthorizationDate(),
        sriErrorMessage: invoice.getSriErrorMessage(),
        xmlSignedPath: invoice.getXmlSignedPath(),
        ridePdfPath: invoice.getRidePdfPath(),
        createdAt: invoice.getCreatedAt(),
      })
      .onConflictDoNothing();
  }

  public async findInvoiceById(id: string): Promise<ElectronicInvoice | null> {
    const rows = await this.db
      .select()
      .from(electronicInvoices)
      .where(eq(electronicInvoices.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toInvoiceDomain(row);
  }

  public async findInvoiceByAccessKey(accessKey: string): Promise<ElectronicInvoice | null> {
    const rows = await this.db
      .select()
      .from(electronicInvoices)
      .where(eq(electronicInvoices.accessKey, accessKey))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toInvoiceDomain(row);
  }

  public async enqueueOutbox(invoiceId: string): Promise<void> {
    await this.db.insert(sriOutboxQueue).values({
      id: generateUUIDv7(),
      invoiceId,
      attempts: 0,
      nextRetryAt: new Date(),
      isProcessing: false,
    });
  }

  public async fetchPendingOutboxBatch(limit: number = 10): Promise<OutboxQueueItem[]> {
    const rows = await this.db
      .select()
      .from(sriOutboxQueue)
      .where(
        and(
          eq(sriOutboxQueue.isProcessing, false),
          lte(sriOutboxQueue.nextRetryAt, new Date())
        )
      )
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      attempts: r.attempts,
    }));
  }

  public async updateOutboxStatus(id: string, success: boolean, error?: string): Promise<void> {
    if (success) {
      await this.db.delete(sriOutboxQueue).where(eq(sriOutboxQueue.id, id));
    } else {
      await this.db
        .update(sriOutboxQueue)
        .set({
          attempts: sql`${sriOutboxQueue.attempts} + 1`,
          lastError: error || "Error desconocido",
          isProcessing: false,
          nextRetryAt: new Date(Date.now() + 30000), // Reintento en 30 segundos
        })
        .where(eq(sriOutboxQueue.id, id));
    }
  }

  public async updateInvoiceStatus(
    id: string,
    status: ElectronicInvoiceStatus,
    authNumber?: string,
    authDate?: Date,
    errorMsg?: string
  ): Promise<void> {
    await this.db
      .update(electronicInvoices)
      .set({
        status,
        authorizationNumber: authNumber,
        authorizationDate: authDate,
        sriErrorMessage: errorMsg,
      })
      .where(eq(electronicInvoices.id, id));
  }

  private toInvoiceDomain(row: ElectronicInvoiceRow): ElectronicInvoice {
    return ElectronicInvoice.create({
      id: row.id,
      documentTypeCode: row.documentTypeCode as "01" | "04",
      accessKey: AccessKey.fromString(row.accessKey),
      establishmentCode: row.establishmentCode,
      emissionPointCode: row.emissionPointCode,
      sequentialNumber: row.sequentialNumber,
      emissionDate: row.emissionDate,
      customerId: row.customerId,
      saleOrderId: row.saleOrderId,
      status: row.status as ElectronicInvoiceStatus,
      modifiedInvoiceNumber: row.modifiedInvoiceNumber,
      modifiedInvoiceAccessKey: row.modifiedInvoiceAccessKey,
      modificationReason: row.modificationReason,
      subtotal0: Money.fromCents(row.subtotal0Cents),
      subtotal15: Money.fromCents(row.subtotal15Cents),
      totalDiscount: Money.fromCents(row.totalDiscountCents),
      totalIva: Money.fromCents(row.totalIvaCents),
      totalAmount: Money.fromCents(row.totalAmountCents),
      authorizationNumber: row.authorizationNumber,
      authorizationDate: row.authorizationDate,
      sriErrorMessage: row.sriErrorMessage,
      xmlSignedPath: row.xmlSignedPath,
      ridePdfPath: row.ridePdfPath,
      createdAt: row.createdAt,
    });
  }
}
