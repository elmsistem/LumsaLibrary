import { Money, ValidationError } from "@/modules/core/public-api";

export interface CreateSupplierDebtProps {
  id: string;
  purchaseId: string;
  supplierId: string;
  dueDate: Date;
  totalDebt: Money;
  paidAmount?: Money;
  isSettled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Entidad de Dominio para Cuentas por Pagar a Proveedores.
 */
export class SupplierDebt {
  private readonly id: string;
  private readonly purchaseId: string;
  private readonly supplierId: string;
  private dueDate: Date;
  private readonly totalDebt: Money;
  private paidAmount: Money;
  private isSettled: boolean;
  private readonly createdAt: Date;
  private updatedAt: Date;

  public static create(props: CreateSupplierDebtProps): SupplierDebt {
    return new SupplierDebt(props);
  }

  constructor(props: CreateSupplierDebtProps) {
    if (props.totalDebt.isNegative()) {
      throw new ValidationError("La deuda no puede ser negativa.", "INVALID_DEBT_AMOUNT");
    }

    this.id = props.id;
    this.purchaseId = props.purchaseId;
    this.supplierId = props.supplierId;
    this.dueDate = props.dueDate;
    this.totalDebt = props.totalDebt;
    this.paidAmount = props.paidAmount ?? Money.zero();
    this.isSettled = props.isSettled ?? (this.paidAmount.greaterThanOrEqual(this.totalDebt) && !this.totalDebt.isZero());
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public registerPayment(amount: Money): void {
    if (amount.isNegative() || amount.isZero()) {
      throw new ValidationError("El pago debe ser un monto positivo.", "INVALID_PAYMENT_AMOUNT");
    }

    const pending = this.getPendingDebt();
    if (amount.greaterThan(pending)) {
      throw new ValidationError(
        `El pago (${amount.format()}) no puede exceder la deuda pendiente (${pending.format()}).`,
        "OVERPAID_SUPPLIER_DEBT"
      );
    }

    this.paidAmount = this.paidAmount.add(amount);
    if (this.paidAmount.greaterThanOrEqual(this.totalDebt)) {
      this.isSettled = true;
    }
    this.updatedAt = new Date();
  }

  public getPendingDebt(): Money {
    if (this.isSettled) return Money.zero();
    return this.totalDebt.subtract(this.paidAmount);
  }

  public isOverdue(currentDate: Date = new Date()): boolean {
    return !this.isSettled && currentDate > this.dueDate;
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getPurchaseId(): string {
    return this.purchaseId;
  }

  public getSupplierId(): string {
    return this.supplierId;
  }

  public getDueDate(): Date {
    return this.dueDate;
  }

  public getTotalDebt(): Money {
    return this.totalDebt;
  }

  public getPaidAmount(): Money {
    return this.paidAmount;
  }

  public getIsSettled(): boolean {
    return this.isSettled;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
