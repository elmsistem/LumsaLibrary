import { XMLParser } from "fast-xml-parser";
import { Money, ValidationError } from "@/modules/core/public-api";
import { TaxRate } from "@/modules/catalog/public-api";

export interface ParsedSupplierInvoiceItem {
  supplierCode: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  discount: Money;
  totalPrice: Money;
  taxRate: TaxRate;
}

export interface ParsedSupplierInvoice {
  supplierRuc: string;
  supplierLegalName: string;
  supplierCommercialName?: string;
  supplierAddress?: string;
  invoiceNumber: string; // 001-001-000000123
  accessKey: string;
  authorizationNumber: string;
  emissionDate: Date;
  subtotal0: Money;
  subtotal15: Money;
  totalDiscount: Money;
  totalIva: Money;
  totalAmount: Money;
  items: ParsedSupplierInvoiceItem[];
}

interface RawXmlFactura {
  infoTributaria?: {
    ruc?: string;
    razonSocial?: string;
    nombreComercial?: string;
    estab?: string;
    ptoEmi?: string;
    secuencial?: string;
    claveAcceso?: string;
    dirMatriz?: string;
  };
  infoFactura?: {
    fechaEmision?: string;
    dirEstablecimiento?: string;
    obligadoContabilidad?: string;
    tipoIdentificacionComprador?: string;
    razonSocialComprador?: string;
    identificacionComprador?: string;
    totalSinImpuestos?: string;
    totalDescuento?: string;
    totalConImpuestos?: {
      totalImpuesto?:
        | Array<{
            codigo?: string;
            codigoPorcentaje?: string;
            baseImponible?: string;
            valor?: string;
          }>
        | {
            codigo?: string;
            codigoPorcentaje?: string;
            baseImponible?: string;
            valor?: string;
          };
    };
    propina?: string;
    importeTotal?: string;
    moneda?: string;
  };
  detalles?: {
    detalle?:
      | Array<{
          codigoPrincipal?: string;
          codigoAuxiliar?: string;
          descripcion?: string;
          cantidad?: string;
          precioUnitario?: string;
          descuento?: string;
          precioTotalSinImpuesto?: string;
          impuestos?: {
            impuesto?:
              | Array<{
                  codigo?: string;
                  codigoPorcentaje?: string;
                  tarifa?: string;
                  baseImponible?: string;
                  valor?: string;
                }>
              | {
                  codigo?: string;
                  codigoPorcentaje?: string;
                  tarifa?: string;
                  baseImponible?: string;
                  valor?: string;
                };
          };
        }>
      | {
          codigoPrincipal?: string;
          codigoAuxiliar?: string;
          descripcion?: string;
          cantidad?: string;
          precioUnitario?: string;
          descuento?: string;
          precioTotalSinImpuesto?: string;
          impuestos?: {
            impuesto?:
              | Array<{
                  codigo?: string;
                  codigoPorcentaje?: string;
                  tarifa?: string;
                  baseImponible?: string;
                  valor?: string;
                }>
              | {
                  codigo?: string;
                  codigoPorcentaje?: string;
                  tarifa?: string;
                  baseImponible?: string;
                  valor?: string;
                };
          };
        };
  };
}

interface RawXmlEnvelope {
  autorizacion?: {
    numeroAutorizacion?: string;
    fechaAutorizacion?: string;
    comprobante?: string | { factura?: RawXmlFactura };
  };
  factura?: RawXmlFactura;
}

/**
 * Parser inteligente de comprobantes XML de compras emitidos por proveedores del SRI.
 * Soporta tanto XML individuales como respuestas completas del web service de autorización SRI.
 */
