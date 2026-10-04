import { describe, it, expect, beforeEach } from "vitest";
import { PosRepository } from "../../domain/repositories/pos.repository";
import { CashSession } from "../../domain/entities/cash-session.entity";
import { SaleOrder } from "../../domain/entities/sale-order.entity";
import { OpenCashSessionUseCase } from "./open-cash-session.use-case";
import { CloseCashSessionUseCase } from "./close-cash-session.use-case";
import { ProcessSaleCheckoutUseCase } from "./process-sale-checkout.use-case";

import {
  InventoryRepository,
  Warehouse,
  InventoryBalance,
  InventoryMovement,
  RecordPurchaseEntryUseCase,
  RecordSaleExitUseCase,
} from "../../../inventory/public-api";
import {
  BillingSriRepository,
  CreateElectronicInvoiceUseCase,
  ElectronicInvoice,
  SriCompanyConfigRow,
  OutboxQueueItem,
} from "../../../billing-sri/public-api";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

class InMemoryPosRepository implements PosRepository {
  public sessions = new Map<string, CashSession>();
  public orders = new Map<string, SaleOrder>();
  private saleCount = 0;

  public async findOpenSessionByUser(userId: string): Promise<CashSession | null> {
    for (const s of this.sessions.values()) {
      if (s.getUserId() === userId && s.isOpen()) return s;
    }
    return null;
  }

  public async findOpenSessionByTerminal(terminalCode: string): Promise<CashSession | null> {
    for (const s of this.sessions.values()) {
      if (s.getTerminalCode() === terminalCode.toUpperCase() && s.isOpen()) return s;
    }
    return null;
  }

  public async findSessionById(id: string): Promise<CashSession | null> {
    return this.sessions.get(id) || null;
  }

  public async saveSession(session: CashSession): Promise<void> {
    this.sessions.set(session.getId(), session);
  }

  public async calculateSessionExpectedCash(sessionId: string): Promise<Money> {
    const session = this.sessions.get(sessionId);
    const initialFloatCents = session ? session.getInitialFloat().toCents() : 0;

    let cashReceivedCents = 0;
    let changeReturnedCents = 0;

    for (const order of this.orders.values()) {
      if (order.getCashSessionId() === sessionId) {
        changeReturnedCents += order.getChange().toCents();
        for (const p of order.getPayments()) {
          if (p.paymentMethod === "CASH") {
            cashReceivedCents += p.amount.toCents();
          }
        }
      }
    }

    const netCents = initialFloatCents + cashReceivedCents - changeReturnedCents;
    return Money.fromCents(netCents);
  }

  public async getNextSaleSequential(): Promise<string> {
    this.saleCount++;
    return `VTA-2026-${String(this.saleCount).padStart(7, "0")}`;
  }

  public async saveSaleOrder(order: SaleOrder): Promise<void> {
    this.orders.set(order.getId(), order);
  }

  public async findSaleOrderById(id: string): Promise<SaleOrder | null> {
    return this.orders.get(id) || null;
  }
}

class InMemoryInventoryRepository implements InventoryRepository {
  private warehouses = new Map<string, Warehouse>();
  private balances = new Map<string, InventoryBalance>();
  public movements: InventoryMovement[] = [];

  public async findWarehouseById(id: string): Promise<Warehouse | null> {
    return this.warehouses.get(id) || null;
  }
  public async findWarehouseByCode(code: string): Promise<Warehouse | null> {
    for (const wh of this.warehouses.values()) {
      if (wh.getCode() === code.toUpperCase()) return wh;
    }
    return null;
  }
  public async saveWarehouse(warehouse: Warehouse): Promise<void> {
    this.warehouses.set(warehouse.getId(), warehouse);
  }
  public async listWarehouses(): Promise<Warehouse[]> {
    return Array.from(this.warehouses.values());
  }
  public async getBalance(warehouseId: string, productId: string): Promise<InventoryBalance | null> {
    return this.balances.get(`${warehouseId}:${productId}`) || null;
  }
  public async getBalanceForUpdate(warehouseId: string, productId: string): Promise<InventoryBalance | null> {
    return this.getBalance(warehouseId, productId);
  }
  public async recordMovementAndUpdateBalance(
    movement: InventoryMovement,
    newBalance: InventoryBalance
  ): Promise<void> {
    this.movements.push(movement);
    this.balances.set(`${newBalance.getWarehouseId()}:${newBalance.getProductId()}`, newBalance);
  }
  public async getKardexHistory(): Promise<InventoryMovement[]> {
    return this.movements;
  }
  public async countKardexHistory(): Promise<number> {
    return this.movements.length;
  }
}

class InMemoryBillingSriRepository implements BillingSriRepository {
  private sequentials = new Map<string, number>();
  public companyConfig: SriCompanyConfigRow | null = null;
  public invoices = new Map<string, ElectronicInvoice>();
  public outbox: OutboxQueueItem[] = [];

