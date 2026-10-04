import { BillingSriRepository } from "../../domain/repositories/billing-sri.repository";
import { ElectronicInvoice } from "../../domain/entities/electronic-invoice.entity";
import { AccessKey } from "../../domain/value-objects/access-key.vo";
import {
  InvoiceXmlBuilder,
  BuyerTaxInfo,
  InvoiceDetailItem,
  PaymentInfo,
  CompanyTaxInfo,
} from "../../domain/services/invoice-xml-builder";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ConsumidorFinalRule } from "../../../stakeholders/domain/rules/consumidor-final.rule";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface CreateElectronicInvoiceDto {
  documentTypeCode?: "01" | "04";
  establishmentCode: string;
  emissionPointCode: string;
  emissionDate?: Date;
  customerId: string;
  saleOrderId?: string | null;
  buyer: BuyerTaxInfo;
  items: InvoiceDetailItem[];
  payments: PaymentInfo[];
  // Campos específicos para Notas de Crédito
  modifiedInvoiceNumber?: string | null;
  modifiedInvoiceAccessKey?: string | null;
  modifiedInvoiceDate?: Date;
  modificationReason?: string | null;
  additionalInfo?: Record<string, string>;
}

export interface CreateElectronicInvoiceResult {
  invoice: ElectronicInvoice;
  xmlGenerated: string;
}

export class CreateElectronicInvoiceUseCase {
  constructor(private readonly repository: BillingSriRepository) {}

  public async execute(dto: CreateElectronicInvoiceDto): Promise<CreateElectronicInvoiceResult> {
    if (!dto.items || dto.items.length === 0) {
      throw new ValidationError(
        "El comprobante debe tener al menos un ítem o detalle.",
        "EMPTY_INVOICE_ITEMS"
      );
    }

    const companyConfig = await this.repository.getCompanyConfig();
    if (!companyConfig) {
      throw new ValidationError(
        "No se encontró la configuración fiscal de la empresa para facturación SRI.",
        "COMPANY_CONFIG_NOT_FOUND"
      );
    }

    const documentTypeCode = dto.documentTypeCode || "01";
    const emissionDate = dto.emissionDate || new Date();

    // 1. Obtener siguiente secuencial atómico para este punto de emisión
    const sequential = await this.repository.getNextSequential(
      dto.establishmentCode,
      dto.emissionPointCode,
      documentTypeCode
    );

    // 2. Generar Clave de Acceso de 49 dígitos
    const envDigit = companyConfig.environment === "PRODUCTION" ? "2" : "1";
    const accessKey = AccessKey.generate({
      emissionDate,
      documentType: documentTypeCode,
      ruc: companyConfig.ruc,
      environment: envDigit,
      establishment: dto.establishmentCode,
      emissionPoint: dto.emissionPointCode,
      sequential,
    });

    // 3. Cálculos de Totales e Impuestos en centavos enteros
    let subtotal0Cents = 0;
    let subtotal15Cents = 0;
    let totalDiscountCents = 0;

    for (const item of dto.items) {
      const lineTotalCents = Math.round(
        item.quantity * item.unitPrice.toCents() - item.discount.toCents()
      );
      totalDiscountCents += item.discount.toCents();

      if (item.taxRate === "IVA_15") {
        subtotal15Cents += lineTotalCents;
      } else {
        subtotal0Cents += lineTotalCents;
      }
    }

    const subtotal0 = Money.fromCents(subtotal0Cents);
    const subtotal15 = Money.fromCents(subtotal15Cents);
    const totalDiscount = Money.fromCents(totalDiscountCents);
    const totalIva = Money.fromCents(Math.round((subtotal15Cents * 15) / 100));
    const totalAmount = Money.fromCents(subtotal0Cents + subtotal15Cents + totalIva.toCents());

    // 4. Validación de la Ley Ecuatoriana para Consumidor Final (Límite $50.00 USD)
    if (dto.buyer.idType === "07" || dto.buyer.idNumber === "9999999999999") {
      ConsumidorFinalRule.validateTotalAmount(totalAmount);
    }

    // 5. Construcción del XML según tipo de documento
    const companyTaxInfo: CompanyTaxInfo = {
      ruc: companyConfig.ruc,
      legalName: companyConfig.legalName,
      tradeName: companyConfig.tradeName,
      mainAddress: companyConfig.mainAddress,
      branchAddress: companyConfig.branchAddress,
      establishmentCode: dto.establishmentCode,
      emissionPointCode: dto.emissionPointCode,
      isAccountingObligated: companyConfig.isAccountingObligated,
      isRimpeEntrepreneur: companyConfig.isRimpeEntrepreneur,
      isRimpePopularBusiness: companyConfig.isRimpePopularBusiness,
      retentionAgentResolution: companyConfig.retentionAgentResolution,
      environment: envDigit,
    };

    let xmlGenerated = "";
    if (documentTypeCode === "01") {
      xmlGenerated = InvoiceXmlBuilder.buildInvoiceXml({
        accessKey,
        sequential,
        emissionDate,
        company: companyTaxInfo,
        buyer: dto.buyer,
        items: dto.items,
        payments: dto.payments,
        additionalInfo: dto.additionalInfo,
      });
    } else {
      if (!dto.modifiedInvoiceNumber) {
        throw new ValidationError(
          "Debe especificar el número del documento modificado para la Nota de Crédito.",
          "MISSING_MODIFIED_DOCUMENT"
        );
      }
      xmlGenerated = InvoiceXmlBuilder.buildCreditNoteXml({
        accessKey,
        sequential,
        emissionDate,
        company: companyTaxInfo,
        buyer: dto.buyer,
        modifiedDocumentNumber: dto.modifiedInvoiceNumber,
        modifiedDocumentDate: dto.modifiedInvoiceDate || emissionDate,
        modificationReason: dto.modificationReason || "Devolución o anulación parcial",
        items: dto.items,
        additionalInfo: dto.additionalInfo,
      });
    }

    // 6. Instanciar Entidad de Dominio
    const invoice = ElectronicInvoice.create({
      documentTypeCode,
      accessKey,
      establishmentCode: dto.establishmentCode,
      emissionPointCode: dto.emissionPointCode,
      sequentialNumber: sequential,
      emissionDate,
      customerId: dto.customerId,
      saleOrderId: dto.saleOrderId,
      status: "PENDING_GENERATION",
      modifiedInvoiceNumber: dto.modifiedInvoiceNumber,
      modifiedInvoiceAccessKey: dto.modifiedInvoiceAccessKey,
      modificationReason: dto.modificationReason,
      subtotal0,
      subtotal15,
      totalDiscount,
      totalIva,
      totalAmount,
    });

    // 7. Persistir comprobante y encolar en Outbox Pattern
    await this.repository.saveInvoice(invoice);
    await this.repository.enqueueOutbox(invoice.getId());

    return {
      invoice,
      xmlGenerated,
    };
  }
}