export class SriXmlInvoiceParserService {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: false, // Mantener valores como strings para no perder ceros a la izquierda ni precisión
    });
  }

  public parse(xmlContent: string): ParsedSupplierInvoice {
    if (!xmlContent || xmlContent.trim().length === 0) {
      throw new ValidationError("El contenido XML de la factura está vacío.", "EMPTY_XML_CONTENT");
    }

    let parsedObj: RawXmlEnvelope;
    try {
      parsedObj = this.parser.parse(xmlContent) as RawXmlEnvelope;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ValidationError(`Error de sintaxis XML: ${msg}`, "INVALID_XML_SYNTAX");
    }

    let facturaNode: RawXmlFactura | undefined;
    let authorizationNumber: string | undefined;

    // Caso 1: Envuelto en nodo <autorizacion> del SRI
    if (parsedObj.autorizacion) {
      authorizationNumber = parsedObj.autorizacion.numeroAutorizacion;
      const comprobanteContent = parsedObj.autorizacion.comprobante;

      if (typeof comprobanteContent === "string") {
        // CDATA o string escapado
        const innerParsed = this.parser.parse(comprobanteContent) as RawXmlEnvelope;
        facturaNode = innerParsed.factura;
      } else if (comprobanteContent && comprobanteContent.factura) {
        facturaNode = comprobanteContent.factura;
      }
    } else if (parsedObj.factura) {
      // Caso 2: Factura directa
      facturaNode = parsedObj.factura;
    }

    if (!facturaNode) {
      throw new ValidationError(
        "El XML proporcionado no contiene un comprobante de tipo <factura> válido del SRI.",
        "NOT_A_VALID_SRI_INVOICE_XML"
      );
    }

    const infoTrib = facturaNode.infoTributaria;
    if (!infoTrib) {
      throw new ValidationError("El XML de la factura no contiene la sección <infoTributaria>.", "MISSING_INFO_TRIBUTARIA");
    }

    const infoFactura = facturaNode.infoFactura;
    if (!infoFactura) {
      throw new ValidationError("El XML de la factura no contiene la sección <infoFactura>.", "MISSING_INFO_FACTURA");
    }

    // 1. Datos del Proveedor y Factura
    const supplierRuc = String(infoTrib.ruc || "").trim();
    const supplierLegalName = String(infoTrib.razonSocial || "").trim();
    const supplierCommercialName = infoTrib.nombreComercial ? String(infoTrib.nombreComercial).trim() : undefined;
    const supplierAddress = infoTrib.dirMatriz ? String(infoTrib.dirMatriz).trim() : undefined;

    const estab = String(infoTrib.estab || "").padStart(3, "0");
    const ptoEmi = String(infoTrib.ptoEmi || "").padStart(3, "0");
    const secuencial = String(infoTrib.secuencial || "").padStart(9, "0");
    const invoiceNumber = `${estab}-${ptoEmi}-${secuencial}`;

    const accessKey = String(infoTrib.claveAcceso || "").trim();
    const finalAuthNumber = authorizationNumber || accessKey;

    // 2. Fecha de Emisión (DD/MM/YYYY)
    const rawDate = String(infoFactura.fechaEmision || "").trim();
    const emissionDate = this.parseDate(rawDate);

    // 3. Totales e Impuestos
    const totalAmount = Money.fromDollars(parseFloat(infoFactura.importeTotal || "0"));
    const totalDiscount = Money.fromDollars(parseFloat(infoFactura.totalDescuento || "0"));

    let subtotal0 = Money.zero();
    let subtotal15 = Money.zero();
    let totalIva = Money.zero();

    const totalConImpuestos = infoFactura.totalConImpuestos;
    if (totalConImpuestos && totalConImpuestos.totalImpuesto) {
      const impuestosList = Array.isArray(totalConImpuestos.totalImpuesto)
        ? totalConImpuestos.totalImpuesto
        : [totalConImpuestos.totalImpuesto];

      for (const imp of impuestosList) {
        const codigoPorcentaje = String(imp.codigoPorcentaje || "");
        const base = Money.fromDollars(parseFloat(imp.baseImponible || "0"));
        const valor = Money.fromDollars(parseFloat(imp.valor || "0"));

        totalIva = totalIva.add(valor);

        // En el SRI: codigoPorcentaje '0' es 0%, '4' es 15% (vigente), '2' era 12%, '3' era 14%
        if (codigoPorcentaje === "0") {
          subtotal0 = subtotal0.add(base);
        } else {
          subtotal15 = subtotal15.add(base);
        }
      }
    } else {
      subtotal0 = totalAmount;
    }

    // 4. Ítems / Detalles
    const items: ParsedSupplierInvoiceItem[] = [];
    const detallesNode = facturaNode.detalles;
    if (detallesNode && detallesNode.detalle) {
      const detalleList = Array.isArray(detallesNode.detalle)
        ? detallesNode.detalle
        : [detallesNode.detalle];

      for (const d of detalleList) {
        const supplierCode = String(d.codigoPrincipal || d.codigoAuxiliar || "SIN_CODIGO").trim();
        const description = String(d.descripcion || "").trim();
        const quantity = parseFloat(d.cantidad || "1");
        const unitPrice = Money.fromDollars(parseFloat(d.precioUnitario || "0"));
        const discount = Money.fromDollars(parseFloat(d.descuento || "0"));
        const totalPrice = Money.fromDollars(parseFloat(d.precioTotalSinImpuesto || "0"));

        let taxRate: TaxRate = "IVA_15";
        if (d.impuestos && d.impuestos.impuesto) {
          const imp = Array.isArray(d.impuestos.impuesto) ? d.impuestos.impuesto[0] : d.impuestos.impuesto;
          const codPorc = imp ? String(imp.codigoPorcentaje || "") : "";
          if (codPorc === "0") {
            taxRate = "IVA_0";
          } else if (codPorc === "6") {
            taxRate = "NO_OBJETO";
          } else if (codPorc === "7") {
            taxRate = "EXENTO";
          } else {
            taxRate = "IVA_15";
          }
        }

        items.push({
          supplierCode,
          description,
          quantity,
          unitPrice,
          discount,
          totalPrice,
          taxRate,
        });
      }
    }

    return {
      supplierRuc,
      supplierLegalName,
      supplierCommercialName,
      supplierAddress,
      invoiceNumber,
      accessKey,
      authorizationNumber: finalAuthNumber,
      emissionDate,
      subtotal0,
      subtotal15,
      totalDiscount,
      totalIva,
      totalAmount,
      items,
    };
  }

  private parseDate(dateStr: string): Date {
    // Formato habitual en XML SRI: DD/MM/YYYY
    const parts = dateStr.split("/");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(Date.UTC(year, month, day));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }
}
