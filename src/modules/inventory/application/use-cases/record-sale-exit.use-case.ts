import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { InventoryMovement } from "../../domain/entities/inventory-movement.entity";
import { PmpCalculator } from "../../domain/services/pmp-calculator";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface RecordSaleExitDto {
  warehouseId: string;
  productId: string;
  quantityUnits: number;
  referenceId?: string | null;
  referenceCode?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export class RecordSaleExitUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(dto: RecordSaleExitDto): Promise<InventoryMovement> {
    if (dto.quantityUnits <= 0) {
      throw new ValidationError(
        "La cantidad de venta debe ser mayor que cero.",
        "INVALID_SALE_QUANTITY"
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

    // Bloqueo pesimista para evitar carreras entre terminales de venta concurrentes
    const currentBalance = await this.inventoryRepo.getBalanceForUpdate(
      dto.warehouseId,
      dto.productId
    );

    if (!currentBalance || currentBalance.getCurrentStockUnits() < dto.quantityUnits) {
      const available = currentBalance ? currentBalance.getCurrentStockUnits() : 0;
      throw new ValidationError(
        `Stock insuficiente en almacén "${warehouse.getName()}". Disponible: ${available}, Solicitado: ${dto.quantityUnits}`,
        "INSUFFICIENT_STOCK"
      );
    }

    const exitResult = PmpCalculator.calculateOnExit(
      currentBalance.getCurrentStockUnits(),
      currentBalance.getCurrentPmp(),
      dto.quantityUnits
    );

    // En Kardex la salida se registra con signo negativo
    const movement = InventoryMovement.create({
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: "SALE_EXIT",
      quantityUnits: -dto.quantityUnits,
      unitCost: exitResult.exitCost,
      averageCost: exitResult.pmp,
      balanceUnits: exitResult.newStockUnits,
      referenceId: dto.referenceId,
      referenceCode: dto.referenceCode,
      notes: dto.notes,
      userId: dto.userId,
    });

    currentBalance.update(exitResult.newStockUnits, exitResult.pmp);

    await this.inventoryRepo.recordMovementAndUpdateBalance(movement, currentBalance);

    return movement;
  }
}
