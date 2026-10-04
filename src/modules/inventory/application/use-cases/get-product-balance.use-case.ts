import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { InventoryBalance } from "../../domain/entities/inventory-balance.entity";
import { assertUUID } from "../../../core/domain/value-objects/uuid.vo";

export class GetProductBalanceUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(
    warehouseId: string,
    productId: string
  ): Promise<InventoryBalance> {
    assertUUID(warehouseId, "ID de almacén inválido.");
    assertUUID(productId, "ID de producto inválido.");

    const balance = await this.inventoryRepo.getBalance(warehouseId, productId);
    if (!balance) {
      return InventoryBalance.createEmpty(warehouseId, productId);
    }
    return balance;
  }
}
