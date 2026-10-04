import { ValidationError } from "@/modules/core/public-api";
import { EcuadorianIdentification } from "@/modules/stakeholders/public-api";

export interface CreateCompanySettingsProps {
  id: string;
  legalName: string;
  tradeName: string;
  ruc: string;
  mainAddress: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  ticketFooterMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Entidad de Dominio para la Configuración Institucional y Fiscal de la Empresa.
 */
export class CompanySettings {
  private readonly id: string;
  private legalName: string;
  private tradeName: string;
  private ruc: string;
  private mainAddress: string;
  private phone?: string;
  private email?: string;
  private website?: string;
  private logoUrl?: string;
  private ticketFooterMessage: string;
  private readonly createdAt: Date;
  private updatedAt: Date;

  public static create(props: CreateCompanySettingsProps): CompanySettings {
    return new CompanySettings(props);
  }

  constructor(props: CreateCompanySettingsProps) {
    if (!props.legalName || props.legalName.trim().length < 3) {
      throw new ValidationError(
        "La razón social de la empresa debe tener al menos 3 caracteres.",
        "INVALID_LEGAL_NAME"
      );
    }

    if (!props.tradeName || props.tradeName.trim().length < 2) {
      throw new ValidationError(
        "El nombre comercial debe tener al menos 2 caracteres.",
        "INVALID_TRADE_NAME"
      );
    }

    // Validación oficial SRI del RUC
    const rucValidation = EcuadorianIdentification.validate("RUC", props.ruc);
    if (!rucValidation.isValid) {
      throw new ValidationError(
        `El RUC de la empresa es inválido: ${rucValidation.error}`,
        "INVALID_COMPANY_RUC"
      );
    }

    if (!props.mainAddress || props.mainAddress.trim().length < 5) {
      throw new ValidationError(
        "La dirección matriz debe tener al menos 5 caracteres.",
        "INVALID_ADDRESS"
      );
    }

    this.id = props.id;
    this.legalName = props.legalName.trim();
    this.tradeName = props.tradeName.trim();
    this.ruc = props.ruc.trim();
    this.mainAddress = props.mainAddress.trim();
    this.phone = props.phone?.trim();
    this.email = props.email?.trim();
    this.website = props.website?.trim();
    this.logoUrl = props.logoUrl?.trim();
    this.ticketFooterMessage =
      props.ticketFooterMessage?.trim() ||
      "¡Gracias por su compra! Cambios válidos dentro de las 48 horas con este ticket.";
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getLegalName(): string {
    return this.legalName;
  }

  public getTradeName(): string {
    return this.tradeName;
  }

  public getRuc(): string {
    return this.ruc;
  }

  public getMainAddress(): string {
    return this.mainAddress;
  }

  public getPhone(): string | undefined {
    return this.phone;
  }

  public getEmail(): string | undefined {
    return this.email;
  }

  public getWebsite(): string | undefined {
    return this.website;
  }

  public getLogoUrl(): string | undefined {
    return this.logoUrl;
  }

  public getTicketFooterMessage(): string {
    return this.ticketFooterMessage;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
