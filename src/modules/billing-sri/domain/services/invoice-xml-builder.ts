import { Money } from "../../../core/domain/value-objects/money.vo";
import { AccessKey } from "../value-objects/access-key.vo";

export interface CompanyTaxInfo {
  ruc: string;
  legalName: string;
  tradeName: string;
  mainAddress: string;
  branchAddress: string;
  establishmentCode: string;
  emissionPointCode: string;
  isAccountingObligated: boolean;
  isRimpeEntrepreneur: boolean;
  isRimpePopularBusiness: boolean;
  retentionAgentResolution?: string | null;
  environment: "1" | "2"; // 1: Test, 2: Production
}

export interface BuyerTaxInfo {
  idType: "04" | "05" | "06" | "07" | "08"; // 04: RUC, 05: Cédula, 06: Pasaporte, 07: Consumidor Final
  idNumber: string;
  legalName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface InvoiceDetailItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  discount: Money;
  taxRate: "IVA_0" | "IVA_15" | "NO_OBJETO" | "EXENTO";
}

export interface PaymentInfo {
  paymentMethodCode: string; // '01' Efectivo, '16' Tarjeta Débito, '19' Tarjeta Crédito, '20' Transferencia
  total: Money;
  termDays?: number;
}

export interface BuildInvoiceXmlProps {
  accessKey: AccessKey;
  sequential: string; // 9 dígitos
  emissionDate: Date;
  company: CompanyTaxInfo;
  buyer: BuyerTaxInfo;
  items: InvoiceDetailItem[];
  payments: PaymentInfo[];
  additionalInfo?: Record<string, string>;
}

export interface BuildCreditNoteXmlProps {
  accessKey: AccessKey;
  sequential: string; // 9 dígitos
  emissionDate: Date;
  company: CompanyTaxInfo;
  buyer: BuyerTaxInfo;
  modifiedDocumentNumber: string; // Ej: '001-001-000000125'
  modifiedDocumentDate: Date;
  modificationReason: string;
  items: InvoiceDetailItem[];
  additionalInfo?: Record<string, string>;
}

