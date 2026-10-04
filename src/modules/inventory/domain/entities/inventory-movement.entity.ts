import { assertUUID, generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export type InventoryMovementType =
  | "PURCHASE_ENTRY"
  | "SALE_EXIT"
  | "INTERNAL_DAMAGE"
  | "PHYSICAL_COUNT_ADJUSTMENT"
  | "CUSTOMER_RETURN"
  | "SUPPLIER_RETURN"
  | "WAREHOUSE_TRANSFER";

export interface CreateMovementProps {
  id?: string;
  warehouseId: string;
  productId: string;
  movementType: InventoryMovementType;
  quantityUnits: number; // Positivo para entradas/reingresos, negativo para salidas
  unitCost: Money;
  averageCost: Money;
  balanceUnits: number;
  referenceId?: string | null;
  referenceCode?: string | null;
  notes?: string | null;
  userId?: string | null;
  createdAt?: Date;
}

/**
 * Entidad inmutable que representa un asiento en el Libro Mayor de Inventario (Kardex).
 * Una vez creado, sus atributos jamás pueden ser modificados.
 */
export class InventoryMovement {
  private readonly id: string;
  private readonly warehouseId: string;
  private readonly productId: string;
  private readonly movementType: InventoryMovementType;
  private readonly quantityUnits: number;
  private readonly unitCost: Money;
  private readonly averageCost: Money;
  private readonly balanceUnits: number;
  private readonly referenceId: string | null;
  private readonly referenceCode: string | null;
  private readonly notes: string | null;
  private readonly userId: string | null;
  private readonly createdAt: Date;

  private constructor(props: {
    id: string;
    warehouseId: string;
    productId: string;
    movementType: InventoryMovementType;
    quantityUnits: number;
    unitCost: Money;
    averageCost: Money;
    balanceUnits: number;
    referenceId: string | null;
    referenceCode: string | null;
    notes: string | null;
    userId: string | null;
    createdAt: Date;
  }) {
    this.id = props.id;
    this.warehouseId = props.warehouseId;
    this.productId = props.productId;
    this.movementType = props.movementType;
    this.quantityUnits = props.quantityUnits;
    this.unitCost = props.unitCost;
    this.averageCost = props.averageCost;
    this.balanceUnits = props.balanceUnits;
    this.referenceId = props.referenceId;
    this.referenceCode = props.referenceCode;
    this.notes = props.notes;
    this.userId = props.userId;
    this.createdAt = props.createdAt;
  }

  public static create(props: CreateMovementProps): InventoryMovement {
    const id = props.id || generateUUIDv7();
    assertUUID(id, "ID de movimiento inválido.");
    assertUUID(props.warehouseId, "ID de almacén inválido.");
    assertUUID(props.productId, "ID de producto inválido.");

    if (props.referenceId) {
      assertUUID(props.referenceId, "ID de referencia inválido.");
    }
    if (props.userId) {
      assertUUID(props.userId, "ID de usuario inválido.");
    }

    if (props.quantityUnits === 0) {
      throw new ValidationError(
        "La cantidad de unidades en un movimiento de Kardex no puede ser cero.",
        "ZERO_QUANTITY_MOVEMENT"
      );
    }

    if (props.balanceUnits < 0) {
      throw new ValidationError(
        `El saldo resultante de inventario (${props.balanceUnits}) no puede ser negativo.`,
        "NEGATIVE_BALANCE_NOT_ALLOWED"
      );
    }

    // Validación de coherencia de signo según el tipo de movimiento
    if (
      (props.movementType === "PURCHASE_ENTRY" || props.movementType === "CUSTOMER_RETURN") &&
      props.quantityUnits < 0
    ) {
      throw new ValidationError(
        `El movimiento ${props.movementType} debe tener una cantidad positiva de unidades.`,
        "INVALID_MOVEMENT_SIGN"
      );
    }

    if (
      (props.movementType === "SALE_EXIT" ||
        props.movementType === "INTERNAL_DAMAGE" ||
        props.movementType === "SUPPLIER_RETURN") &&
      props.quantityUnits > 0
    ) {
      throw new ValidationError(
        `El movimiento ${props.movementType} debe tener una cantidad negativa de unidades.`,
        "INVALID_MOVEMENT_SIGN"
      );
    }

    // Redondear a 4 decimales
    const roundedQuantity = Math.round(props.quantityUnits * 10000) / 10000;
    const roundedBalance = Math.round(props.balanceUnits * 10000) / 10000;

    return new InventoryMovement({
      id,
      warehouseId: props.warehouseId,
      productId: props.productId,
      movementType: props.movementType,
      quantityUnits: roundedQuantity,
      unitCost: props.unitCost,
      averageCost: props.averageCost,
      balanceUnits: roundedBalance,
      referenceId: props.referenceId || null,
      referenceCode: props.referenceCode?.trim() || null,
      notes: props.notes?.trim() || null,
      userId: props.userId || null,
      createdAt: props.createdAt || new Date(),
    });
  }

  public static reconstitute(props: {
    id: string;
    warehouseId: string;
    productId: string;
    movementType: InventoryMovementType;
    quantityUnits: number;
    unitCost: Money;
    averageCost: Money;
    balanceUnits: number;
    referenceId: string | null;
    referenceCode: string | null;
    notes: string | null;
    userId: string | null;
    createdAt: Date;
  }): InventoryMovement {
    return new InventoryMovement(props);
  }

  public getId(): string {
    return this.id;
  }

  public getWarehouseId(): string {
    return this.warehouseId;
  }

  public getProductId(): string {
    return this.productId;
  }

  public getMovementType(): InventoryMovementType {
    return this.movementType;
  }

  public getQuantityUnits(): number {
    return this.quantityUnits;
  }

  public getUnitCost(): Money {
    return this.unitCost;
  }

  public getAverageCost(): Money {
    return this.averageCost;
  }

  public getBalanceUnits(): number {
    return this.balanceUnits;
  }

  public getReferenceId(): string | null {
    return this.referenceId;
  }

  public getReferenceCode(): string | null {
    return this.referenceCode;
  }

  public getNotes(): string | null {
    return this.notes;
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public isEntry(): boolean {
    return this.quantityUnits > 0;
  }

  public isExit(): boolean {
    return this.quantityUnits < 0;
  }
}
