import { describe, it, expect, beforeEach } from "vitest";
import {
  InventoryRepository,
  KardexFilterParams,
} from "../../domain/repositories/inventory.repository";
import { Warehouse } from "../../domain/entities/warehouse.entity";
import {
  InventoryMovement,
} from "../../domain/entities/inventory-movement.entity";
import { InventoryBalance } from "../../domain/entities/inventory-balance.entity";
import { RecordPurchaseEntryUseCase } from "./record-purchase-entry.use-case";
import { RecordSaleExitUseCase } from "./record-sale-exit.use-case";
import { RecordCustomerReturnUseCase } from "./record-customer-return.use-case";
import { RecordDamageExitUseCase } from "./record-damage-exit.use-case";
import { RecordPhysicalAdjustmentUseCase } from "./record-physical-adjustment.use-case";
import { GetProductKardexUseCase } from "./get-product-kardex.use-case";
import { CreateWarehouseUseCase } from "./create-warehouse.use-case";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

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

  public async getBalance(
    warehouseId: string,
    productId: string
  ): Promise<InventoryBalance | null> {
    const key = `${warehouseId}:${productId}`;
    return this.balances.get(key) || null;
  }

  public async getBalanceForUpdate(
    warehouseId: string,
    productId: string
  ): Promise<InventoryBalance | null> {
    return this.getBalance(warehouseId, productId);
  }

  public async recordMovementAndUpdateBalance(
    movement: InventoryMovement,
    newBalance: InventoryBalance
  ): Promise<void> {
    this.movements.push(movement);
    const key = `${newBalance.getWarehouseId()}:${newBalance.getProductId()}`;
    this.balances.set(key, newBalance);
  }

  public async getKardexHistory(filters: KardexFilterParams): Promise<InventoryMovement[]> {
    let result = this.movements.filter((m) => m.getProductId() === filters.productId);

    if (filters.warehouseId) {
      result = result.filter((m) => m.getWarehouseId() === filters.warehouseId);
    }
    if (filters.movementType) {
      result = result.filter((m) => m.getMovementType() === filters.movementType);
    }

    result.sort((a, b) => a.getCreatedAt().getTime() - b.getCreatedAt().getTime());

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 100;
    return result.slice(offset, offset + limit);
  }

  public async countKardexHistory(
    filters: Omit<KardexFilterParams, "limit" | "offset">
  ): Promise<number> {
    let result = this.movements.filter((m) => m.getProductId() === filters.productId);
    if (filters.warehouseId) {
      result = result.filter((m) => m.getWarehouseId() === filters.warehouseId);
    }
    if (filters.movementType) {
      result = result.filter((m) => m.getMovementType() === filters.movementType);
    }
    return result.length;
  }
}

