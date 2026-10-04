import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { Warehouse } from "../../domain/entities/warehouse.entity";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface CreateWarehouseDto {
  name: string;
  code: string;
  address?: string | null;
}

export class CreateWarehouseUseCase {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  public async execute(dto: CreateWarehouseDto): Promise<Warehouse> {
    const existingCode = await this.inventoryRepo.findWarehouseByCode(dto.code);
    if (existingCode) {
      throw new ValidationError(
        `Ya existe un almacén con el código "${dto.code}".`,
        "WAREHOUSE_CODE_ALREADY_EXISTS"
      );
    }

    const warehouse = Warehouse.create({
      name: dto.name,
      code: dto.code,
      address: dto.address,
    });

    await this.inventoryRepo.saveWarehouse(warehouse);
    return warehouse;
  }
}
