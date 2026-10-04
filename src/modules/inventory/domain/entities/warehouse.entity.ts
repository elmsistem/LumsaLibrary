import { assertUUID, generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface CreateWarehouseProps {
  id?: string;
  name: string;
  code: string;
  address?: string | null;
  isActive?: boolean;
  createdAt?: Date;
}

export class Warehouse {
  private readonly id: string;
  private name: string;
  private readonly code: string;
  private address: string | null;
  private isActive: boolean;
  private readonly createdAt: Date;

  private constructor(props: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    isActive: boolean;
    createdAt: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.code = props.code;
    this.address = props.address;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
  }

  public static create(props: CreateWarehouseProps): Warehouse {
    const trimmedName = props.name.trim();
    if (!trimmedName || trimmedName.length < 3) {
      throw new ValidationError(
        "El nombre del almacén o bodega debe tener al menos 3 caracteres.",
        "INVALID_WAREHOUSE_NAME"
      );
    }

    const trimmedCode = props.code.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length < 2) {
      throw new ValidationError(
        "El código del almacén debe tener al menos 2 caracteres (ej: MATRIZ, B01).",
        "INVALID_WAREHOUSE_CODE"
      );
    }

    const id = props.id || generateUUIDv7();
    assertUUID(id, "ID de almacén inválido.");

    return new Warehouse({
      id,
      name: trimmedName,
      code: trimmedCode,
      address: props.address?.trim() || null,
      isActive: props.isActive ?? true,
      createdAt: props.createdAt || new Date(),
    });
  }

  public static reconstitute(props: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    isActive: boolean;
    createdAt: Date;
  }): Warehouse {
    return new Warehouse(props);
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getCode(): string {
    return this.code;
  }

  public getAddress(): string | null {
    return this.address;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public updateDetails(name: string, address?: string | null): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 3) {
      throw new ValidationError(
        "El nombre del almacén debe tener al menos 3 caracteres.",
        "INVALID_WAREHOUSE_NAME"
      );
    }
    this.name = trimmed;
    this.address = address?.trim() || null;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public activate(): void {
    this.isActive = true;
  }
}