describe("Inventory Application Use Cases (Kardex Inmutable)", () => {
  let repo: InMemoryInventoryRepository;
  let warehouse: Warehouse;
  const productId = generateUUIDv7();

  beforeEach(async () => {
    repo = new InMemoryInventoryRepository();
    const createWh = new CreateWarehouseUseCase(repo);
    warehouse = await createWh.execute({
      name: "Bodega Matriz - Papelería Central",
      code: "MATRIZ",
      address: "Av. 10 de Agosto y Colón, Quito",
    });
  });

  it("debe registrar compras sucesivas y calcular el PMP exacto del SRI", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);

    // Compra 1: 100 cuadernos a $1.00 (100 centavos)
    const mov1 = await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 100,
      unitCostCents: 100,
      referenceCode: "FAC-001-100",
    });

    expect(mov1.getMovementType()).toBe("PURCHASE_ENTRY");
    expect(mov1.getQuantityUnits()).toBe(100);
    expect(mov1.getBalanceUnits()).toBe(100);
    expect(mov1.getAverageCost().getCents()).toBe(100);

    // Compra 2: 100 cuadernos a $2.00 (200 centavos)
    // Nuevo PMP: ((100 * 100) + (100 * 200)) / 200 = 150 centavos ($1.50)
    const mov2 = await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 100,
      unitCostCents: 200,
      referenceCode: "FAC-001-105",
    });

    expect(mov2.getBalanceUnits()).toBe(200);
    expect(mov2.getAverageCost().getCents()).toBe(150);
    expect(mov2.getAverageCost().getDollars()).toBe(1.5);

    // Verificar balance snapshot
    const balance = await repo.getBalance(warehouse.getId(), productId);
    expect(balance).not.toBeNull();
    expect(balance!.getCurrentStockUnits()).toBe(200);
    expect(balance!.getCurrentPmp().getCents()).toBe(150);
  });

  it("debe registrar salidas por venta al PMP vigente sin alterar el costo unitario promedio", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);
    const saleUseCase = new RecordSaleExitUseCase(repo);

    // Compra inicial: 50 lápices a $0.50 (50 centavos)
    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 50,
      unitCostCents: 50,
    });

    // Venta: 15 lápices
    const saleMov = await saleUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 15,
      referenceCode: "TICKET-0001",
    });

    expect(saleMov.getMovementType()).toBe("SALE_EXIT");
    expect(saleMov.getQuantityUnits()).toBe(-15); // Negativo en Kardex
    expect(saleMov.getBalanceUnits()).toBe(35);
    expect(saleMov.getUnitCost().getCents()).toBe(50);
    expect(saleMov.getAverageCost().getCents()).toBe(50); // PMP no cambia con ventas

    const balance = await repo.getBalance(warehouse.getId(), productId);
    expect(balance!.getCurrentStockUnits()).toBe(35);
    expect(balance!.getCurrentPmp().getCents()).toBe(50);
  });

  it("debe bloquear y lanzar INSUFFICIENT_STOCK si se intenta vender más de lo disponible", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);
    const saleUseCase = new RecordSaleExitUseCase(repo);

    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 5,
      unitCostCents: 100,
    });

    await expect(
      saleUseCase.execute({
        warehouseId: warehouse.getId(),
        productId,
        quantityUnits: 6, // 6 > 5
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      saleUseCase.execute({
        warehouseId: warehouse.getId(),
        productId,
        quantityUnits: 6,
      })
    ).rejects.toThrow(/Stock insuficiente/);
  });

  it("debe registrar devoluciones de clientes (Notas de Crédito) reingresando unidades al costo de venta original", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);
    const saleUseCase = new RecordSaleExitUseCase(repo);
    const returnUseCase = new RecordCustomerReturnUseCase(repo);

    // 1. Compra 20 carpetas a $2.00 (200 centavos)
    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 20,
      unitCostCents: 200,
    });

    // 2. Venta 10 carpetas
    await saleUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 10,
    });

    // Stock restante: 10 a $2.00
    // 3. Cliente devuelve 2 carpetas de esa venta
    const returnMov = await returnUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 2,
      originalUnitCostCents: 200,
      referenceCode: "NC-001-002-000000001",
      notes: "Devolución por cambio de asignatura",
    });

    expect(returnMov.getMovementType()).toBe("CUSTOMER_RETURN");
    expect(returnMov.getQuantityUnits()).toBe(2);
    expect(returnMov.getBalanceUnits()).toBe(12);
    expect(returnMov.getAverageCost().getCents()).toBe(200);

    const balance = await repo.getBalance(warehouse.getId(), productId);
    expect(balance!.getCurrentStockUnits()).toBe(12);
  });

  it("debe registrar mermas o daños en papelería con justificación obligatoria", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);
    const damageUseCase = new RecordDamageExitUseCase(repo);

    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 10,
      unitCostCents: 300,
    });

    const damageMov = await damageUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 1,
      reason: "Cartulina rota por humedad en vitrina",
    });

    expect(damageMov.getMovementType()).toBe("INTERNAL_DAMAGE");
    expect(damageMov.getQuantityUnits()).toBe(-1);
    expect(damageMov.getBalanceUnits()).toBe(9);
    expect(damageMov.getNotes()).toContain("MERMA / DAÑO");

    const balance = await repo.getBalance(warehouse.getId(), productId);
    expect(balance!.getCurrentStockUnits()).toBe(9);
  });

  it("debe procesar ajustes por toma física de inventario (positivos y negativos)", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);
    const adjustmentUseCase = new RecordPhysicalAdjustmentUseCase(repo);

    // Compra 10 unidades
    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 10,
      unitCostCents: 100,
    });

    // Caso 1: Conteo físico indica 12 (faltaban 2 por registrar)
    const adjPositivo = await adjustmentUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      countedStockUnits: 12,
      reason: "Auditoría anual de inventario físico",
    });

    expect(adjPositivo).not.toBeNull();
    expect(adjPositivo!.getQuantityUnits()).toBe(2);
    expect(adjPositivo!.getBalanceUnits()).toBe(12);

    // Caso 2: Conteo físico coincide exactamente con sistema
    const adjNeutro = await adjustmentUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      countedStockUnits: 12,
      reason: "Verificación de rutina",
    });
    expect(adjNeutro).toBeNull(); // Sin movimiento innecesario

    // Caso 3: Conteo físico indica 10 (faltante de 2 unidades)
    const adjNegativo = await adjustmentUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      countedStockUnits: 10,
      reason: "Pérdida en mostrador",
    });

    expect(adjNegativo).not.toBeNull();
    expect(adjNegativo!.getQuantityUnits()).toBe(-2);
    expect(adjNegativo!.getBalanceUnits()).toBe(10);
  });

  it("debe consultar la sábana histórica completa del Kardex para auditoría del SRI", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);
    const saleUseCase = new RecordSaleExitUseCase(repo);
    const kardexQuery = new GetProductKardexUseCase(repo);

    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 50,
      unitCostCents: 100,
    });

    await saleUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 10,
    });

    await saleUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 5,
    });

    const result = await kardexQuery.execute({
      productId,
      warehouseId: warehouse.getId(),
    });

    expect(result.totalCount).toBe(3);
    expect(result.items.length).toBe(3);
    expect(result.items[0]!.getMovementType()).toBe("PURCHASE_ENTRY");
    expect(result.items[1]!.getMovementType()).toBe("SALE_EXIT");
    expect(result.items[2]!.getMovementType()).toBe("SALE_EXIT");
  });

  it("debe proteger contra sobreventa cuando se solicitan ventas hasta agotar stock", async () => {
    const purchaseUseCase = new RecordPurchaseEntryUseCase(repo);
    const saleUseCase = new RecordSaleExitUseCase(repo);

    // Stock: 5 unidades
    await purchaseUseCase.execute({
      warehouseId: warehouse.getId(),
      productId,
      quantityUnits: 5,
      unitCostCents: 100,
    });

    // Simular 8 intentos de venta de 1 unidad
    let successfulSales = 0;
    let failedSales = 0;

    for (let i = 0; i < 8; i++) {
      try {
        await saleUseCase.execute({
          warehouseId: warehouse.getId(),
          productId,
          quantityUnits: 1,
        });
        successfulSales++;
      } catch {
        failedSales++;
      }
    }

    expect(successfulSales).toBe(5);
    expect(failedSales).toBe(3);

    const balance = await repo.getBalance(warehouse.getId(), productId);
    expect(balance!.getCurrentStockUnits()).toBe(0);
  });
});
