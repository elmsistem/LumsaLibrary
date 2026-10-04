import { Money, ValidationError } from "@/modules/core/public-api";
import { TaxRate } from "@/modules/catalog/public-api";

export interface CreatePurchaseItemProps {
  id: string;
  purchaseId: string;
  productId: string;
  presentationId: string;
  supplierProductCode?: string;
  quantityBought: number;
  unitCost: Money;
  taxRate: TaxRate;
  total?: Money;
}

/**
 * Entidad de Dominio para los Ítems de una Factura de Compra.
 */
export class PurchaseItem {
  private readonly id: string;
  private readonly purchaseId: string;
  private readonly productId: string;
  private readonly presentationId: string;
  private readonly supplierProductCode?: string;
  private readonly quantityBought: number;
  private readonly unitCost: Money;
  private readonly taxRate: TaxRate;
  private readonly total: Money;

  public static create(props: CreatePurchaseItemProps): PurchaseItem {
    return new PurchaseItem(props);
  }

  constructor(props: CreatePurchaseItemProps) {
    if (props.quantityBought <= 0) {
      throw new ValidationError(
        `La cantidad comprada debe ser mayor a cero. Recibido: ${props.quantityBought}`,
        "INVALID_PURCHASE_QUANTITY"
      );
    }

    if (props.unitCost.isNegative()) {
      throw new ValidationError(
        `El costo unitario no puede ser negativo. Recibido: ${props.unitCost.format()}`,
        "INVALID_UNIT_COST"
      );
    }

    this.id = props.id;
    this.purchaseId = props.purchaseId;
    this.productId = props.productId;
    this.presentationId = props.presentationId;
    this.supplierProductCode = props.supplierProductCode?.trim();
    this.quantityBought = props.quantityBought;
    this.unitCost = props.unitCost;
    this.taxRate = props.taxRate;
    this.total = props.total ?? props.unitCost.multiply(props.quantityBought);
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getPurchaseId(): string {
    return this.purchaseId;
  }

  public getProductId(): string {
    return this.productId;
  }

  public getPresentationId(): string {
    return this.presentationId;
  }

  public getSupplierProductCode(): string | undefined {
    return this.supplierProductCode;
  }

  public getQuantityBought(): number {
    return this.quantityBought;
  }

  public getUnitCost(): Money {
    return this.unitCost;
  }

  public getTaxRate(): TaxRate {
    return this.taxRate;
  }

  public getTotal(): Money {
    return this.total;
  }
}
