import { describe, it, expect, beforeEach } from "vitest";
import {
  SchoolListRepository,
  SchoolListAdvanceData,
} from "../../domain/repositories/school-list.repository";
import { SchoolInstitution } from "../../domain/entities/school-institution.entity";
import { SchoolList } from "../../domain/entities/school-list.entity";
import { CreateSchoolInstitutionUseCase } from "./create-school-institution.use-case";
import { CreateSchoolListUseCase } from "./create-school-list.use-case";
import { QuoteSchoolListUseCase } from "./quote-school-list.use-case";
import { ReserveSchoolListUseCase } from "./reserve-school-list.use-case";
import { FulfillSchoolListToSaleUseCase } from "./fulfill-school-list-to-sale.use-case";

import {
  CatalogRepository,
  Product,
  ProductPresentation,
} from "../../../catalog/public-api";
import {
  InventoryRepository,
  Warehouse,
  InventoryBalance,
  InventoryMovement,
  RecordPurchaseEntryUseCase,
  RecordSaleExitUseCase,
} from "../../../inventory/public-api";
import {
  PosRepository,
  CashSession,
  SaleOrder,
  OpenCashSessionUseCase,
  ProcessSaleCheckoutUseCase,
} from "../../../pos/public-api";
import {
  BillingSriRepository,
  CreateElectronicInvoiceUseCase,
  ElectronicInvoice,
  SriCompanyConfigRow,
  OutboxQueueItem,
} from "../../../billing-sri/public-api";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";

class InMemorySchoolListRepository implements SchoolListRepository {
  public institutions = new Map<string, SchoolInstitution>();
  public lists = new Map<string, SchoolList>();
  public advances: SchoolListAdvanceData[] = [];
  private advanceCount = 0;

  public async saveInstitution(inst: SchoolInstitution): Promise<void> {
    this.institutions.set(inst.getId(), inst);
  }
  public async findInstitutionById(id: string): Promise<SchoolInstitution | null> {
    return this.institutions.get(id) || null;
  }
  public async listInstitutions(): Promise<SchoolInstitution[]> {
    return Array.from(this.institutions.values());
  }
  public async saveSchoolList(list: SchoolList): Promise<void> {
    this.lists.set(list.getId(), list);
  }
  public async findSchoolListById(id: string): Promise<SchoolList | null> {
    return this.lists.get(id) || null;
  }
  public async listSchoolLists(): Promise<SchoolList[]> {
    return Array.from(this.lists.values());
  }
  public async getNextAdvanceSequential(): Promise<string> {
    this.advanceCount++;
    return `REC-ANT-2026-${String(this.advanceCount).padStart(5, "0")}`;
  }
  public async saveAdvance(advance: SchoolListAdvanceData): Promise<void> {
    this.advances.push(advance);
  }
}

class InMemoryCatalogRepository implements CatalogRepository {
  public products = new Map<string, Product>();

  public async saveProduct(product: Product): Promise<void> {
    this.products.set(product.getId(), product);
  }
  public async findProductById(id: string): Promise<Product | null> {
    return this.products.get(id) || null;
  }
  public async findProductBySku(sku: string): Promise<Product | null> {
    for (const p of this.products.values()) {
      if (p.getSku() === sku) return p;
    }
    return null;
  }
  public async findProductByBarcode(barcode: string): Promise<Product | null> {
    for (const p of this.products.values()) {
      if (p.getBarcode() === barcode) return p;
    }
    return null;
  }
  public async searchProducts(query: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) =>
      p.getName().toLowerCase().includes(query.toLowerCase())
    );
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
    const initial = session ? session.getInitialFloat().toCents() : 0;
    return Money.fromCents(initial);
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

class InMemoryBillingSriRepository implements BillingSriRepository {
  private sequentials = new Map<string, number>();
  public companyConfig: SriCompanyConfigRow | null = null;
  public invoices = new Map<string, ElectronicInvoice>();
  public outbox: OutboxQueueItem[] = [];

