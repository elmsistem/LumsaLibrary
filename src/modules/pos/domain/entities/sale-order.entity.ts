import { assertUUID, generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export type PosPaymentMethod =
  | "CASH"
  | "BANK_TRANSFER_DEUNA"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "STORE_CREDIT"
  | "TAX_WITHHOLDING_RECEIVED"
  | "CUSTOMER_ADVANCE_APPLIED";

export interface SaleOrderItemProps {
  id?: string;
  productId: string;
  presentationId: string;
  quantity: number;
  unitPrice: Money;
  discount: Money;
  taxRate: string;
  total: Money;
}

export interface SalePaymentProps {
  id?: string;
  paymentMethod: PosPaymentMethod;
  amount: Money;
  referenceCode?: string | null;
}

export interface CreateSaleOrderProps {
  id?: string;
  sequentialCode: string;
  cashSessionId: string;
  customerId: string;
  warehouseId: string;
  subtotal0: Money;
  subtotal15: Money;
  discount: Money;
  iva: Money;
  totalAmount: Money;
  items: SaleOrderItemProps[];
  payments: SalePaymentProps[];
  createdAt?: Date;
}

export class SaleOrder {
  private readonly id: string;
  private readonly sequentialCode: string;
  private readonly cashSessionId: string;
  private readonly customerId: string;
  private readonly warehouseId: string;
  private readonly subtotal0: Money;
  private readonly subtotal15: Money;
  private readonly discount: Money;
  private readonly iva: Money;
  private readonly totalAmount: Money;
  private readonly change: Money;
  private readonly items: SaleOrderItemProps[];
  private readonly payments: SalePaymentProps[];
  private readonly createdAt: Date;

  private constructor(props: {
    id: string;
    sequentialCode: string;
    cashSessionId: string;
    customerId: string;
    warehouseId: string;
    subtotal0: Money;
    subtotal15: Money;
    discount: Money;
    iva: Money;
    totalAmount: Money;
    change: Money;
    items: SaleOrderItemProps[];
    payments: SalePaymentProps[];
    createdAt: Date;
  }) {
    this.id = props.id;
    this.sequentialCode = props.sequentialCode;
    this.cashSessionId = props.cashSessionId;
    this.customerId = props.customerId;
    this.warehouseId = props.warehouseId;
    this.subtotal0 = props.subtotal0;
    this.subtotal15 = props.subtotal15;
    this.discount = props.discount;
    this.iva = props.iva;
    this.totalAmount = props.totalAmount;
    this.change = props.change;
    this.items = props.items;
    this.payments = props.payments;
    this.createdAt = props.createdAt;
  }

  public static create(props: CreateSaleOrderProps): SaleOrder {
    const id = props.id || generateUUIDv7();
    assertUUID(id, "ID de orden de venta inválido.");
    assertUUID(props.cashSessionId, "ID de sesión de caja inválido.");
    assertUUID(props.customerId, "ID de cliente inválido.");
    assertUUID(props.warehouseId, "ID de almacén inválido.");

    if (!props.items || props.items.length === 0) {
      throw new ValidationError(
        "La orden de venta debe contener al menos un producto.",
        "EMPTY_SALE_ORDER_ITEMS"
      );
    }

    if (!props.payments || props.payments.length === 0) {
      throw new ValidationError(
        "Debe registrar al menos un método de pago para la venta.",
        "EMPTY_SALE_PAYMENTS"
      );
    }

    // Calcular suma total de pagos recibidos
    let totalPaidCents = 0;
    let cashPaidCents = 0;

    for (const p of props.payments) {
      if (p.amount.toCents() <= 0) {
        throw new ValidationError(
          "El monto de cada pago debe ser mayor que cero.",
          "INVALID_PAYMENT_AMOUNT"
        );
      }
      totalPaidCents += p.amount.toCents();
      if (p.paymentMethod === "CASH") {
        cashPaidCents += p.amount.toCents();
      }
    }

    const totalAmountCents = props.totalAmount.toCents();

    if (totalPaidCents < totalAmountCents) {
      const missing = ((totalAmountCents - totalPaidCents) / 100).toFixed(2);
      throw new ValidationError(
        `El monto pagado es insuficiente para cubrir el total de la venta. Faltan: $${missing}`,
        "INSUFFICIENT_PAYMENT"
      );
    }

    // Cálculo del cambio o vuelto
    const changeCents = totalPaidCents - totalAmountCents;
    if (changeCents > 0 && cashPaidCents < changeCents) {
      throw new ValidationError(
        "No se puede entregar vuelto en efectivo mayor al dinero en efectivo recibido.",
        "INVALID_CASH_CHANGE"
      );
    }

    const change = Money.fromCents(changeCents);

    return new SaleOrder({
      id,
      sequentialCode: props.sequentialCode,
      cashSessionId: props.cashSessionId,
      customerId: props.customerId,
      warehouseId: props.warehouseId,
      subtotal0: props.subtotal0,
      subtotal15: props.subtotal15,
      discount: props.discount,
      iva: props.iva,
      totalAmount: props.totalAmount,
      change,
      items: props.items.map((i) => ({ ...i, id: i.id || generateUUIDv7() })),
      payments: props.payments.map((p) => ({ ...p, id: p.id || generateUUIDv7() })),
      createdAt: props.createdAt || new Date(),
    });
  }

  public static reconstitute(props: {
    id: string;
    sequentialCode: string;
    cashSessionId: string;
    customerId: string;
    warehouseId: string;
    subtotal0: Money;
    subtotal15: Money;
    discount: Money;
    iva: Money;
    totalAmount: Money;
    change: Money;
    items: SaleOrderItemProps[];
    payments: SalePaymentProps[];
    createdAt: Date;
  }): SaleOrder {
    return new SaleOrder(props);
  }

  public getId(): string {
    return this.id;
  }

  public getSequentialCode(): string {
    return this.sequentialCode;
  }

  public getCashSessionId(): string {
    return this.cashSessionId;
  }

  public getCustomerId(): string {
    return this.customerId;
  }

  public getWarehouseId(): string {
    return this.warehouseId;
  }

  public getSubtotal0(): Money {
    return this.subtotal0;
  }

  public getSubtotal15(): Money {
    return this.subtotal15;
  }

  public getDiscount(): Money {
    return this.discount;
  }

  public getIva(): Money {
    return this.iva;
  }

  public getTotalAmount(): Money {
    return this.totalAmount;
  }

  public getChange(): Money {
    return this.change;
  }

  public getItems(): SaleOrderItemProps[] {
    return [...this.items];
  }

  public getPayments(): SalePaymentProps[] {
    return [...this.payments];
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
