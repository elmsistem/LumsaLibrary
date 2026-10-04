import { describe, it, expect } from "vitest";
import { SriXmlInvoiceParserService } from "./sri-xml-invoice-parser.service";

describe("SriXmlInvoiceParserService", () => {
  const parser = new SriXmlInvoiceParserService();

  const sampleDirectInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>FABER CASTELL ECUADOR S.A.</razonSocial>
    <nombreComercial>FABER CASTELL</nombreComercial>
    <ruc>1790011223001</ruc>
    <claveAcceso>0110202601179001122300120010010000004561234567812</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000000456</secuencial>
    <dirMatriz>Av. de los Granados 500 y 6 de Diciembre</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>01/10/2026</fechaEmision>
    <dirEstablecimiento>Av. de los Granados 500</dirEstablecimiento>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>LUMSA LIBRARY CIA. LTDA.</razonSocialComprador>
    <identificacionComprador>1792003004001</identificacionComprador>
    <totalSinImpuestos>150.00</totalSinImpuestos>
    <totalDescuento>10.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>100.00</baseImponible>
        <valor>15.00</valor>
      </totalImpuesto>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>50.00</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>165.00</importeTotal>
    <moneda>DOLAR</moneda>
  </infoFactura>
  <detalles>
    <detalle>
      <codigoPrincipal>FC-EC-COL-24</codigoPrincipal>
      <descripcion>CAJA COLORES FABER CASTELL 24U</descripcion>
      <cantidad>20.00</cantidad>
      <precioUnitario>5.00</precioUnitario>
      <descuento>5.00</descuento>
      <precioTotalSinImpuesto>95.00</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>15.00</tarifa>
          <baseImponible>95.00</baseImponible>
          <valor>14.25</valor>
        </impuesto>
      </impuestos>
    </detalle>
    <detalle>
      <codigoPrincipal>LIBRO-MAT-ED6</codigoPrincipal>
      <descripcion>LIBRO MATEMATICAS 6TO EGB NORMA</descripcion>
      <cantidad>5.00</cantidad>
      <precioUnitario>11.00</precioUnitario>
      <descuento>5.00</descuento>
      <precioTotalSinImpuesto>50.00</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>0</codigoPorcentaje>
          <tarifa>0.00</tarifa>
          <baseImponible>50.00</baseImponible>
          <valor>0.00</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>
</factura>`;

  it("debe parsear correctamente una factura electrónica XML directa de proveedor", () => {
    const result = parser.parse(sampleDirectInvoiceXml);

    expect(result.supplierRuc).toBe("1790011223001");
    expect(result.supplierLegalName).toBe("FABER CASTELL ECUADOR S.A.");
    expect(result.supplierCommercialName).toBe("FABER CASTELL");
    expect(result.invoiceNumber).toBe("001-001-000000456");
    expect(result.accessKey).toBe("0110202601179001122300120010010000004561234567812");
    expect(result.totalAmount.toCents()).toBe(16500); // $165.00
    expect(result.subtotal15.toCents()).toBe(10000); // $100.00
    expect(result.subtotal0.toCents()).toBe(5000); // $50.00
    expect(result.totalIva.toCents()).toBe(1500); // $15.00
    expect(result.totalDiscount.toCents()).toBe(1000); // $10.00

    expect(result.items).toHaveLength(2);
    const [item1, item2] = result.items;
    expect(item1?.supplierCode).toBe("FC-EC-COL-24");
    expect(item1?.quantity).toBe(20);
    expect(item1?.unitPrice.toCents()).toBe(500);
    expect(item1?.taxRate).toBe("IVA_15");

    expect(item2?.supplierCode).toBe("LIBRO-MAT-ED6");
    expect(item2?.quantity).toBe(5);
    expect(item2?.unitPrice.toCents()).toBe(1100);
    expect(item2?.taxRate).toBe("IVA_0");
  });

  it("debe parsear comprobantes envueltos en el nodo <autorizacion> con CDATA", () => {
    const wrappedXml = `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion>
  <estado>AUTORIZADO</estado>
  <numeroAutorizacion>0110202601179001122300120010010000004561234567812</numeroAutorizacion>
  <fechaAutorizacion>01/10/2026 10:15:30</fechaAutorizacion>
  <comprobante><![CDATA[${sampleDirectInvoiceXml}]]></comprobante>
</autorizacion>`;

    const result = parser.parse(wrappedXml);
    expect(result.authorizationNumber).toBe("0110202601179001122300120010010000004561234567812");
    expect(result.invoiceNumber).toBe("001-001-000000456");
    expect(result.items).toHaveLength(2);
  });

  it("debe rechazar XML inválidos o que no corresponden a facturas SRI", () => {
    expect(() => parser.parse("")).toThrowError("El contenido XML de la factura está vacío.");
    expect(() => parser.parse("<xml><invalido></xml>")).toThrowError();
    expect(() => parser.parse("<otraCosa><id>123</id></otraCosa>")).toThrowError(
      "El XML proporcionado no contiene un comprobante de tipo <factura> válido del SRI."
    );
  });
});
