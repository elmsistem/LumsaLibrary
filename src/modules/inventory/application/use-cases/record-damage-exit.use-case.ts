import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { InventoryMovement } from "../../domain/entities/inventory-movement.entity";
import { PmpCalculator } from "../../domain/services/pmp-calculator";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface RecordDamageExitDto {
  warehouseId: string;
  productId: string;
  quantityUnits: number;
  reason: string;
  userId?: string | null;
}

export class RecordDamageExitUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(dto: RecordDamageExitDto): Promise<InventoryMovement> {
    if (dto.quantityUnits <= 0) {
      throw new ValidationError(
        "La cantidad de unidades dañadas o merma debe ser mayor que cero.",
        "INVALID_DAMAGE_QUANTITY"
      );
    }

    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new ValidationError(
        "Debe especificar el motivo o justificación de la merma (mínimo 5 caracteres).",
        "INVALID_DAMAGE_REASON"
      );
    }

    const warehouse = await this.inventoryRepo.findWarehouseById(dto.warehouseId);
    if (!warehouse) {
      throw new ValidationError(
        `Almacén con ID ${dto.warehouseId} no encontrado.`,
        "WAREHOUSE_NOT_FOUND"
      );
    }

    const currentBalance = await this.inventoryRepo.getBalanceForUpdate(
      dto.warehouseId,
      dto.productId
    );

    if (!currentBalance || currentBalance.getCurrentStockUnits() < dto.quantityUnits) {
      const available = currentBalance ? currentBalance.getCurrentStockUnits() : 0;
      throw new ValidationError(
        `Stock insuficiente para registrar merma. Disponible: ${available}, Solicitado: ${dto.quantityUnits}`,
        "INSUFFICIENT_STOCK"
      );
    }

    const exitResult = PmpCalculator.calculateOnExit(
      currentBalance.getCurrentStockUnits(),
      currentBalance.getCurrentPmp(),
      dto.quantityUnits
    );

    const movement = InventoryMovement.create({
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: "INTERNAL_DAMAGE",
      quantityUnits: -dto.quantityUnits,
      unitCost: exitResult.exitCost,
      averageCost: exitResult.pmp,
      balanceUnits: exitResult.newStockUnits,
      notes: `MERMA / DAÑO: ${dto.reason.trim()}`,
      userId: dto.userId,
    });

    currentBalance.update(exitResult.newStockUnits, exitResult.pmp);

    await this.inventoryRepo.recordMovementAndUpdateBalance(movement, currentBalance);

    return movement;
  }
}
