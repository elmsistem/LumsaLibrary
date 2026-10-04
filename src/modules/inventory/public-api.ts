// --- Domain ---
export { Warehouse, type CreateWarehouseProps } from "./domain/entities/warehouse.entity";
export {
  InventoryMovement,
  type InventoryMovementType,
  type CreateMovementProps,
} from "./domain/entities/inventory-movement.entity";
export { InventoryBalance } from "./domain/entities/inventory-balance.entity";
export {
  PmpCalculator,
  type PmpCalculationInput,
  type PmpCalculationResult,
} from "./domain/services/pmp-calculator";
export {
  type InventoryRepository,
  type KardexFilterParams,
} from "./domain/repositories/inventory.repository";

// --- Application ---
export {
  RecordPurchaseEntryUseCase,
  type RecordPurchaseEntryDto,
} from "./application/use-cases/record-purchase-entry.use-case";
export {
  RecordSaleExitUseCase,
  type RecordSaleExitDto,
} from "./application/use-cases/record-sale-exit.use-case";
export {
  RecordCustomerReturnUseCase,
  type RecordCustomerReturnDto,
} from "./application/use-cases/record-customer-return.use-case";
export {
  RecordDamageExitUseCase,
  type RecordDamageExitDto,
} from "./application/use-cases/record-damage-exit.use-case";
export {
  RecordPhysicalAdjustmentUseCase,
  type RecordPhysicalAdjustmentDto,
} from "./application/use-cases/record-physical-adjustment.use-case";
export {
  GetProductKardexUseCase,
  type GetProductKardexDto,
  type KardexQueryResult,
} from "./application/use-cases/get-product-kardex.use-case";
export { GetProductBalanceUseCase } from "./application/use-cases/get-product-balance.use-case";
export {
  CreateWarehouseUseCase,
  type CreateWarehouseDto,
} from "./application/use-cases/create-warehouse.use-case";

// --- Infrastructure ---
export {
  warehouses,
  inventoryMovements,
  inventoryBalances,
  inventoryMovementTypeEnum,
  type WarehouseRow,
  type InventoryMovementRow,
  type InventoryBalanceRow,
} from "./infrastructure/database/schema/inventory.schema";
export { DrizzleInventoryRepository } from "./infrastructure/persistence/drizzle-inventory.repository";
