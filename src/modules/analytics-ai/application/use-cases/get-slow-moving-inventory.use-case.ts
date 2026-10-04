import {
  AnalyticsRepository,
  SlowMovingItemData,
} from "../../domain/repositories/analytics.repository";

export interface GetSlowMovingInventoryInput {
  minDaysInactive?: number;
  warehouseId?: string;
  limit?: number;
}

/**
 * Caso de Uso: Reporte de Inventario de Baja Rotación (Hueso) y Capital Inmovilizado.
 */
export class GetSlowMovingInventoryUseCase {
  constructor(private readonly analyticsRepo: AnalyticsRepository) {}

  public async execute(input: GetSlowMovingInventoryInput = {}): Promise<SlowMovingItemData[]> {
    const minDays = input.minDaysInactive ?? 90;
    const limit = input.limit ?? 50;

    return this.analyticsRepo.getSlowMovingInventory(minDays, input.warehouseId, limit);
  }
}
