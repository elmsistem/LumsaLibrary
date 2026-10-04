import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { InventoryMovement } from "../../domain/entities/inventory-movement.entity";
import { InventoryBalance } from "../../domain/entities/inventory-balance.entity";
import { PmpCalculator } from "../../domain/services/pmp-calculator";
import { ValidationError } from "../../../core/domain/errors/domain-error";
import { Money } from "../../../core/domain/value-objects/money.vo";

export interface RecordPhysicalAdjustmentDto {
  warehouseId: string;
  productId: string;
  countedStockUnits: number;
  reason: string;
  userId?: string | null;
}

export class RecordPhysicalAdjustmentUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(dto: RecordPhysicalAdjustmentDto): Promise<InventoryMovement | null> {
    if (dto.countedStockUnits < 0) {
      throw new ValidationError(
        "El conteo físico de stock no puede ser negativo.",
        "INVALID_COUNTED_STOCK"
      );
    }

    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new ValidationError(
        "Debe especificar la justificación del ajuste por toma física (mínimo 5 caracteres).",
        "INVALID_ADJUSTMENT_REASON"
      );
    }

    const warehouse = await this.inventoryRepo.findWarehouseById(dto.warehouseId);
    if (!warehouse) {
      throw new ValidationError(
        `Almacén con ID ${dto.warehouseId} no encontrado.`,
        "WAREHOUSE_NOT_FOUND"
      );
    }

    let currentBalance = await this.inventoryRepo.getBalanceForUpdate(
      dto.warehouseId,
      dto.productId
    );

    if (!currentBalance) {
      currentBalance = InventoryBalance.createEmpty(dto.warehouseId, dto.productId);
    }

    const currentStock = currentBalance.getCurrentStockUnits();
    const difference = Math.round((dto.countedStockUnits - currentStock) * 10000) / 10000;

    // Si no hay diferencia entre el conteo físico y el sistema, no se genera movimiento
    if (difference === 0) {
      return null;
    }

    const currentPmp = currentBalance.getCurrentPmp();

    if (difference > 0) {
      // Ajuste positivo: Se encontraron más unidades físicas
      const pmpResult = PmpCalculator.calculateOnEntry({
        currentStockUnits: currentStock,
        currentPmp,
        incomingUnits: difference,
        incomingUnitCost: currentPmp.getCents() > 0 ? currentPmp : Money.zero(),
      });

      const movement = InventoryMovement.create({
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        movementType: "PHYSICAL_COUNT_ADJUSTMENT",
        quantityUnits: difference,
        unitCost: currentPmp,
        averageCost: pmpResult.newPmp,
        balanceUnits: pmpResult.newStockUnits,
        notes: `AJUSTE FÍSICO POSITIVO (+${difference}): ${dto.reason.trim()}`,
        userId: dto.userId,
      });

      currentBalance.update(pmpResult.newStockUnits, pmpResult.newPmp);
      await this.inventoryRepo.recordMovementAndUpdateBalance(movement, currentBalance);
      return movement;
    } else {
      // Ajuste negativo: Faltaron unidades físicas (diferencia es negativa)
      const outgoingUnits = Math.abs(difference);
      const exitResult = PmpCalculator.calculateOnExit(
        currentStock,
        currentPmp,
        outgoingUnits
      );

      const movement = InventoryMovement.create({
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        movementType: "PHYSICAL_COUNT_ADJUSTMENT",
        quantityUnits: difference, // Negativo
        unitCost: exitResult.exitCost,
        averageCost: exitResult.pmp,
        balanceUnits: exitResult.newStockUnits,
        notes: `AJUSTE FÍSICO NEGATIVO (${difference}): ${dto.reason.trim()}`,
        userId: dto.userId,
      });

      currentBalance.update(exitResult.newStockUnits, exitResult.pmp);
      await this.inventoryRepo.recordMovementAndUpdateBalance(movement, currentBalance);
      return movement;
    }
  }
}
