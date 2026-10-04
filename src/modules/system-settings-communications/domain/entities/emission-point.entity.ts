import { ValidationError } from "@/modules/core/public-api";

export interface CreateEmissionPointProps {
  id: string;
  establishmentCode: string; // '001'
  emissionPointCode: string; // '001', '002'
  name: string;
  assignedTerminalMac?: string;
  isActive?: boolean;
  createdAt?: Date;
}

/**
 * Entidad de Dominio para Puntos de Emisión SRI y Cajas Físicas.
 */
export class EmissionPoint {
  private readonly id: string;
  private readonly establishmentCode: string;
  private readonly emissionPointCode: string;
  private name: string;
  private assignedTerminalMac?: string;
  private isActive: boolean;
  private readonly createdAt: Date;

  public static create(props: CreateEmissionPointProps): EmissionPoint {
    return new EmissionPoint(props);
  }

  constructor(props: CreateEmissionPointProps) {
    if (!/^\d{3}$/.test(props.establishmentCode)) {
      throw new ValidationError(
        "El código de establecimiento debe tener exactamente 3 dígitos numéricos (ej. '001').",
        "INVALID_ESTABLISHMENT_CODE"
      );
    }

    if (!/^\d{3}$/.test(props.emissionPointCode)) {
      throw new ValidationError(
        "El código de punto de emisión debe tener exactamente 3 dígitos numéricos (ej. '001').",
        "INVALID_EMISSION_POINT_CODE"
      );
    }

    if (!props.name || props.name.trim().length < 2) {
      throw new ValidationError(
        "El nombre descriptivo de la caja debe tener al menos 2 caracteres.",
        "INVALID_EMISSION_POINT_NAME"
      );
    }

    this.id = props.id;
    this.establishmentCode = props.establishmentCode;
    this.emissionPointCode = props.emissionPointCode;
    this.name = props.name.trim();
    this.assignedTerminalMac = props.assignedTerminalMac?.trim();
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
  }

  public getFullCode(): string {
    return `${this.establishmentCode}-${this.emissionPointCode}`;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public activate(): void {
    this.isActive = true;
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getEstablishmentCode(): string {
    return this.establishmentCode;
  }

  public getEmissionPointCode(): string {
    return this.emissionPointCode;
  }

  public getName(): string {
    return this.name;
  }

  public getAssignedTerminalMac(): string | undefined {
    return this.assignedTerminalMac;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
