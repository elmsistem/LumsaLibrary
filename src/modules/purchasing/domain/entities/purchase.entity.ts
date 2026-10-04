import { Money, ValidationError } from "@/modules/core/public-api";
import { PurchaseItem } from "./purchase-item.entity";

export type PurchaseStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface CreatePurchaseProps {
  id: string;
  supplierId: string;
  warehouseId: string;
  invoiceNumber: string; // Formato SRI: 001-001-000000123
  authorizationNumber?: string;
  emissionDate: Date;
  subtotal0?: Money;
  subtotal15?: Money;
  totalDiscount?: Money;
  totalIva?: Money;
  totalAmount?: Money;
  status?: PurchaseStatus;
  xmlFilePath?: string;
  items?: PurchaseItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Entidad de Dominio para Compras de Mercancía a Proveedores.
 */
export class Purchase {
  private readonly id: string;
  private readonly supplierId: string;
  private readonly warehouseId: string;
  private readonly invoiceNumber: string;
  private readonly authorizationNumber?: string;
  private readonly emissionDate: Date;
  private subtotal0: Money;
  private subtotal15: Money;
  private totalDiscount: Money;
  private totalIva: Money;
  private totalAmount: Money;
  private status: PurchaseStatus;
  private xmlFilePath?: string;
  private items: PurchaseItem[];
  private readonly createdAt: Date;
  private updatedAt: Date;

  public static create(props: CreatePurchaseProps): Purchase {
    return new Purchase(props);
  }

  constructor(props: CreatePurchaseProps) {
    // Validar formato de factura SRI (ej. 001-001-000000123)
    const invoiceRegex = /^\d{3}-\d{3}-\d{9}$/;
    if (!invoiceRegex.test(props.invoiceNumber)) {
      throw new ValidationError(
        `El número de factura debe tener el formato oficial del SRI '001-001-000000123'. Recibido: ${props.invoiceNumber}`,
        "INVALID_INVOICE_NUMBER_FORMAT"
      );
    }

    if (props.authorizationNumber && !/^\d{49}$/.test(props.authorizationNumber)) {
      throw new ValidationError(
        `El número de autorización o clave de acceso SRI debe tener 49 dígitos numéricos. Recibido: ${props.authorizationNumber}`,
        "INVALID_AUTHORIZATION_NUMBER"
      );
    }

    this.id = props.id;
    this.supplierId = props.supplierId;
    this.warehouseId = props.warehouseId;
    this.invoiceNumber = props.invoiceNumber;
    this.authorizationNumber = props.authorizationNumber;
    this.emissionDate = props.emissionDate;
    this.subtotal0 = props.subtotal0 ?? Money.zero();
    this.subtotal15 = props.subtotal15 ?? Money.zero();
    this.totalDiscount = props.totalDiscount ?? Money.zero();
    this.totalIva = props.totalIva ?? Money.zero();
    this.totalAmount = props.totalAmount ?? Money.zero();
    this.status = props.status ?? "DRAFT";
    this.xmlFilePath = props.xmlFilePath;
    this.items = props.items ?? [];
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();

    if (this.items.length > 0 && props.totalAmount === undefined) {
      this.recalculateTotals();
    }
  }

  public addItem(item: PurchaseItem): void {
    if (this.status !== "DRAFT") {
      throw new ValidationError(
        `No se pueden agregar ítems a una compra en estado ${this.status}.`,
        "PURCHASE_NOT_EDITABLE"
      );
    }
    this.items.push(item);
    this.recalculateTotals();
    this.updatedAt = new Date();
  }

  public recalculateTotals(): void {
    let sub0 = Money.zero();
    let sub15 = Money.zero();

    for (const item of this.items) {
      if (item.getTaxRate() === "IVA_15") {
        sub15 = sub15.add(item.getTotal());
      } else {
        sub0 = sub0.add(item.getTotal());
      }
    }

    this.subtotal0 = sub0;
    this.subtotal15 = sub15;

    // IVA 15% en Ecuador = subtotal15 * 0.15 redondeado a centavos
    const ivaCents = Math.round(sub15.toCents() * 0.15);
    this.totalIva = Money.fromCents(ivaCents);

    this.totalAmount = this.subtotal0.add(this.subtotal15).add(this.totalIva);
  }

  public confirm(): void {
    if (this.status !== "DRAFT") {
      throw new ValidationError(
        `Solo se pueden confirmar compras en estado DRAFT. Estado actual: ${this.status}`,
        "INVALID_PURCHASE_STATUS_TRANSITION"
      );
    }

    if (this.items.length === 0) {
      throw new ValidationError(
        "No se puede confirmar una compra sin ítems.",
        "EMPTY_PURCHASE_ITEMS"
      );
    }

    this.status = "CONFIRMED";
    this.updatedAt = new Date();
  }

  public cancel(): void {
    if (this.status === "CONFIRMED") {
      throw new ValidationError(
        "No se puede cancelar directamente una compra ya confirmada que ha afectado el Kardex.",
        "CANNOT_CANCEL_CONFIRMED_PURCHASE"
      );
    }

    this.status = "CANCELLED";
    this.updatedAt = new Date();
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getSupplierId(): string {
    return this.supplierId;
  }

  public getWarehouseId(): string {
    return this.warehouseId;
  }

  public getInvoiceNumber(): string {
    return this.invoiceNumber;
  }

  public getAuthorizationNumber(): string | undefined {
    return this.authorizationNumber;
  }

  public getEmissionDate(): Date {
    return this.emissionDate;
  }

  public getSubtotal0(): Money {
    return this.subtotal0;
  }

  public getSubtotal15(): Money {
    return this.subtotal15;
  }

  public getTotalDiscount(): Money {
    return this.totalDiscount;
  }

  public getTotalIva(): Money {
    return this.totalIva;
  }

  public getTotalAmount(): Money {
    return this.totalAmount;
  }

  public getStatus(): PurchaseStatus {
    return this.status;
  }

  public getXmlFilePath(): string | undefined {
    return this.xmlFilePath;
  }

  public getItems(): PurchaseItem[] {
    return [...this.items];
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
