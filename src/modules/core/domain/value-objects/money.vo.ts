import { ValidationError } from "../errors/domain-error";

/**
 * Value Object inmutable para representar montos monetarios en Dólares Estadounidenses (USD).
 *
 * REGLA ARQUITECTÓNICA OBLIGATORIA:
 * Todo cálculo y almacenamiento se maneja como centavos enteros (integer).
 * Queda prohibido el uso de punto flotante para operaciones aritméticas directas.
 */
export class Money {
  private readonly cents: number;

  private constructor(cents: number) {
    if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
      throw new ValidationError(
        `El valor de centavos debe ser un número entero finito válido. Recibido: ${cents}`,
        "INVALID_MONEY_CENTS"
      );
    }
    this.cents = cents;
    Object.freeze(this);
  }

  /**
   * Crea una instancia de Money a partir de un valor decimal (ej: 12.50 -> 1250 centavos).
   * Aplica redondeo estándar a centavos para evitar discrepancias por punto flotante.
   */
  public static fromDecimal(amount: number): Money {
    if (!Number.isFinite(amount)) {
      throw new ValidationError(
        `El monto decimal debe ser un número finito válido. Recibido: ${amount}`,
        "INVALID_DECIMAL_AMOUNT"
      );
    }
    // Redondeo estándar a 2 decimales para centavos
    const roundedCents = Math.round(amount * 100);
    return new Money(roundedCents);
  }

  /**
   * Crea una instancia de Money a partir de centavos enteros.
   */
  public static fromCents(cents: number): Money {
    return new Money(cents);
  }

  /**
   * Retorna una instancia con valor cero ($0.00 USD).
   */
  public static zero(): Money {
    return new Money(0);
  }

  public add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  public subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  public multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new ValidationError("El factor de multiplicación debe ser un número finito.", "INVALID_FACTOR");
    }
    return new Money(Math.round(this.cents * factor));
  }

  public divide(divisor: number): Money {
    if (!Number.isFinite(divisor) || divisor === 0) {
      throw new ValidationError("El divisor debe ser un número finito distinto de cero.", "DIVISION_BY_ZERO");
    }
    return new Money(Math.round(this.cents / divisor));
  }

  /**
   * Calcula un porcentaje sobre el monto actual (ej: base.percentage(15) para IVA 15%).
   */
  public percentage(rate: number): Money {
    if (!Number.isFinite(rate)) {
      throw new ValidationError("La tasa porcentual debe ser un número finito.", "INVALID_RATE");
    }
    return new Money(Math.round((this.cents * rate) / 100));
  }

  public isZero(): boolean {
    return this.cents === 0;
  }

  public isPositive(): boolean {
    return this.cents > 0;
  }

  public isNegative(): boolean {
    return this.cents < 0;
  }

  public equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  public greaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  public greaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents;
  }

  public lessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  public lessThanOrEqual(other: Money): boolean {
    return this.cents <= other.cents;
  }

  /**
   * Retorna la representación decimal para presentación o APIs externas (ej: 1250 centavos -> 12.50).
   */
  public toDecimal(): number {
    return this.cents / 100;
  }

  /**
   * Retorna el valor bruto entero en centavos para persistencia en base de datos.
   */
  public toCents(): number {
    return this.cents;
  }

  /**
   * Formato legible para visualización en moneda estadounidense ($0.00).
   */
  public format(): string {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toDecimal());
  }

  public toString(): string {
    return this.format();
  }
}
