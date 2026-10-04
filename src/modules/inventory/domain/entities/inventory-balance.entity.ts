import { assertUUID } from "../../../core/domain/value-objects/uuid.vo";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export class InventoryBalance {
  private readonly warehouseId: string;
  private readonly productId: string;
  private currentStockUnits: number;
  private currentPmp: Money;
  private updatedAt: Date;

  private constructor(props: {
    warehouseId: string;
    productId: string;
    currentStockUnits: number;
    currentPmp: Money;
    updatedAt: Date;
  }) {
    this.warehouseId = props.warehouseId;
    this.productId = props.productId;
    this.currentStockUnits = props.currentStockUnits;
    this.currentPmp = props.currentPmp;
    this.updatedAt = props.updatedAt;
  }

  public static createEmpty(warehouseId: string, productId: string): InventoryBalance {
    assertUUID(warehouseId, "ID de almacén inválido.");
    assertUUID(productId, "ID de producto inválido.");

    return new InventoryBalance({
      warehouseId,
      productId,
      currentStockUnits: 0,
      currentPmp: Money.zero(),
      updatedAt: new Date(),
    });
  }

  public static reconstitute(props: {
    warehouseId: string;
    productId: string;
    currentStockUnits: number;
    currentPmp: Money;
    updatedAt: Date;
  }): InventoryBalance {
    assertUUID(props.warehouseId, "ID de almacén inválido.");
    assertUUID(props.productId, "ID de producto inválido.");

    if (props.currentStockUnits < 0) {
      throw new ValidationError(
        "El stock en balance no puede ser negativo.",
        "NEGATIVE_STOCK_NOT_ALLOWED"
      );
    }

    return new InventoryBalance(props);
  }

  public getWarehouseId(): string {
    return this.warehouseId;
  }

  public getProductId(): string {
    return this.productId;
  }

  public getCurrentStockUnits(): number {
    return this.currentStockUnits;
  }

  public getCurrentPmp(): Money {
    return this.currentPmp;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public update(newStockUnits: number, newPmp: Money): void {
    if (newStockUnits < 0) {
      throw new ValidationError(
        "El nuevo stock no puede ser negativo.",
        "NEGATIVE_STOCK_NOT_ALLOWED"
      );
    }
    this.currentStockUnits = Math.round(newStockUnits * 10000) / 10000;
    this.currentPmp = newPmp;
    this.updatedAt = new Date();
  }
}
