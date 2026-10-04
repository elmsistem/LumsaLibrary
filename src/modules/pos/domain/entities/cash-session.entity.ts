import { assertUUID, generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export type CashSessionStatus = "OPEN" | "CLOSED";

export interface OpenCashSessionProps {
  id?: string;
  userId: string;
  terminalCode: string;
  establishmentCode?: string;
  emissionPointCode?: string;
  initialFloat: Money;
  openingTime?: Date;
}

export class CashSession {
  private readonly id: string;
  private readonly userId: string;
  private readonly terminalCode: string;
  private readonly establishmentCode: string;
  private readonly emissionPointCode: string;
  private readonly openingTime: Date;
  private closingTime: Date | null;
  private readonly initialFloat: Money;
  private declaredCash: Money | null;
  private expectedCash: Money | null;
  private discrepancy: Money | null;
  private status: CashSessionStatus;
  private closingNotes: string | null;

  private constructor(props: {
    id: string;
    userId: string;
    terminalCode: string;
    establishmentCode: string;
    emissionPointCode: string;
    openingTime: Date;
    closingTime: Date | null;
    initialFloat: Money;
    declaredCash: Money | null;
    expectedCash: Money | null;
    discrepancy: Money | null;
    status: CashSessionStatus;
    closingNotes: string | null;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.terminalCode = props.terminalCode;
    this.establishmentCode = props.establishmentCode;
    this.emissionPointCode = props.emissionPointCode;
    this.openingTime = props.openingTime;
    this.closingTime = props.closingTime;
    this.initialFloat = props.initialFloat;
    this.declaredCash = props.declaredCash;
    this.expectedCash = props.expectedCash;
    this.discrepancy = props.discrepancy;
    this.status = props.status;
    this.closingNotes = props.closingNotes;
  }

  public static open(props: OpenCashSessionProps): CashSession {
    const id = props.id || generateUUIDv7();
    assertUUID(id, "ID de sesión de caja inválido.");
    assertUUID(props.userId, "ID de cajero/usuario inválido.");

    if (!props.terminalCode || props.terminalCode.trim().length === 0) {
      throw new ValidationError(
        "Debe especificar el código de terminal de la caja (ej: POS-01).",
        "INVALID_TERMINAL_CODE"
      );
    }

    if (props.initialFloat.toCents() < 0) {
      throw new ValidationError(
        "El fondo inicial de caja (sencillo) no puede ser negativo.",
        "NEGATIVE_INITIAL_FLOAT"
      );
    }

    return new CashSession({
      id,
      userId: props.userId,
      terminalCode: props.terminalCode.trim().toUpperCase(),
      establishmentCode: props.establishmentCode || "001",
      emissionPointCode: props.emissionPointCode || "001",
      openingTime: props.openingTime || new Date(),
      closingTime: null,
      initialFloat: props.initialFloat,
      declaredCash: null,
      expectedCash: null,
      discrepancy: null,
      status: "OPEN",
      closingNotes: null,
    });
  }

  public static reconstitute(props: {
    id: string;
    userId: string;
    terminalCode: string;
    establishmentCode: string;
    emissionPointCode: string;
    openingTime: Date;
    closingTime: Date | null;
    initialFloat: Money;
    declaredCash: Money | null;
    expectedCash: Money | null;
    discrepancy: Money | null;
    status: CashSessionStatus;
    closingNotes: string | null;
  }): CashSession {
    return new CashSession(props);
  }

  public getId(): string {
    return this.id;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getTerminalCode(): string {
    return this.terminalCode;
  }

  public getEstablishmentCode(): string {
    return this.establishmentCode;
  }

  public getEmissionPointCode(): string {
    return this.emissionPointCode;
  }

  public getOpeningTime(): Date {
    return this.openingTime;
  }

  public getClosingTime(): Date | null {
    return this.closingTime;
  }

  public getInitialFloat(): Money {
    return this.initialFloat;
  }

  public getDeclaredCash(): Money | null {
    return this.declaredCash;
  }

  public getExpectedCash(): Money | null {
    return this.expectedCash;
  }

  public getDiscrepancy(): Money | null {
    return this.discrepancy;
  }

  public getStatus(): CashSessionStatus {
    return this.status;
  }

  public getClosingNotes(): string | null {
    return this.closingNotes;
  }

  public isOpen(): boolean {
    return this.status === "OPEN";
  }

  /**
   * Cierre ciego de caja: Registra el monto declarado físicamente por el cajero,
   * lo compara contra el esperado del sistema y calcula la diferencia matemática.
   */
  public closeBlind(declaredCash: Money, expectedCash: Money, notes?: string): void {
    if (this.status === "CLOSED") {
      throw new ValidationError(
        "La sesión de caja ya se encuentra cerrada.",
        "CASH_SESSION_ALREADY_CLOSED"
      );
    }

    if (declaredCash.toCents() < 0) {
      throw new ValidationError(
        "El monto de efectivo declarado no puede ser negativo.",
        "NEGATIVE_DECLARED_CASH"
      );
    }

    this.declaredCash = declaredCash;
    this.expectedCash = expectedCash;
    // Discrepancia: Declarado - Esperado (Positivo = Sobrante, Negativo = Faltante)
    this.discrepancy = declaredCash.subtract(expectedCash);
    this.status = "CLOSED";
    this.closingTime = new Date();
    this.closingNotes = notes?.trim() || null;
  }
}
