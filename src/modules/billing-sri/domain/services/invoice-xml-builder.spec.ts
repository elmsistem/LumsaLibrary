import { describe, it, expect } from "vitest";
import { InvoiceXmlBuilder, CompanyTaxInfo, BuyerTaxInfo } from "./invoice-xml-builder";
import { AccessKey } from "../value-objects/access-key.vo";
import { Money } from "../../../core/domain/value-objects/money.vo";

describe("InvoiceXmlBuilder (SRI Ecuador XML v1.1.0)", () => {
  const sampleCompany: CompanyTaxInfo = {
    ruc: "1790011223001",
    legalName: "LUMSA LIBRARY CIA. LTDA.",
    tradeName: "LUMSA LIBRARY",
    mainAddress: "Av. Amazonas N24-100 y Colón",
    branchAddress: "Av. Amazonas N24-100",
    establishmentCode: "001",
    emissionPointCode: "002",
    isAccountingObligated: true,
    isRimpeEntrepreneur: true,
    isRimpePopularBusiness: false,
    environment: "1",
  };

  const sampleBuyer: BuyerTaxInfo = {
    idType: "05", // Cédula
    idNumber: "1712345678",
    legalName: "JUAN CARLOS PÉREZ & ASOCIADOS",
    email: "juan.perez@example.com",
    phone: "0991234567",
    address: "La Floresta, Quito",
  };

  const accessKey = AccessKey.generate({
    emissionDate: new Date(2026, 9, 3),
    documentType: "01",
    ruc: sampleCompany.ruc,
    environment: "1",
    establishment: sampleCompany.establishmentCode,
    emissionPoint: sampleCompany.emissionPointCode,
    sequential: 150,
  });

  it("debe generar el XML de Factura v1.1.0 con estructura e impuestos correctos", () => {
    const xml = InvoiceXmlBuilder.buildInvoiceXml({
      accessKey,
      sequential: "000000150",
      emissionDate: new Date(2026, 9, 3),
      company: sampleCompany,
      buyer: sampleBuyer,
      items: [
        {
          code: "LIB-001",
          description: "LIBRO DE TEXTO MATEMÁTICAS",
          quantity: 2,
          unitPrice: Money.fromDollars(10.0), // $20.00
          discount: Money.zero(),
          taxRate: "IVA_0", // Libros gravan 0% en Ecuador
        },
        {
          code: "CUA-002",
          description: "CUADERNO ESPIRAL UNIVERSITARIO",
          quantity: 4,
          unitPrice: Money.fromDollars(2.5), // $10.00
          discount: Money.fromDollars(1.0), // $1.00 desc -> base $9.00
          taxRate: "IVA_15", // Grava IVA 15% ($1.35)
        },
      ],
      payments: [
        {
          paymentMethodCode: "01", // Efectivo
          total: Money.fromDollars(30.35),
        },
      ],
    });

    expect(xml).toContain('<factura id="comprobante" version="1.1.0">');
    expect(xml).toContain("<ambiente>1</ambiente>");
    expect(xml).toContain("<codDoc>01</codDoc>");
    expect(xml).toContain(`<claveAcceso>${accessKey.getValue()}</claveAcceso>`);
    expect(xml).toContain("<secuencial>000000150</secuencial>");
    expect(xml).toContain("<contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>");
    expect(xml).toContain("<obligadoContabilidad>SI</obligadoContabilidad>");
    expect(xml).toContain("<tipoIdentificacionComprador>05</tipoIdentificacionComprador>");

    // Verificación de escape de & en nombre del cliente
    expect(xml).toContain("JUAN CARLOS PÉREZ &amp; ASOCIADOS");

    // Totales calculados: Subtotal 0 = 20.00, Subtotal 15 = 9.00 -> Total sin impuestos = 29.00
    expect(xml).toContain("<totalSinImpuestos>29.00</totalSinImpuestos>");
    expect(xml).toContain("<totalDescuento>1.00</totalDescuento>");
    expect(xml).toContain("<importeTotal>30.35</importeTotal>");

    // Tarifas
    expect(xml).toContain("<codigoPorcentaje>0</codigoPorcentaje>");
    expect(xml).toContain("<codigoPorcentaje>4</codigoPorcentaje>");

    // Pagos
    expect(xml).toContain("<formaPago>01</formaPago>");
    expect(xml).toContain("<total>30.35</total>");

    // Info adicional
    expect(xml).toContain('<campoAdicional nombre="Email">juan.perez@example.com</campoAdicional>');
  });

  it("debe generar el XML de Nota de Crédito v1.1.0 con documento de sustento modificado", () => {
    const ncKey = AccessKey.generate({
      emissionDate: new Date(2026, 9, 3),
      documentType: "04",
      ruc: sampleCompany.ruc,
      environment: "1",
      establishment: "001",
      emissionPoint: "002",
      sequential: 5,
    });

    const xml = InvoiceXmlBuilder.buildCreditNoteXml({
      accessKey: ncKey,
      sequential: "000000005",
      emissionDate: new Date(2026, 9, 3),
      company: sampleCompany,
      buyer: sampleBuyer,
      modifiedDocumentNumber: "001-002-000000150",
      modifiedDocumentDate: new Date(2026, 9, 3),
      modificationReason: "Devolución por cuaderno defectuoso",
      items: [
        {
          code: "CUA-002",
          description: "CUADERNO ESPIRAL UNIVERSITARIO",
          quantity: 1,
          unitPrice: Money.fromDollars(2.5),
          discount: Money.zero(),
          taxRate: "IVA_15",
        },
      ],
    });

    expect(xml).toContain('<notaCredito id="comprobante" version="1.1.0">');
    expect(xml).toContain("<codDoc>04</codDoc>");
    expect(xml).toContain("<numDocModificado>001-002-000000150</numDocModificado>");
    expect(xml).toContain("<motivo>Devolución por cuaderno defectuoso</motivo>");
    expect(xml).toContain("<valorModificacion>2.88</valorModificacion>"); // 2.50 + 0.38 iva
  });
});
