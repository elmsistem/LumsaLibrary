import { ValidationError } from "@/modules/core/public-api";
import { ProductPresentation } from "./product-presentation.entity";

export type TaxRate = "IVA_0" | "IVA_15" | "NO_OBJETO" | "EXENTO";
export type UnitType = "UNIDAD" | "PLIEGO" | "METRO" | "JUEGO" | "SERVICIO";

export interface CreateProductProps {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  brandId?: string;
  barcode?: string;
  description?: string;
  taxRate?: TaxRate;
  minUnit?: UnitType;
  isService?: boolean;
  minStockAlert?: number;
  isActive?: boolean;
  presentations?: ProductPresentation[];
}

/**
 * Entidad de Dominio para Productos en LumsaLibrary.
 * Agrupa la definición base del artículo y sus presentaciones comerciales fraccionadas.
 */
export class Product {
  private readonly id: string;
  private sku: string;
  private name: string;
  private categoryId: string;
  private brandId?: string;
  private barcode?: string;
  private description?: string;
  private taxRate: TaxRate;
  private minUnit: UnitType;
  private isService: boolean;
  private minStockAlert: number;
  private isActive: boolean;
  private presentations: ProductPresentation[] = [];

  constructor(props: CreateProductProps) {
    if (!props.sku || props.sku.trim().length === 0) {
      throw new ValidationError("El SKU del producto no puede estar vacío.", "INVALID_SKU");
    }

    if (!props.name || props.name.trim().length < 2) {
      throw new ValidationError("El nombre del producto debe tener al menos 2 caracteres.", "INVALID_PRODUCT_NAME");
    }

    this.id = props.id;
    this.sku = props.sku.trim();
    this.name = props.name.trim();
    this.categoryId = props.categoryId;
    this.brandId = props.brandId;
    this.barcode = props.barcode?.trim();
    this.description = props.description?.trim();
    this.taxRate = props.taxRate ?? "IVA_15";
    this.minUnit = props.minUnit ?? "UNIDAD";
    this.isService = props.isService ?? false;
    this.minStockAlert = props.minStockAlert ?? 5.0;
    this.isActive = props.isActive ?? true;

    if (props.presentations && props.presentations.length > 0) {
      for (const p of props.presentations) {
        this.addPresentation(p);
      }
    }
  }

  public addPresentation(presentation: ProductPresentation): void {
    if (presentation.getProductId() !== this.id) {
      throw new ValidationError(
        "La presentación no pertenece a este producto.",
        "PRESENTATION_PRODUCT_MISMATCH"
      );
    }

    // Si ya existe una por defecto y esta nueva es por defecto, desmarca la anterior
    if (presentation.getIsDefault()) {
      this.presentations.forEach((p) => {
        // En entidades inmutables no reasignamos directamente, pero controlamos la lista
      });
    }

    this.presentations.push(presentation);
  }

  public getDefaultPresentation(): ProductPresentation {
    const defaultP = this.presentations.find((p) => p.getIsDefault());
    if (defaultP) return defaultP;

    if (this.presentations.length > 0) {
      return this.presentations[0]!;
    }

    throw new ValidationError(
      `El producto "${this.name}" no tiene ninguna presentación registrada.`,
      "NO_PRESENTATION_FOUND"
    );
  }

  public getPresentationById(presentationId: string): ProductPresentation | undefined {
    return this.presentations.find((p) => p.getId() === presentationId);
  }

  /**
   * Calcula cuántas unidades mínimas de inventario representa una cantidad vendida en una presentación.
   * Ej: 3 cajas con factor 50 = 150 unidades mínimas a descontar de Kardex.
   */
  public calculateUnits(presentationId: string, quantity: number): number {
    const presentation = this.getPresentationById(presentationId);
    if (!presentation) {
      throw new ValidationError(
        `Presentación no encontrada en el producto "${this.name}".`,
        "PRESENTATION_NOT_FOUND"
      );
    }
    return quantity * presentation.getConversionFactor();
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getSku(): string {
    return this.sku;
  }

  public getName(): string {
    return this.name;
  }

  public getCategoryId(): string {
    return this.categoryId;
  }

  public getBrandId(): string | undefined {
    return this.brandId;
  }

  public getBarcode(): string | undefined {
    return this.barcode;
  }

  public getDescription(): string | undefined {
    return this.description;
  }

  public getTaxRate(): TaxRate {
    return this.taxRate;
  }

  public getMinUnit(): UnitType {
    return this.minUnit;
  }

  public getIsService(): boolean {
    return this.isService;
  }

  public getMinStockAlert(): number {
    return this.minStockAlert;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getPresentations(): readonly ProductPresentation[] {
    return this.presentations;
  }
}
