import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { InventoryMovement } from "../../domain/entities/inventory-movement.entity";
import { InventoryBalance } from "../../domain/entities/inventory-balance.entity";
import { PmpCalculator } from "../../domain/services/pmp-calculator";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface RecordCustomerReturnDto {
  warehouseId: string;
  productId: string;
  quantityUnits: number;
  originalUnitCostCents: number;
  referenceId?: string | null; // ID de la Nota de Crédito o devolución
  referenceCode?: string | null; // Nro. de Nota de Crédito (ej: 001-002-000000045)
  notes?: string | null;
  userId?: string | null;
}

export class RecordCustomerReturnUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(dto: RecordCustomerReturnDto): Promise<InventoryMovement> {
    if (dto.quantityUnits <= 0) {
      throw new ValidationError(
        "La cantidad de devolución debe ser mayor que cero.",
        "INVALID_RETURN_QUANTITY"
      );
    }

    if (dto.originalUnitCostCents < 0) {
      throw new ValidationError(
        "El costo unitario original de la devolución no puede ser negativo.",
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

    let currentBalance = await this.inventoryRepo.getBalanceForUpdate(
      dto.warehouseId,
      dto.productId
    );

    if (!currentBalance) {
      currentBalance = InventoryBalance.createEmpty(dto.warehouseId, dto.productId);
    }

    const returnUnitCost = Money.fromCents(dto.originalUnitCostCents);

    // Reincorporar unidades y recalcular PMP ponderado
    const pmpResult = PmpCalculator.calculateOnEntry({
      currentStockUnits: currentBalance.getCurrentStockUnits(),
      currentPmp: currentBalance.getCurrentPmp(),
      incomingUnits: dto.quantityUnits,
      incomingUnitCost: returnUnitCost,
    });

    const movement = InventoryMovement.create({
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: "CUSTOMER_RETURN",
      quantityUnits: dto.quantityUnits,
      unitCost: returnUnitCost,
      averageCost: pmpResult.newPmp,
      balanceUnits: pmpResult.newStockUnits,
      referenceId: dto.referenceId,
      referenceCode: dto.referenceCode,
      notes: dto.notes,
      userId: dto.userId,
    });

    currentBalance.update(pmpResult.newStockUnits, pmpResult.newPmp);

    await this.inventoryRepo.recordMovementAndUpdateBalance(movement, currentBalance);

    return movement;
  }
}
