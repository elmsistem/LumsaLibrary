import { eq, and, gte, lte, asc, count } from "drizzle-orm";
import { AppDatabase, Money } from "@/modules/core/public-api";
import { Warehouse } from "../../domain/entities/warehouse.entity";
import {
  InventoryMovement,
  InventoryMovementType,
} from "../../domain/entities/inventory-movement.entity";
import { InventoryBalance } from "../../domain/entities/inventory-balance.entity";
import {
  InventoryRepository,
  KardexFilterParams,
} from "../../domain/repositories/inventory.repository";
import {
  warehouses,
  inventoryMovements,
  inventoryBalances,
  WarehouseRow,
  InventoryMovementRow,
  InventoryBalanceRow,
} from "../database/schema/inventory.schema";

export class DrizzleInventoryRepository implements InventoryRepository {
  constructor(private readonly db: AppDatabase) {}

  public async findWarehouseById(id: string): Promise<Warehouse | null> {
    const rows = await this.db
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toWarehouseDomain(row);
  }

  public async findWarehouseByCode(code: string): Promise<Warehouse | null> {
    const rows = await this.db
      .select()
      .from(warehouses)
      .where(eq(warehouses.code, code.toUpperCase()))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toWarehouseDomain(row);
  }

  public async saveWarehouse(warehouse: Warehouse): Promise<void> {
    await this.db
      .insert(warehouses)
      .values({
        id: warehouse.getId(),
        name: warehouse.getName(),
        code: warehouse.getCode(),
        address: warehouse.getAddress(),
        isActive: warehouse.getIsActive(),
        createdAt: warehouse.getCreatedAt(),
      })
      .onConflictDoUpdate({
        target: warehouses.id,
        set: {
          name: warehouse.getName(),
          address: warehouse.getAddress(),
          isActive: warehouse.getIsActive(),
        },
      });
  }

  public async listWarehouses(): Promise<Warehouse[]> {
    const rows = await this.db.select().from(warehouses);
    return rows.map((r) => this.toWarehouseDomain(r));
  }

  public async getBalance(
    warehouseId: string,
    productId: string
  ): Promise<InventoryBalance | null> {
    const rows = await this.db
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.warehouseId, warehouseId),
          eq(inventoryBalances.productId, productId)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toBalanceDomain(row);
  }

  public async getBalanceForUpdate(
    warehouseId: string,
    productId: string
  ): Promise<InventoryBalance | null> {
    const rows = await this.db
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.warehouseId, warehouseId),
          eq(inventoryBalances.productId, productId)
        )
      )
      .for("update")
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toBalanceDomain(row);
  }

  public async recordMovementAndUpdateBalance(
    movement: InventoryMovement,
    newBalance: InventoryBalance
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Insertar movimiento inmutable en Kardex (PROHIBIDO UPDATE)
      await tx.insert(inventoryMovements).values({
        id: movement.getId(),
        warehouseId: movement.getWarehouseId(),
        productId: movement.getProductId(),
        movementType: movement.getMovementType(),
        quantityUnits: movement.getQuantityUnits().toFixed(4),
        unitCostCents: movement.getUnitCost().getCents(),
        averageCostCents: movement.getAverageCost().getCents(),
        balanceUnits: movement.getBalanceUnits().toFixed(4),
        referenceId: movement.getReferenceId(),
        referenceCode: movement.getReferenceCode(),
        notes: movement.getNotes(),
        userId: movement.getUserId(),
        createdAt: movement.getCreatedAt(),
      });

      // 2. Sincronizar snapshot de balance atómicamente
      await tx
        .insert(inventoryBalances)
        .values({
          warehouseId: newBalance.getWarehouseId(),
          productId: newBalance.getProductId(),
          currentStockUnits: newBalance.getCurrentStockUnits().toFixed(4),
          currentPmpCents: newBalance.getCurrentPmp().getCents(),
          updatedAt: newBalance.getUpdatedAt(),
        })
        .onConflictDoUpdate({
          target: [inventoryBalances.warehouseId, inventoryBalances.productId],
          set: {
            currentStockUnits: newBalance.getCurrentStockUnits().toFixed(4),
            currentPmpCents: newBalance.getCurrentPmp().getCents(),
            updatedAt: newBalance.getUpdatedAt(),
          },
        });
    });
  }

  public async getKardexHistory(filters: KardexFilterParams): Promise<InventoryMovement[]> {
    const conditions = [eq(inventoryMovements.productId, filters.productId)];

    if (filters.warehouseId) {
      conditions.push(eq(inventoryMovements.warehouseId, filters.warehouseId));
    }
    if (filters.movementType) {
      conditions.push(eq(inventoryMovements.movementType, filters.movementType));
    }
    if (filters.from) {
      conditions.push(gte(inventoryMovements.createdAt, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(inventoryMovements.createdAt, filters.to));
    }

    const rows = await this.db
      .select()
      .from(inventoryMovements)
      .where(and(...conditions))
      .orderBy(asc(inventoryMovements.createdAt))
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0);

    return rows.map((r) => this.toMovementDomain(r));
  }

  public async countKardexHistory(
    filters: Omit<KardexFilterParams, "limit" | "offset">
  ): Promise<number> {
    const conditions = [eq(inventoryMovements.productId, filters.productId)];

    if (filters.warehouseId) {
      conditions.push(eq(inventoryMovements.warehouseId, filters.warehouseId));
    }
    if (filters.movementType) {
      conditions.push(eq(inventoryMovements.movementType, filters.movementType));
    }
    if (filters.from) {
      conditions.push(gte(inventoryMovements.createdAt, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(inventoryMovements.createdAt, filters.to));
    }

    const result = await this.db
      .select({ total: count() })
      .from(inventoryMovements)
      .where(and(...conditions));

    return result[0]?.total ?? 0;
  }

  // --- Mapeadores de Dominio ---

  private toWarehouseDomain(row: WarehouseRow): Warehouse {
    return Warehouse.reconstitute({
      id: row.id,
      name: row.name,
      code: row.code,
      address: row.address,
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  }

  private toBalanceDomain(row: InventoryBalanceRow): InventoryBalance {
    return InventoryBalance.reconstitute({
      warehouseId: row.warehouseId,
      productId: row.productId,
      currentStockUnits: parseFloat(row.currentStockUnits),
      currentPmp: Money.fromCents(row.currentPmpCents),
      updatedAt: row.updatedAt,
    });
  }

  private toMovementDomain(row: InventoryMovementRow): InventoryMovement {
    return InventoryMovement.reconstitute({
      id: row.id,
      warehouseId: row.warehouseId,
      productId: row.productId,
      movementType: row.movementType as InventoryMovementType,
      quantityUnits: parseFloat(row.quantityUnits),
      unitCost: Money.fromCents(row.unitCostCents),
      averageCost: Money.fromCents(row.averageCostCents),
      balanceUnits: parseFloat(row.balanceUnits),
      referenceId: row.referenceId,
      referenceCode: row.referenceCode,
      notes: row.notes,
      userId: row.userId,
      createdAt: row.createdAt,
    });
  }
}
