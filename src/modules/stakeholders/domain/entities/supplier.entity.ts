import { ValidationError } from "@/modules/core/public-api";
import { EcuadorianIdentification } from "../value-objects/ecuadorian-identification.vo";

export interface CreateSupplierProps {
  id: string;
  ruc: string;
  legalName: string;
  commercialName?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  creditDays?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Entidad de Dominio para Proveedores (Distribuidores y Editoriales).
 */
export class Supplier {
  private readonly id: string;
  private readonly ruc: string;
  private legalName: string;
  private commercialName?: string;
  private email?: string;
  private phone?: string;
  private address?: string;
  private contactPerson?: string;
  private creditDays: number;
  private isActive: boolean;
  private readonly createdAt: Date;
  private updatedAt: Date;

  public static create(props: CreateSupplierProps): Supplier {
    return new Supplier(props);
  }

  constructor(props: CreateSupplierProps) {
    if (!props.ruc || props.ruc.trim().length !== 13) {
      throw new ValidationError("El RUC del proveedor debe tener exactamente 13 dígitos.", "INVALID_SUPPLIER_RUC");
    }

    // Validar RUC con el algoritmo ecuatoriano
    const rucValidation = EcuadorianIdentification.validate("RUC", props.ruc);
    if (!rucValidation.isValid) {
      throw new ValidationError(
        `El RUC del proveedor no es válido según la normativa SRI: ${rucValidation.error ?? "Algoritmo Módulo 10/11 falló"}`,
        "INVALID_SUPPLIER_RUC"
      );
    }

    if (!props.legalName || props.legalName.trim().length < 2) {
      throw new ValidationError("La razón social del proveedor debe tener al menos 2 caracteres.", "INVALID_SUPPLIER_NAME");
    }

    this.id = props.id;
    this.ruc = props.ruc.trim();
    this.legalName = props.legalName.trim();
    this.commercialName = props.commercialName?.trim();
    this.email = props.email?.trim();
    this.phone = props.phone?.trim();
    this.address = props.address?.trim();
    this.contactPerson = props.contactPerson?.trim();
    this.creditDays = props.creditDays ?? 0;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public updateContact(email?: string, phone?: string, address?: string): void {
    if (email !== undefined) this.email = email.trim();
    if (phone !== undefined) this.phone = phone.trim();
    if (address !== undefined) this.address = address.trim();
    this.updatedAt = new Date();
  }

  public setCreditDays(days: number): void {
    if (days < 0) {
      throw new ValidationError("Los días de crédito no pueden ser negativos.", "INVALID_CREDIT_DAYS");
    }
    this.creditDays = days;
    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  public activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getRuc(): string {
    return this.ruc;
  }

  public getLegalName(): string {
    return this.legalName;
  }

  public getCommercialName(): string | undefined {
    return this.commercialName;
  }

  public getEmail(): string | undefined {
    return this.email;
  }

  public getPhone(): string | undefined {
    return this.phone;
  }

  public getAddress(): string | undefined {
    return this.address;
  }

  public getContactPerson(): string | undefined {
    return this.contactPerson;
  }

  public getCreditDays(): number {
    return this.creditDays;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
