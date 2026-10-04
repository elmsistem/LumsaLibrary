import { describe, it, expect, beforeEach } from "vitest";
import {
  BillingSriRepository,
  OutboxQueueItem,
} from "../../domain/repositories/billing-sri.repository";
import { ElectronicInvoice, ElectronicInvoiceStatus } from "../../domain/entities/electronic-invoice.entity";
import { SriCompanyConfigRow } from "../../infrastructure/database/schema/billing-sri.schema";
import { GetNextSequentialUseCase } from "./get-next-sequential.use-case";
import { CreateElectronicInvoiceUseCase } from "./create-electronic-invoice.use-case";
import { ProcessSriOutboxBatchUseCase } from "./process-sri-outbox-batch.use-case";
import { SriSoapClient } from "../../infrastructure/soap/sri-soap-client";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";

class InMemoryBillingSriRepository implements BillingSriRepository {
  private sequentials = new Map<string, number>();
  public companyConfig: SriCompanyConfigRow | null = null;
  public invoices = new Map<string, ElectronicInvoice>();
  public outbox: OutboxQueueItem[] = [];

  public async getNextSequential(
    establishmentCode: string,
    emissionPointCode: string,
    documentTypeCode: string
  ): Promise<string> {
    const key = `${establishmentCode}:${emissionPointCode}:${documentTypeCode}`;
    const current = (this.sequentials.get(key) || 0) + 1;
    this.sequentials.set(key, current);
    return String(current).padStart(9, "0");
  }

  public async getCompanyConfig(): Promise<SriCompanyConfigRow | null> {
    return this.companyConfig;
  }

  public async saveCompanyConfig(config: SriCompanyConfigRow): Promise<void> {
    this.companyConfig = config;
  }

  public async saveInvoice(invoice: ElectronicInvoice): Promise<void> {
    this.invoices.set(invoice.getId(), invoice);
  }

  public async findInvoiceById(id: string): Promise<ElectronicInvoice | null> {
    return this.invoices.get(id) || null;
  }

  public async findInvoiceByAccessKey(accessKey: string): Promise<ElectronicInvoice | null> {
    for (const inv of this.invoices.values()) {
      if (inv.getAccessKey().getValue() === accessKey) return inv;
    }
    return null;
  }

  public async enqueueOutbox(invoiceId: string): Promise<void> {
    this.outbox.push({
      id: generateUUIDv7(),
      invoiceId,
      attempts: 0,
    });
  }

  public async fetchPendingOutboxBatch(limit: number = 10): Promise<OutboxQueueItem[]> {
    return this.outbox.slice(0, limit);
  }

  public async updateOutboxStatus(id: string, success: boolean): Promise<void> {
    if (success) {
      this.outbox = this.outbox.filter((item) => item.id !== id);
    } else {
      const item = this.outbox.find((i) => i.id === id);
      if (item) item.attempts++;
    }
  }

  public async updateInvoiceStatus(
    id: string,
    status: ElectronicInvoiceStatus,
    authNumber?: string,
    authDate?: Date,
    errorMsg?: string
  ): Promise<void> {
    const inv = this.invoices.get(id);
    if (!inv) return;
    if (status === "AUTHORIZED" && authNumber) {
      inv.markAsAuthorized(authNumber, authDate || new Date());
    } else if (status === "REJECTED" || status === "NOT_AUTHORIZED") {
      inv.markAsRejected(errorMsg || "Error SRI");
    }
  }
}