export class InvoiceXmlBuilder {
  /**
   * Escapa caracteres especiales según la especificación XML del SRI.
   */
  public static escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Formatea un objeto Date a dd/mm/aaaa para infoFactura.
   */
  public static formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Construye el documento XML oficial v1.1.0 para Factura Electrónica.
   */
  public static buildInvoiceXml(props: BuildInvoiceXmlProps): string {
    const { accessKey, sequential, emissionDate, company, buyer, items, payments, additionalInfo } = props;

    // Cálculos de subtotales por tarifa de IVA
    let subtotal0Cents = 0;
    let subtotal15Cents = 0;
    let totalDiscountCents = 0;

    const detailsXml = items
      .map((item) => {
        const itemQuantity = item.quantity;
        const unitPriceDecimal = (item.unitPrice.toCents() / 100).toFixed(2);
        const discountDecimal = (item.discount.toCents() / 100).toFixed(2);
        const itemTotalSinImpuestoCents = Math.round(
          itemQuantity * item.unitPrice.toCents() - item.discount.toCents()
        );
        const itemTotalSinImpuestoDecimal = (itemTotalSinImpuestoCents / 100).toFixed(2);

        totalDiscountCents += item.discount.toCents();

        let taxCodePercentage = "0"; // 0 = IVA 0%
        let taxRatePercent = "0.00";
        let taxValueCents = 0;

        if (item.taxRate === "IVA_15") {
          taxCodePercentage = "4"; // Código SRI para IVA 15%
          taxRatePercent = "15.00";
          taxValueCents = Math.round((itemTotalSinImpuestoCents * 15) / 100);
          subtotal15Cents += itemTotalSinImpuestoCents;
        } else {
          subtotal0Cents += itemTotalSinImpuestoCents;
        }

        const taxValueDecimal = (taxValueCents / 100).toFixed(2);

        return `    <detalle>
      <codigoPrincipal>${InvoiceXmlBuilder.escapeXml(item.code)}</codigoPrincipal>
      <descripcion>${InvoiceXmlBuilder.escapeXml(item.description)}</descripcion>
      <cantidad>${itemQuantity.toFixed(2)}</cantidad>
      <precioUnitario>${unitPriceDecimal}</precioUnitario>
      <descuento>${discountDecimal}</descuento>
      <precioTotalSinImpuesto>${itemTotalSinImpuestoDecimal}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${taxCodePercentage}</codigoPorcentaje>
          <tarifa>${taxRatePercent}</tarifa>
          <baseImponible>${itemTotalSinImpuestoDecimal}</baseImponible>
          <valor>${taxValueDecimal}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
      })
      .join("\n");

    const totalSinImpuestosCents = subtotal0Cents + subtotal15Cents;
    const totalSinImpuestosDecimal = (totalSinImpuestosCents / 100).toFixed(2);
    const totalDiscountDecimal = (totalDiscountCents / 100).toFixed(2);

    const totalIvaCents = Math.round((subtotal15Cents * 15) / 100);
    const totalIvaDecimal = (totalIvaCents / 100).toFixed(2);
    const totalImporteCents = totalSinImpuestosCents + totalIvaCents;
    const totalImporteDecimal = (totalImporteCents / 100).toFixed(2);

    // Agrupación de impuestos para totalConImpuestos
    const totalImpuestosXml: string[] = [];
    if (subtotal0Cents > 0 || (subtotal0Cents === 0 && subtotal15Cents === 0)) {
      totalImpuestosXml.push(`      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${(subtotal0Cents / 100).toFixed(2)}</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>`);
    }
    if (subtotal15Cents > 0) {
      totalImpuestosXml.push(`      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>${(subtotal15Cents / 100).toFixed(2)}</baseImponible>
        <valor>${totalIvaDecimal}</valor>
      </totalImpuesto>`);
    }

    // Pagos
    const pagosXml = payments
      .map(
        (p) => `      <pago>
        <formaPago>${p.paymentMethodCode}</formaPago>
        <total>${(p.total.toCents() / 100).toFixed(2)}</total>
        <plazo>${p.termDays ?? 0}</plazo>
        <unidadTiempo>dias</unidadTiempo>
      </pago>`
      )
      .join("\n");

    // Leyendas RIMPE y Agente Retención
    let rimpeXml = "";
    if (company.isRimpeEntrepreneur) {
      rimpeXml = "\n    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>";
    } else if (company.isRimpePopularBusiness) {
      rimpeXml = "\n    <contribuyenteRimpe>CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</contribuyenteRimpe>";
    }

    let agenteRetencionXml = "";
    if (company.retentionAgentResolution) {
      agenteRetencionXml = `\n    <agenteRetencion>${InvoiceXmlBuilder.escapeXml(
        company.retentionAgentResolution
      )}</agenteRetencion>`;
    }

    // Información adicional
    const infoAdicionalMap: Record<string, string> = { ...additionalInfo };
    if (buyer.email) infoAdicionalMap["Email"] = buyer.email;
    if (buyer.phone) infoAdicionalMap["Telefono"] = buyer.phone;
    if (buyer.address) infoAdicionalMap["Direccion"] = buyer.address;

    const additionalXmlEntries = Object.entries(infoAdicionalMap)
      .filter(([, val]) => Boolean(val && val.trim().length > 0))
      .map(
        ([key, val]) =>
          `    <campoAdicional nombre="${InvoiceXmlBuilder.escapeXml(key)}">${InvoiceXmlBuilder.escapeXml(
            val
          )}</campoAdicional>`
      );

    const infoAdicionalXml =
      additionalXmlEntries.length > 0
        ? `\n  <infoAdicional>\n${additionalXmlEntries.join("\n")}\n  </infoAdicional>`
        : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${company.environment}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${InvoiceXmlBuilder.escapeXml(company.legalName)}</razonSocial>
    <nombreComercial>${InvoiceXmlBuilder.escapeXml(company.tradeName)}</nombreComercial>
    <ruc>${company.ruc}</ruc>
    <claveAcceso>${accessKey.getValue()}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${company.establishmentCode}</estab>
    <ptoEmi>${company.emissionPointCode}</ptoEmi>
    <secuencial>${sequential}</secuencial>
    <dirMatriz>${InvoiceXmlBuilder.escapeXml(company.mainAddress)}</dirMatriz>${rimpeXml}${agenteRetencionXml}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${InvoiceXmlBuilder.formatDate(emissionDate)}</fechaEmision>
    <dirEstablecimiento>${InvoiceXmlBuilder.escapeXml(company.branchAddress)}</dirEstablecimiento>
    <obligadoContabilidad>${company.isAccountingObligated ? "SI" : "NO"}</obligadoContabilidad>
    <tipoIdentificacionComprador>${buyer.idType}</tipoIdentificacionComprador>
    <razonSocialComprador>${InvoiceXmlBuilder.escapeXml(buyer.legalName)}</razonSocialComprador>
    <identificacionComprador>${buyer.idNumber}</identificacionComprador>
    <totalSinImpuestos>${totalSinImpuestosDecimal}</totalSinImpuestos>
    <totalDescuento>${totalDiscountDecimal}</totalDescuento>
    <totalConImpuestos>
${totalImpuestosXml.join("\n")}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${totalImporteDecimal}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
${pagosXml}
    </pagos>
  </infoFactura>
  <detalles>
${detailsXml}
  </detalles>${infoAdicionalXml}
</factura>`;
  }

  /**
   * Construye el documento XML oficial v1.1.0 para Nota de Crédito (código 04).
   */
  public static buildCreditNoteXml(props: BuildCreditNoteXmlProps): string {
    const {
      accessKey,
      sequential,
      emissionDate,
      company,
      buyer,
      modifiedDocumentNumber,
      modifiedDocumentDate,
      modificationReason,
      items,
      additionalInfo,
    } = props;

    let subtotal0Cents = 0;
    let subtotal15Cents = 0;

    const detailsXml = items
      .map((item) => {
        const itemQuantity = item.quantity;
        const unitPriceDecimal = (item.unitPrice.toCents() / 100).toFixed(2);
        const itemTotalSinImpuestoCents = Math.round(
          itemQuantity * item.unitPrice.toCents() - item.discount.toCents()
        );
        const itemTotalSinImpuestoDecimal = (itemTotalSinImpuestoCents / 100).toFixed(2);

        let taxCodePercentage = "0";
        let taxRatePercent = "0.00";
        let taxValueCents = 0;

        if (item.taxRate === "IVA_15") {
          taxCodePercentage = "4";
          taxRatePercent = "15.00";
          taxValueCents = Math.round((itemTotalSinImpuestoCents * 15) / 100);
          subtotal15Cents += itemTotalSinImpuestoCents;
        } else {
          subtotal0Cents += itemTotalSinImpuestoCents;
        }

        const taxValueDecimal = (taxValueCents / 100).toFixed(2);

        return `    <detalle>
      <codigoInterno>${InvoiceXmlBuilder.escapeXml(item.code)}</codigoInterno>
      <descripcion>${InvoiceXmlBuilder.escapeXml(item.description)}</descripcion>
      <cantidad>${itemQuantity.toFixed(2)}</cantidad>
      <precioUnitario>${unitPriceDecimal}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${itemTotalSinImpuestoDecimal}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${taxCodePercentage}</codigoPorcentaje>
          <tarifa>${taxRatePercent}</tarifa>
          <baseImponible>${itemTotalSinImpuestoDecimal}</baseImponible>
          <valor>${taxValueDecimal}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
      })
      .join("\n");

    const totalSinImpuestosCents = subtotal0Cents + subtotal15Cents;
    const totalSinImpuestosDecimal = (totalSinImpuestosCents / 100).toFixed(2);
    const totalIvaCents = Math.round((subtotal15Cents * 15) / 100);
    const totalIvaDecimal = (totalIvaCents / 100).toFixed(2);
    const totalValorModificacionCents = totalSinImpuestosCents + totalIvaCents;
    const totalValorModificacionDecimal = (totalValorModificacionCents / 100).toFixed(2);

    const totalImpuestosXml: string[] = [];
    if (subtotal0Cents > 0 || (subtotal0Cents === 0 && subtotal15Cents === 0)) {
      totalImpuestosXml.push(`      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${(subtotal0Cents / 100).toFixed(2)}</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>`);
    }
    if (subtotal15Cents > 0) {
      totalImpuestosXml.push(`      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>${(subtotal15Cents / 100).toFixed(2)}</baseImponible>
        <valor>${totalIvaDecimal}</valor>
      </totalImpuesto>`);
    }

    const infoAdicionalMap: Record<string, string> = { ...additionalInfo };
    if (buyer.email) infoAdicionalMap["Email"] = buyer.email;
    if (buyer.phone) infoAdicionalMap["Telefono"] = buyer.phone;
    if (buyer.address) infoAdicionalMap["Direccion"] = buyer.address;

    const additionalXmlEntries = Object.entries(infoAdicionalMap)
      .filter(([, val]) => Boolean(val && val.trim().length > 0))
      .map(
        ([key, val]) =>
          `    <campoAdicional nombre="${InvoiceXmlBuilder.escapeXml(key)}">${InvoiceXmlBuilder.escapeXml(
            val
          )}</campoAdicional>`
      );

    const infoAdicionalXml =
      additionalXmlEntries.length > 0
        ? `\n  <infoAdicional>\n${additionalXmlEntries.join("\n")}\n  </infoAdicional>`
        : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${company.environment}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${InvoiceXmlBuilder.escapeXml(company.legalName)}</razonSocial>
    <nombreComercial>${InvoiceXmlBuilder.escapeXml(company.tradeName)}</nombreComercial>
    <ruc>${company.ruc}</ruc>
    <claveAcceso>${accessKey.getValue()}</claveAcceso>
    <codDoc>04</codDoc>
    <estab>${company.establishmentCode}</estab>
    <ptoEmi>${company.emissionPointCode}</ptoEmi>
    <secuencial>${sequential}</secuencial>
    <dirMatriz>${InvoiceXmlBuilder.escapeXml(company.mainAddress)}</dirMatriz>
  </infoTributaria>
  <infoNotaCredito>
    <fechaEmision>${InvoiceXmlBuilder.formatDate(emissionDate)}</fechaEmision>
    <dirEstablecimiento>${InvoiceXmlBuilder.escapeXml(company.branchAddress)}</dirEstablecimiento>
    <tipoIdentificacionComprador>${buyer.idType}</tipoIdentificacionComprador>
    <razonSocialComprador>${InvoiceXmlBuilder.escapeXml(buyer.legalName)}</razonSocialComprador>
    <identificacionComprador>${buyer.idNumber}</identificacionComprador>
    <obligadoContabilidad>${company.isAccountingObligated ? "SI" : "NO"}</obligadoContabilidad>
    <codDocModificado>01</codDocModificado>
    <numDocModificado>${modifiedDocumentNumber}</numDocModificado>
    <fechaEmisionDocSustento>${InvoiceXmlBuilder.formatDate(modifiedDocumentDate)}</fechaEmisionDocSustento>
    <totalSinImpuestos>${totalSinImpuestosDecimal}</totalSinImpuestos>
    <motivo>${InvoiceXmlBuilder.escapeXml(modificationReason)}</motivo>
    <totalConImpuestos>
${totalImpuestosXml.join("\n")}
    </totalConImpuestos>
    <valorModificacion>${totalValorModificacionDecimal}</valorModificacion>
  </infoNotaCredito>
  <detalles>
${detailsXml}
  </detalles>${infoAdicionalXml}
</notaCredito>`;
  }
}