  public async getNextSequential(estab: string, ptoEmi: string, docType: string): Promise<string> {
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

describe("School Lists Application Use Cases (Temporada Escolar)", () => {
  let schoolListRepo: InMemorySchoolListRepository;
  let catalogRepo: InMemoryCatalogRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let posRepo: InMemoryPosRepository;
  let billingRepo: InMemoryBillingSriRepository;

  let warehouse: Warehouse;
  let productCuaderno: Product;
  let presCuaderno: ProductPresentation;
  const customerId = generateUUIDv7();
  const userId = generateUUIDv7();

  beforeEach(async () => {
    schoolListRepo = new InMemorySchoolListRepository();
    catalogRepo = new InMemoryCatalogRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    posRepo = new InMemoryPosRepository();
    billingRepo = new InMemoryBillingSriRepository();

    // 1. Almacén
    warehouse = Warehouse.create({ name: "Matriz", code: "MATRIZ" });
    await inventoryRepo.saveWarehouse(warehouse);

    // 2. Producto en catálogo
    const prodId = generateUUIDv7();
    productCuaderno = Product.create({
      id: prodId,
      sku: "CUA-NORM-100",
      name: "Cuaderno Espiral 100 Hojas Norma",
      categoryId: generateUUIDv7(),
      taxRate: "IVA_15",
      minUnit: "UNIDAD",
    });

    presCuaderno = ProductPresentation.create({
      id: generateUUIDv7(),
      productId: prodId,
      name: "Unidad",
      conversionFactor: 1,
      retailPrice: Money.fromDollars(2.5), // $2.50
      wholesalePrice: Money.fromDollars(2.2),
      isDefault: true,
    });
    productCuaderno.addPresentation(presCuaderno);
    await catalogRepo.saveProduct(productCuaderno);

    // 3. Stock en almacén (30 unidades a $1.20)
    const purchaseUseCase = new RecordPurchaseEntryUseCase(inventoryRepo);
    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId: prodId,
      quantityUnits: 30,
      unitCostCents: 120,
    });

    // 4. Configuración SRI
    billingRepo.companyConfig = {
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

  it("debe registrar institución educativa y crear lista escolar en borrador", async () => {
    const instUseCase = new CreateSchoolInstitutionUseCase(schoolListRepo);
    const listUseCase = new CreateSchoolListUseCase(schoolListRepo);

    const inst = await instUseCase.execute({
      name: "Colegio San Gabriel",
      city: "Quito",
      regime: "SIERRA",
    });

    const list = await listUseCase.execute({
      institutionId: inst.getId(),
      gradeLevel: "5to de Básica",
      academicYear: "2026-2027",
      studentName: "Alejandro Narváez",
      customerId,
    });

    expect(list.getId()).toBeDefined();
    expect(list.getGradeLevel()).toBe("5to de Básica");
    expect(list.getStatus()).toBe("DRAFT");
  });

  it("debe cotizar la lista verificando stock y generando proforma para WhatsApp", async () => {
    const listUseCase = new CreateSchoolListUseCase(schoolListRepo);
    const quoteUseCase = new QuoteSchoolListUseCase(schoolListRepo, catalogRepo, inventoryRepo);

    const list = await listUseCase.execute({
      gradeLevel: "1ro de Bachillerato",
      academicYear: "2026-2027",
      studentName: "Micaela Paz",
    });

    // Cotizar 4 cuadernos ($2.50 c/u = $10.00 base + 15% IVA = $11.50)
    const quoteResult = await quoteUseCase.execute(list.getId(), warehouse.getId(), [
      {
        productId: productCuaderno.getId(),
        presentationId: presCuaderno.getId(),
        quantity: 4,
      },
    ]);

    expect(quoteResult.schoolList.getStatus()).toBe("QUOTED");
    expect(quoteResult.items[0]!.hasStock).toBe(true);
    expect(quoteResult.subtotal15.toDecimal()).toBe(10.0);
    expect(quoteResult.totalIva.toDecimal()).toBe(1.5);
    expect(quoteResult.totalAmount.toDecimal()).toBe(11.5);

    // Mensaje para WhatsApp contiene título y totales
    expect(quoteResult.whatsAppMessage).toContain("COTIZACIÓN DE LISTA ESCOLAR");
    expect(quoteResult.whatsAppMessage).toContain("Micaela Paz");
    expect(quoteResult.whatsAppMessage).toContain("$11.50 USD");
  });

  it("debe reservar la lista con un anticipo económico en caja y cambiar a RESERVED", async () => {
    const listUseCase = new CreateSchoolListUseCase(schoolListRepo);
    const quoteUseCase = new QuoteSchoolListUseCase(schoolListRepo, catalogRepo, inventoryRepo);
    const openCashUseCase = new OpenCashSessionUseCase(posRepo);
    const reserveUseCase = new ReserveSchoolListUseCase(schoolListRepo, posRepo);

    // 1. Crear y cotizar lista (Total: $11.50)
    const list = await listUseCase.execute({
      gradeLevel: "4to de Básica",
      academicYear: "2026-2027",
      studentName: "Mateo Cruz",
    });

    await quoteUseCase.execute(list.getId(), warehouse.getId(), [
      {
        productId: productCuaderno.getId(),
        presentationId: presCuaderno.getId(),
        quantity: 4,
      },
    ]);

    // 2. Abrir turno de caja
    const session = await openCashUseCase.execute({
      userId,
      terminalCode: "POS-01",
      initialFloatCents: 5000,
    });

    // 3. Padre de familia deja abono de $5.00
    const reserveResult = await reserveUseCase.execute({
      schoolListId: list.getId(),
      cashSessionId: session.getId(),
      amountCents: 500, // $5.00
      paymentMethod: "CASH",
    });

    expect(reserveResult.schoolList.getStatus()).toBe("RESERVED");
    expect(reserveResult.schoolList.getAdvancePayment().toDecimal()).toBe(5.0);
    expect(reserveResult.schoolList.getPendingBalance().toDecimal()).toBe(6.5); // 11.50 - 5.00
    expect(reserveResult.receiptCode).toContain("REC-ANT-2026-");
    expect(schoolListRepo.advances.length).toBe(1);
  });

  it("debe liquidar en 1 clic la lista reservada en mostrador aplicando el anticipo", async () => {
    const listUseCase = new CreateSchoolListUseCase(schoolListRepo);
    const quoteUseCase = new QuoteSchoolListUseCase(schoolListRepo, catalogRepo, inventoryRepo);
    const openCashUseCase = new OpenCashSessionUseCase(posRepo);
    const reserveUseCase = new ReserveSchoolListUseCase(schoolListRepo, posRepo);

    const recordSaleExitUseCase = new RecordSaleExitUseCase(inventoryRepo);
    const createInvoiceUseCase = new CreateElectronicInvoiceUseCase(billingRepo);
    const processCheckoutUseCase = new ProcessSaleCheckoutUseCase(
      posRepo,
      recordSaleExitUseCase,
      createInvoiceUseCase
    );

    const fulfillUseCase = new FulfillSchoolListToSaleUseCase(
      schoolListRepo,
      catalogRepo,
      processCheckoutUseCase
    );

    // 1. Crear, cotizar y reservar lista ($11.50 total con $5.00 de anticipo)
    const list = await listUseCase.execute({
      gradeLevel: "2do de Básica",
      academicYear: "2026-2027",
      studentName: "Joaquín Endara",
    });

    await quoteUseCase.execute(list.getId(), warehouse.getId(), [
      {
        productId: productCuaderno.getId(),
        presentationId: presCuaderno.getId(),
        quantity: 4,
      },
    ]);

    const session = await openCashUseCase.execute({
      userId,
      terminalCode: "POS-01",
      initialFloatCents: 5000,
    });

    await reserveUseCase.execute({
      schoolListId: list.getId(),
      cashSessionId: session.getId(),
      amountCents: 500, // $5.00 abono
      paymentMethod: "CASH",
    });

    // 2. Liquidación en caja: Cliente retira y cancela saldo restante ($6.50) en efectivo
    const fulfillResult = await fulfillUseCase.execute({
      schoolListId: list.getId(),
      cashSessionId: session.getId(),
      warehouseId: warehouse.getId(),
      customerId,
      buyer: {
        idType: "05",
        idNumber: "1712345678",
        legalName: "CARLOS ENDARA",
      },
      settlementPayments: [
        {
          paymentMethod: "CASH",
          amountCents: 650, // $6.50
        },
      ],
    });

    // 3. Verificaciones completas
    // Lista cambia a DISPATCHED
    expect(fulfillResult.schoolList.getStatus()).toBe("DISPATCHED");

    // Venta POS registra tanto el anticipo aplicado como el pago del saldo
    const payments = fulfillResult.checkoutResult.saleOrder.getPayments();
    expect(payments.length).toBe(2);
    expect(payments[0]!.paymentMethod).toBe("CUSTOMER_ADVANCE_APPLIED");
    expect(payments[0]!.amount.toDecimal()).toBe(5.0);
    expect(payments[1]!.paymentMethod).toBe("CASH");
    expect(payments[1]!.amount.toDecimal()).toBe(6.5);

    // Stock deducido en Kardex (30 inicial - 4 = 26)
    const balance = await inventoryRepo.getBalance(warehouse.getId(), productCuaderno.getId());
    expect(balance).not.toBeNull();
    expect(balance!.getCurrentStockUnits()).toBe(26);

    // Factura electrónica emitida en Outbox SRI
    expect(billingRepo.outbox.length).toBe(1);
  });
});