describe("Billing SRI Application Use Cases", () => {
  let repo: InMemoryBillingSriRepository;
  const customerId = generateUUIDv7();

  beforeEach(async () => {
    repo = new InMemoryBillingSriRepository();
    repo.companyConfig = {
      id: generateUUIDv7(),
      ruc: "1790011223001",
      legalName: "LUMSA LIBRARY CIA. LTDA.",
      tradeName: "LUMSA LIBRARY",
      mainAddress: "Av. Amazonas y Colón",
      branchAddress: "Av. Amazonas y Colón",
      establishmentCode: "001",
      emissionPointCode: "001",
      isAccountingObligated: true,
      isRimpeEntrepreneur: true,
      isRimpePopularBusiness: false,
      retentionAgentResolution: null,
      environment: "TEST",
      certificateP12Path: null,
      certificatePasswordHash: null,
      updatedAt: new Date(),
    };
  });

  it("debe generar secuenciales atómicos de 9 dígitos correlativos", async () => {
    const seqUseCase = new GetNextSequentialUseCase(repo);

    const seq1 = await seqUseCase.execute("001", "001", "01");
    const seq2 = await seqUseCase.execute("001", "001", "01");
    const seq3 = await seqUseCase.execute("001", "002", "01"); // Otro punto de emisión

    expect(seq1).toBe("000000001");
    expect(seq2).toBe("000000002");
    expect(seq3).toBe("000000001"); // Empieza en 1 para la nueva caja
  });

  it("debe crear una Factura electrónica, clave de acceso de 49 dígitos y encolar en Outbox", async () => {
    const createInvoiceUseCase = new CreateElectronicInvoiceUseCase(repo);

    const result = await createInvoiceUseCase.execute({
      establishmentCode: "001",
      emissionPointCode: "001",
      customerId,
      buyer: {
        idType: "05",
        idNumber: "1712345678",
        legalName: "MARIA FERNANDA LOPEZ",
        email: "m.lopez@example.com",
      },
      items: [
        {
          code: "CUA-01",
          description: "Cuaderno grapado 50 hojas",
          quantity: 2,
          unitPrice: Money.fromDollars(1.5), // $3.00
          discount: Money.zero(),
          taxRate: "IVA_15", // $0.45 iva -> $3.45 total
        },
      ],
      payments: [
        {
          paymentMethodCode: "01",
          total: Money.fromDollars(3.45),
        },
      ],
    });

    expect(result.invoice.getSequentialNumber()).toBe("000000001");
    expect(result.invoice.getAccessKey().getValue()).toHaveLength(49);
    expect(result.invoice.getStatus()).toBe("PENDING_GENERATION");
    expect(result.invoice.getTotalAmount().toDecimal()).toBe(3.45);
    expect(result.xmlGenerated).toContain("<factura");
    expect(result.xmlGenerated).toContain(result.invoice.getAccessKey().getValue());

    // Debe haberse encolado en el outbox
    expect(repo.outbox.length).toBe(1);
    expect(repo.outbox[0]!.invoiceId).toBe(result.invoice.getId());
  });

  it("debe rechazar facturas a Consumidor Final que superen el límite legal de $50 USD", async () => {
    const createInvoiceUseCase = new CreateElectronicInvoiceUseCase(repo);

    await expect(
      createInvoiceUseCase.execute({
        establishmentCode: "001",
        emissionPointCode: "001",
        customerId,
        buyer: {
          idType: "07", // Consumidor Final
          idNumber: "9999999999999",
          legalName: "CONSUMIDOR FINAL",
        },
        items: [
          {
            code: "RES-01",
            description: "Caja de Resmas de Papel Bond",
            quantity: 2,
            unitPrice: Money.fromDollars(30.0), // $60.00 > $50.00
            discount: Money.zero(),
            taxRate: "IVA_0",
          },
        ],
        payments: [
          {
            paymentMethodCode: "01",
            total: Money.fromDollars(60.0),
          },
        ],
      })
    ).rejects.toThrow(/ventas superiores a \$50\.00 USD no pueden ser emitidas a Consumidor Final/);
  });

  it("debe procesar comprobantes en segundo plano a través del Worker Outbox", async () => {
    const createInvoiceUseCase = new CreateElectronicInvoiceUseCase(repo);

    const { invoice } = await createInvoiceUseCase.execute({
      establishmentCode: "001",
      emissionPointCode: "001",
      customerId,
      buyer: {
        idType: "05",
        idNumber: "1712345678",
        legalName: "PEDRO ALVARADO",
      },
      items: [
        {
          code: "BOL-01",
          description: "Bolígrafo azul",
          quantity: 1,
          unitPrice: Money.fromDollars(0.5),
          discount: Money.zero(),
          taxRate: "IVA_15",
        },
      ],
      payments: [
        {
          paymentMethodCode: "01",
          total: Money.fromDollars(0.58),
        },
      ],
    });

    // Mock Soap Client
    const mockSoapClient = new SriSoapClient();
    mockSoapClient.sendForReception = async () => ({
      state: "RECIBIDA",
      messages: [],
    });
    mockSoapClient.queryAuthorization = async (accessKey) => ({
      state: "AUTORIZADO",
      authorizationNumber: accessKey,
      authorizationDate: new Date(),
      messages: [],
    });

    const outboxWorker = new ProcessSriOutboxBatchUseCase(repo, mockSoapClient);
    const workerResult = await outboxWorker.execute(5);

    expect(workerResult.totalProcessed).toBe(1);
    expect(workerResult.authorizedCount).toBe(1);
    expect(workerResult.failedCount).toBe(0);

    // El comprobante debe haber cambiado a AUTHORIZED
    const updatedInvoice = await repo.findInvoiceById(invoice.getId());
    expect(updatedInvoice!.getStatus()).toBe("AUTHORIZED");
    expect(updatedInvoice!.getAuthorizationNumber()).toBe(invoice.getAccessKey().getValue());

    // La cola outbox debe estar vacía
    expect(repo.outbox.length).toBe(0);
  });
});
