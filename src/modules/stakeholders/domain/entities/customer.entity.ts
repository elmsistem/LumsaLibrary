import { Money, ValidationError } from "@/modules/core/public-api";
import { EcuadorianIdentification } from "../value-objects/ecuadorian-identification.vo";

export interface CreateCustomerProps {
  id: string;
  identification: EcuadorianIdentification;
  legalName: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: Money;
  currentDebt?: Money;
  isActive?: boolean;
}

/**
 * Entidad de Dominio para Clientes de LumsaLibrary.
 * Encapsula las reglas comerciales de crédito, saldo deudor y estado del cliente.
 */
export class Customer {
  private readonly id: string;
  private readonly identification: EcuadorianIdentification;
  private legalName: string;
  private email?: string;
  private phone?: string;
  private address?: string;
  private creditLimit: Money;
  private currentDebt: Money;
  private isActive: boolean;

  constructor(props: CreateCustomerProps) {
    if (!props.legalName || props.legalName.trim().length < 2) {
      throw new ValidationError("La razón social o nombre del cliente debe tener al menos 2 caracteres.", "INVALID_NAME");
    }

    this.id = props.id;
    this.identification = props.identification;
    this.legalName = props.legalName.trim();
    this.email = props.email?.trim();
    this.phone = props.phone?.trim();
    this.address = props.address?.trim();
    this.creditLimit = props.creditLimit || Money.zero();
    this.currentDebt = props.currentDebt || Money.zero();
    this.isActive = props.isActive ?? true;
  }

  public canPurchaseOnCredit(amount: Money): boolean {
    if (!this.isActive) return false;
    if (this.creditLimit.isZero()) return false;

    const availableCredit = this.creditLimit.subtract(this.currentDebt);
    return availableCredit.greaterThanOrEqual(amount);
  }

  public addDebt(amount: Money): void {
    if (!this.canPurchaseOnCredit(amount)) {
      throw new ValidationError(
        `Crédito insuficiente para ${this.legalName}. Límite: ${this.creditLimit.format()}, Deuda actual: ${this.currentDebt.format()}, Intentado: ${amount.format()}`,
        "INSUFFICIENT_CREDIT"
      );
    }
    this.currentDebt = this.currentDebt.add(amount);
  }

  public payDebt(amount: Money): void {
    if (amount.greaterThan(this.currentDebt)) {
      throw new ValidationError("El abono no puede ser mayor que la deuda actual.", "OVERPAID_DEBT");
    }
    this.currentDebt = this.currentDebt.subtract(amount);
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getIdentification(): EcuadorianIdentification {
    return this.identification;
  }

  public getLegalName(): string {
    return this.legalName;
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

  public getCreditLimit(): Money {
    return this.creditLimit;
  }

  public getCurrentDebt(): Money {
    return this.currentDebt;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }
}
