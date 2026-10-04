import { assertUUID, generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { AccessKey } from "../value-objects/access-key.vo";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export type ElectronicInvoiceStatus =
  | "PENDING_GENERATION"
  | "SIGNED"
  | "TRANSMITTED"
  | "RECEIVED"
  | "AUTHORIZED"
  | "REJECTED"
  | "NOT_AUTHORIZED"
  | "CANCELLED";

export interface CreateElectronicInvoiceProps {
  id?: string;
  documentTypeCode?: "01" | "04";
  accessKey: AccessKey;
  establishmentCode: string;
  emissionPointCode: string;
  sequentialNumber: string;
  emissionDate: Date;
  customerId: string;
  saleOrderId?: string | null;
  status?: ElectronicInvoiceStatus;
  modifiedInvoiceNumber?: string | null;
  modifiedInvoiceAccessKey?: string | null;
  modificationReason?: string | null;
  subtotal0: Money;
  subtotal15: Money;
  totalDiscount: Money;
  totalIva: Money;
  totalAmount: Money;
  authorizationNumber?: string | null;
  authorizationDate?: Date | null;
  sriErrorMessage?: string | null;
  xmlSignedPath?: string | null;
  ridePdfPath?: string | null;
  createdAt?: Date;
}

export class ElectronicInvoice {
  private readonly id: string;
  private readonly documentTypeCode: "01" | "04";
  private readonly accessKey: AccessKey;
  private readonly establishmentCode: string;
  private readonly emissionPointCode: string;
  private readonly sequentialNumber: string;
  private readonly emissionDate: Date;
  private readonly customerId: string;
  private readonly saleOrderId: string | null;
  private status: ElectronicInvoiceStatus;
  private readonly modifiedInvoiceNumber: string | null;
  private readonly modifiedInvoiceAccessKey: string | null;
  private readonly modificationReason: string | null;
  private readonly subtotal0: Money;
  private readonly subtotal15: Money;
  private readonly totalDiscount: Money;
  private readonly totalIva: Money;
  private readonly totalAmount: Money;
  private authorizationNumber: string | null;
  private authorizationDate: Date | null;
  private sriErrorMessage: string | null;
  private xmlSignedPath: string | null;
  private ridePdfPath: string | null;
  private readonly createdAt: Date;

  private constructor(props: {
    id: string;
    documentTypeCode: "01" | "04";
    accessKey: AccessKey;
    establishmentCode: string;
    emissionPointCode: string;
    sequentialNumber: string;
    emissionDate: Date;
    customerId: string;
    saleOrderId: string | null;
    status: ElectronicInvoiceStatus;
    modifiedInvoiceNumber: string | null;
    modifiedInvoiceAccessKey: string | null;
    modificationReason: string | null;
    subtotal0: Money;
    subtotal15: Money;
    totalDiscount: Money;
    totalIva: Money;
    totalAmount: Money;
    authorizationNumber: string | null;
    authorizationDate: Date | null;
    sriErrorMessage: string | null;
    xmlSignedPath: string | null;
    ridePdfPath: string | null;
    createdAt: Date;
  }) {
    this.id = props.id;
    this.documentTypeCode = props.documentTypeCode;
    this.accessKey = props.accessKey;
    this.establishmentCode = props.establishmentCode;
    this.emissionPointCode = props.emissionPointCode;
    this.sequentialNumber = props.sequentialNumber;
    this.emissionDate = props.emissionDate;
    this.customerId = props.customerId;
    this.saleOrderId = props.saleOrderId;
    this.status = props.status;
    this.modifiedInvoiceNumber = props.modifiedInvoiceNumber;
    this.modifiedInvoiceAccessKey = props.modifiedInvoiceAccessKey;
    this.modificationReason = props.modificationReason;
    this.subtotal0 = props.subtotal0;
    this.subtotal15 = props.subtotal15;
    this.totalDiscount = props.totalDiscount;
    this.totalIva = props.totalIva;
    this.totalAmount = props.totalAmount;
    this.authorizationNumber = props.authorizationNumber;
    this.authorizationDate = props.authorizationDate;
    this.sriErrorMessage = props.sriErrorMessage;
    this.xmlSignedPath = props.xmlSignedPath;
    this.ridePdfPath = props.ridePdfPath;
    this.createdAt = props.createdAt;
  }

  public static create(props: CreateElectronicInvoiceProps): ElectronicInvoice {
    const id = props.id || generateUUIDv7();
    assertUUID(id, "ID de comprobante inválido.");
    assertUUID(props.customerId, "ID de cliente inválido.");

    if (props.saleOrderId) {
      assertUUID(props.saleOrderId, "ID de orden de venta inválido.");
    }

    if (!/^\d{3}$/.test(props.establishmentCode)) {
      throw new ValidationError(
        "El código de establecimiento debe tener exactamente 3 dígitos numéricos (ej: 001).",
        "INVALID_ESTABLISHMENT_CODE"
      );
    }

    if (!/^\d{3}$/.test(props.emissionPointCode)) {
      throw new ValidationError(
        "El código de punto de emisión debe tener exactamente 3 dígitos numéricos (ej: 001).",
        "INVALID_EMISSION_POINT_CODE"
      );
    }

    if (!/^\d{9}$/.test(props.sequentialNumber)) {
      throw new ValidationError(
        "El número secuencial debe tener exactamente 9 dígitos numéricos (ej: 000000125).",
        "INVALID_SEQUENTIAL_NUMBER"
      );
    }

    return new ElectronicInvoice({
      id,
      documentTypeCode: props.documentTypeCode || "01",
      accessKey: props.accessKey,
      establishmentCode: props.establishmentCode,
      emissionPointCode: props.emissionPointCode,
      sequentialNumber: props.sequentialNumber,
      emissionDate: props.emissionDate,
      customerId: props.customerId,
      saleOrderId: props.saleOrderId || null,
      status: props.status || "PENDING_GENERATION",
      modifiedInvoiceNumber: props.modifiedInvoiceNumber || null,
      modifiedInvoiceAccessKey: props.modifiedInvoiceAccessKey || null,
      modificationReason: props.modificationReason || null,
      subtotal0: props.subtotal0,
      subtotal15: props.subtotal15,
      totalDiscount: props.totalDiscount,
      totalIva: props.totalIva,
      totalAmount: props.totalAmount,
      authorizationNumber: props.authorizationNumber || null,
      authorizationDate: props.authorizationDate || null,
      sriErrorMessage: props.sriErrorMessage || null,
      xmlSignedPath: props.xmlSignedPath || null,
      ridePdfPath: props.ridePdfPath || null,
      createdAt: props.createdAt || new Date(),
    });
  }

  public getId(): string {
    return this.id;
  }

  public getDocumentTypeCode(): "01" | "04" {
    return this.documentTypeCode;
  }

  public getAccessKey(): AccessKey {
    return this.accessKey;
  }

  public getEstablishmentCode(): string {
    return this.establishmentCode;
  }

  public getEmissionPointCode(): string {
    return this.emissionPointCode;
  }

  public getSequentialNumber(): string {
    return this.sequentialNumber;
  }

  public getFormattedDocumentNumber(): string {
    return `${this.establishmentCode}-${this.emissionPointCode}-${this.sequentialNumber}`;
  }

  public getEmissionDate(): Date {
    return this.emissionDate;
  }

  public getCustomerId(): string {
    return this.customerId;
  }

  public getSaleOrderId(): string | null {
    return this.saleOrderId;
  }

  public getStatus(): ElectronicInvoiceStatus {
    return this.status;
  }

  public getSubtotal0(): Money {
    return this.subtotal0;
  }

  public getSubtotal15(): Money {
    return this.subtotal15;
  }

  public getTotalDiscount(): Money {
    return this.totalDiscount;
  }

  public getTotalIva(): Money {
    return this.totalIva;
  }

  public getTotalAmount(): Money {
    return this.totalAmount;
  }

  public getAuthorizationNumber(): string | null {
    return this.authorizationNumber;
  }

  public getAuthorizationDate(): Date | null {
    return this.authorizationDate;
  }

  public getSriErrorMessage(): string | null {
    return this.sriErrorMessage;
  }

  public getXmlSignedPath(): string | null {
    return this.xmlSignedPath;
  }

  public getRidePdfPath(): string | null {
    return this.ridePdfPath;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public markAsAuthorized(authNumber: string, authDate: Date): void {
    this.status = "AUTHORIZED";
    this.authorizationNumber = authNumber;
    this.authorizationDate = authDate;
    this.sriErrorMessage = null;
  }

  public markAsRejected(errorMessage: string): void {
    this.status = "REJECTED";
    this.sriErrorMessage = errorMessage;
  }

  public markAsSigned(xmlPath: string): void {
    this.status = "SIGNED";
    this.xmlSignedPath = xmlPath;
  }
}
