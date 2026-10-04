import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { InventoryMovement } from "../../domain/entities/inventory-movement.entity";
import { InventoryBalance } from "../../domain/entities/inventory-balance.entity";
import { PmpCalculator } from "../../domain/services/pmp-calculator";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface RecordPurchaseEntryDto {
  warehouseId: string;
  productId: string;
  quantityUnits: number;
  unitCostCents: number;
  referenceId?: string | null;
  referenceCode?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export class RecordPurchaseEntryUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(dto: RecordPurchaseEntryDto): Promise<InventoryMovement> {
    if (dto.quantityUnits <= 0) {
      throw new ValidationError(
        "La cantidad de compra a ingresar debe ser mayor que cero.",
        "INVALID_PURCHASE_QUANTITY"
      );
    }

    if (dto.unitCostCents < 0) {
      throw new ValidationError(
        "El costo unitario de compra no puede ser negativo.",
        "INVALID_UNIT_COST"
      );
    }

    const warehouse = await this.inventoryRepo.findWarehouseById(dto.warehouseId);
    if (!warehouse) {
      throw new ValidationError(
        `Almacén con ID ${dto.warehouseId} no encontrado.`,
        "WAREHOUSE_NOT_FOUND"
      );
    }

    if (!warehouse.getIsActive()) {
      throw new ValidationError(
        `El almacén "${warehouse.getName()}" se encuentra inactivo.`,
        "WAREHOUSE_INACTIVE"
      );
    }

    // Obtener balance actual con bloqueo pesimista
    let currentBalance = await this.inventoryRepo.getBalanceForUpdate(
      dto.warehouseId,
      dto.productId
    );

    if (!currentBalance) {
      currentBalance = InventoryBalance.createEmpty(dto.warehouseId, dto.productId);
    }

    const incomingUnitCost = Money.fromCents(dto.unitCostCents);

    // Calcular nuevo PMP y nuevo stock
    const pmpResult = PmpCalculator.calculateOnEntry({
      currentStockUnits: currentBalance.getCurrentStockUnits(),
      currentPmp: currentBalance.getCurrentPmp(),
      incomingUnits: dto.quantityUnits,
      incomingUnitCost,
    });

    // Crear movimiento inmutable
    const movement = InventoryMovement.create({
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: "PURCHASE_ENTRY",
      quantityUnits: dto.quantityUnits,
      unitCost: incomingUnitCost,
      averageCost: pmpResult.newPmp,
      balanceUnits: pmpResult.newStockUnits,
      referenceId: dto.referenceId,
      referenceCode: dto.referenceCode,
      notes: dto.notes,
      userId: dto.userId,
    });

    // Actualizar balance snapshot
    currentBalance.update(pmpResult.newStockUnits, pmpResult.newPmp);

    // Persistir atómicamente
    await this.inventoryRepo.recordMovementAndUpdateBalance(movement, currentBalance);

    return movement;
  }
}
