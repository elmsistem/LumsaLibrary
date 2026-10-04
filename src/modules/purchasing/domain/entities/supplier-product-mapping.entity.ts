import { ValidationError } from "@/modules/core/public-api";

export interface CreateSupplierProductMappingProps {
  id: string;
  supplierId: string;
  supplierCode: string;
  productId: string;
  presentationId: string;
  createdAt?: Date;
}

/**
 * Entidad de Dominio para el Mapeo de Códigos de Proveedor a Productos de Catálogo Interno.
 */
export class SupplierProductMapping {
  private readonly id: string;
  private readonly supplierId: string;
  private readonly supplierCode: string;
  private readonly productId: string;
  private readonly presentationId: string;
  private readonly createdAt: Date;

  public static create(props: CreateSupplierProductMappingProps): SupplierProductMapping {
    return new SupplierProductMapping(props);
  }

  constructor(props: CreateSupplierProductMappingProps) {
    if (!props.supplierCode || props.supplierCode.trim().length === 0) {
      throw new ValidationError("El código del proveedor no puede estar vacío.", "INVALID_SUPPLIER_CODE");
    }

    this.id = props.id;
    this.supplierId = props.supplierId;
    this.supplierCode = props.supplierCode.trim();
    this.productId = props.productId;
    this.presentationId = props.presentationId;
    this.createdAt = props.createdAt ?? new Date();
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getSupplierId(): string {
    return this.supplierId;
  }

  public getSupplierCode(): string {
    return this.supplierCode;
  }

  public getProductId(): string {
    return this.productId;
  }

  public getPresentationId(): string {
    return this.presentationId;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
