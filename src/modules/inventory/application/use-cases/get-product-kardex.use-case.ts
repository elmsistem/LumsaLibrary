import { InventoryRepository, KardexFilterParams } from "../../domain/repositories/inventory.repository";
import { InventoryMovement } from "../../domain/entities/inventory-movement.entity";
import { assertUUID } from "../../../core/domain/value-objects/uuid.vo";

export type GetProductKardexDto = KardexFilterParams;

export interface KardexQueryResult {
  items: InventoryMovement[];
  totalCount: number;
}

export class GetProductKardexUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(dto: GetProductKardexDto): Promise<KardexQueryResult> {
    assertUUID(dto.productId, "ID de producto inválido.");

    if (dto.warehouseId) {
      assertUUID(dto.warehouseId, "ID de almacén inválido.");
    }

    const [items, totalCount] = await Promise.all([
      this.inventoryRepo.getKardexHistory(dto),
      this.inventoryRepo.countKardexHistory({
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        from: dto.from,
        to: dto.to,
        movementType: dto.movementType,
      }),
    ]);

    return {
      items,
      totalCount,
    };
  }
}
