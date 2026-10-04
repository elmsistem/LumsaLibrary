import { Money, ValidationError } from "@/modules/core/public-api";

export interface CreatePresentationProps {
  id: string;
  productId: string;
  name: string;
  conversionFactor: number;
  barcode?: string;
  retailPrice: Money;
  wholesalePrice: Money;
  minWholesaleQuantity?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

/**
 * Entidad de Dominio para Presentaciones Comerciales de un Producto (Fraccionamiento).
 * Permite vender en unidades, docenas, cajas o resmas manteniendo el control del inventario base.
 */
export class ProductPresentation {
  private readonly id: string;
  private readonly productId: string;
  private name: string;
  private conversionFactor: number;
  private barcode?: string;
  private retailPrice: Money;
  private wholesalePrice: Money;
  private minWholesaleQuantity: number;
  private isDefault: boolean;
  private isActive: boolean;

  constructor(props: CreatePresentationProps) {
    if (!props.name || props.name.trim().length === 0) {
      throw new ValidationError("El nombre de la presentación no puede estar vacío.", "INVALID_PRESENTATION_NAME");
    }

    if (props.conversionFactor < 1.0) {
      throw new ValidationError(
        `El factor de conversión debe ser mayor o igual a 1.0. Recibido: ${props.conversionFactor}`,
        "INVALID_CONVERSION_FACTOR"
      );
    }

    if (props.wholesalePrice.greaterThan(props.retailPrice)) {
      throw new ValidationError(
        `El precio mayorista (${props.wholesalePrice.format()}) no puede ser mayor que el precio minorista (${props.retailPrice.format()}).`,
        "INVALID_WHOLESALE_PRICE"
      );
    }

    this.id = props.id;
    this.productId = props.productId;
    this.name = props.name.trim();
    this.conversionFactor = props.conversionFactor;
    this.barcode = props.barcode?.trim();
    this.retailPrice = props.retailPrice;
    this.wholesalePrice = props.wholesalePrice;
    this.minWholesaleQuantity = props.minWholesaleQuantity ?? 1;
    this.isDefault = props.isDefault ?? false;
    this.isActive = props.isActive ?? true;
  }

  /**
   * Determina el precio aplicable (minorista o mayorista) según la cantidad comprada.
   */
  public getPriceForQuantity(quantity: number): Money {
    if (quantity >= this.minWholesaleQuantity && !this.wholesalePrice.isZero()) {
      return this.wholesalePrice;
    }
    return this.retailPrice;
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getProductId(): string {
    return this.productId;
  }

  public getName(): string {
    return this.name;
  }

  public getConversionFactor(): number {
    return this.conversionFactor;
  }

  public getBarcode(): string | undefined {
    return this.barcode;
  }

  public getRetailPrice(): Money {
    return this.retailPrice;
  }

  public getWholesalePrice(): Money {
    return this.wholesalePrice;
  }

  public getMinWholesaleQuantity(): number {
    return this.minWholesaleQuantity;
  }

  public getIsDefault(): boolean {
    return this.isDefault;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }
}