  public async getNextSequential(
    estab: string,
    ptoEmi: string,
    docType: string
  ): Promise<string> {
    const key = `${estab}:${ptoEmi}:${docType}`;
    const next = (this.sequentials.get(key) || 0) + 1;
    this.sequentials.set(key, next);
    return String(next).padStart(9, "0");
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
    this.outbox.push({ id: generateUUIDv7(), invoiceId, attempts: 0 });
  }
  public async fetchPendingOutboxBatch(): Promise<OutboxQueueItem[]> {
    return this.outbox;
  }
  public async updateOutboxStatus(): Promise<void> {}
  public async updateInvoiceStatus(): Promise<void> {}
}

describe("POS Application Use Cases (Punto de Venta y Control de Caja)", () => {
  let posRepo: InMemoryPosRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let billingRepo: InMemoryBillingSriRepository;

  let warehouse: Warehouse;
  const userId = generateUUIDv7();
  const customerId = generateUUIDv7();
  const productId = generateUUIDv7();
  const presentationId = generateUUIDv7();

  beforeEach(async () => {
    posRepo = new InMemoryPosRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    billingRepo = new InMemoryBillingSriRepository();

    // Crear almacén matriz
    warehouse = Warehouse.create({
      name: "Almacén Principal",
      code: "MATRIZ",
    });
    await inventoryRepo.saveWarehouse(warehouse);

    // Abastecer inventario inicial: 50 cuadernos a $1.00
    const purchaseUseCase = new RecordPurchaseEntryUseCase(inventoryRepo);
    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 50,
      unitCostCents: 100,
    });

    // Configurar empresa SRI
    billingRepo.companyConfig = {
      id: generateUUIDv7(),
      ruc: "1790011223001",
      legalName: "LUMSA LIBRARY CIA. LTDA.",
      tradeName: "LUMSA LIBRARY",
      mainAddress: "Av. Amazonas y Colón, Quito",
      branchAddress: "Av. Amazonas y Colón, Quito",
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

  it("debe abrir un turno de caja y bloquear turnos duplicados", async () => {
    const openUseCase = new OpenCashSessionUseCase(posRepo);

    const session = await openUseCase.execute({
      userId,
      terminalCode: "POS-01",
      initialFloatCents: 5000, // $50.00
    });

    expect(session.isOpen()).toBe(true);
    expect(session.getInitialFloat().toDecimal()).toBe(50.0);

    // Mismo usuario no puede abrir otra caja simultánea
    await expect(
      openUseCase.execute({
        userId,
        terminalCode: "POS-02",
        initialFloatCents: 2000,
      })
    ).rejects.toThrow(ValidationError);

    // Otra terminal con diferente usuario no puede usar una terminal ya ocupada
    await expect(
      openUseCase.execute({
        userId: generateUUIDv7(),
        terminalCode: "POS-01",
        initialFloatCents: 2000,
      })
    ).rejects.toThrow(/ya tiene una sesión activa/);
  });

  it("debe procesar un checkout de venta: descontar Kardex, encolar SRI y generar ticket térmico", async () => {
    const openUseCase = new OpenCashSessionUseCase(posRepo);
    const session = await openUseCase.execute({
      userId,
      terminalCode: "POS-01",
      initialFloatCents: 5000, // $50.00
    });

    const recordSaleExitUseCase = new RecordSaleExitUseCase(inventoryRepo);
    const createInvoiceUseCase = new CreateElectronicInvoiceUseCase(billingRepo);
    const checkoutUseCase = new ProcessSaleCheckoutUseCase(
      posRepo,
      recordSaleExitUseCase,
      createInvoiceUseCase
    );

    // Venta: 2 cuadernos a $2.00 c/u ($4.00 base + 15% IVA = $4.60)
    // Pago: $5.00 en efectivo (vuelto $0.40)
    const result = await checkoutUseCase.execute({
      cashSessionId: session.getId(),
      customerId,
      warehouseId: warehouse.getId(),
      buyer: {
        idType: "05",
        idNumber: "1712345678",
        legalName: "ESTEBAN PROAÑO",
      },
      items: [
        {
          productId,
          presentationId,
          code: "CUA-01",
          description: "Cuaderno espiral 100 hojas",
          quantity: 2,
          conversionFactor: 1, // 1 unidad mínima por cuaderno
          unitPriceCents: 200,
          taxRate: "IVA_15",
        },
      ],
      payments: [
        {
          paymentMethod: "CASH",
          amountCents: 500, // $5.00
        },
      ],
    });

    expect(result.saleOrder.getSequentialCode()).toContain("VTA-2026-");
    expect(result.saleOrder.getTotalAmount().toDecimal()).toBe(4.6);
    expect(result.saleOrder.getChange().toDecimal()).toBe(0.4);

    // Kardex descontado (50 inicial - 2 = 48)
    const balance = await inventoryRepo.getBalance(warehouse.getId(), productId);
    expect(balance).not.toBeNull();
    expect(balance!.getCurrentStockUnits()).toBe(48);

    // Encolado en Outbox SRI
    expect(billingRepo.outbox.length).toBe(1);
    expect(result.electronicInvoiceResult.invoice.getSequentialNumber()).toBe("000000001");

    // Ticket térmico contiene datos
    expect(result.receiptText).toContain("ESTEBAN PROAÑO");
    expect(result.receiptText).toContain("$4.60");
    expect(result.receiptText).toContain("CAMBIO / VUELTO:");
    expect(result.receiptText).toContain("$0.40");
  });

  it("debe procesar pagos mixtos (Efectivo + Transferencia DeUna)", async () => {
    const openUseCase = new OpenCashSessionUseCase(posRepo);
    const session = await openUseCase.execute({
      userId,
      terminalCode: "POS-01",
      initialFloatCents: 5000,
    });

    const recordSaleExitUseCase = new RecordSaleExitUseCase(inventoryRepo);
    const createInvoiceUseCase = new CreateElectronicInvoiceUseCase(billingRepo);
    const checkoutUseCase = new ProcessSaleCheckoutUseCase(
      posRepo,
      recordSaleExitUseCase,
      createInvoiceUseCase
    );

    // Venta: 5 cuadernos a $2.00 c/u ($10.00 base + $1.50 IVA = $11.50)
    // Pago mixto: $5.00 en efectivo + $6.50 por transferencia DeUna
    const result = await checkoutUseCase.execute({
      cashSessionId: session.getId(),
      customerId,
      warehouseId: warehouse.getId(),
      buyer: {
        idType: "05",
        idNumber: "1712345678",
        legalName: "MARCELO SILVA",
      },
      items: [
        {
          productId,
          presentationId,
          code: "CUA-01",
          description: "Cuaderno espiral",
          quantity: 5,
          conversionFactor: 1,
          unitPriceCents: 200,
          taxRate: "IVA_15",
        },
      ],
      payments: [
        {
          paymentMethod: "CASH",
          amountCents: 500, // $5.00
        },
        {
          paymentMethod: "BANK_TRANSFER_DEUNA",
          amountCents: 650, // $6.50
          referenceCode: "DEUNA-TX-998811",
        },
      ],
    });

    expect(result.saleOrder.getTotalAmount().toDecimal()).toBe(11.5);
    expect(result.saleOrder.getChange().toDecimal()).toBe(0.0);
    expect(result.saleOrder.getPayments().length).toBe(2);
  });

  it("debe realizar el cierre ciego de caja calculando el efectivo esperado del sistema", async () => {
    const openUseCase = new OpenCashSessionUseCase(posRepo);
    const closeUseCase = new CloseCashSessionUseCase(posRepo);

    // 1. Abrir caja con $50.00
    const session = await openUseCase.execute({
      userId,
      terminalCode: "POS-01",
      initialFloatCents: 5000,
    });

    // 2. Venta con cobro en efectivo de $10.00 netos
    const recordSaleExitUseCase = new RecordSaleExitUseCase(inventoryRepo);
    const createInvoiceUseCase = new CreateElectronicInvoiceUseCase(billingRepo);
    const checkoutUseCase = new ProcessSaleCheckoutUseCase(
      posRepo,
      recordSaleExitUseCase,
      createInvoiceUseCase
    );

    await checkoutUseCase.execute({
      cashSessionId: session.getId(),
      customerId,
      warehouseId: warehouse.getId(),
      buyer: {
        idType: "05",
        idNumber: "1712345678",
        legalName: "CLIENTE TEST",
      },
      items: [
        {
          productId,
          presentationId,
          code: "CUA-01",
          description: "Cuaderno",
          quantity: 2,
          conversionFactor: 1,
          unitPriceCents: 200,
          taxRate: "IVA_15",
        },
      ],
      payments: [
        {
          paymentMethod: "CASH",
          amountCents: 500, // Pagó $5.00 para una cuenta de $4.60 -> Neto $4.60
        },
      ],
    });

    // Esperado en caja: $50.00 inicial + $4.60 venta neta = $54.60
    // Cajero declara en físico: $55.00 (sobrante +$0.40)
    const closed = await closeUseCase.execute({
      sessionId: session.getId(),
      declaredCashCents: 5500,
      closingNotes: "Cierre de turno sin novedades",
    });

    expect(closed.getStatus()).toBe("CLOSED");
    expect(closed.getExpectedCash()!.toDecimal()).toBe(54.6);
    expect(closed.getDeclaredCash()!.toDecimal()).toBe(55.0);
    expect(closed.getDiscrepancy()!.toDecimal()).toBe(0.4); // Sobrante de 40 centavos
  });
});
