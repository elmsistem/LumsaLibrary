# 04. Especificación Técnica de Facturación Electrónica SRI (Ecuador)

> **Estado:** Documento Normativo Obligatorio  
> **Referencia Legal:** Ficha Técnica de Comprobantes Electrónicos del SRI (Esquema v1.1.0 Offline)

---

## 1. Algoritmo de la Clave de Acceso (49 Dígitos)

Cada comprobante emitido posee una Clave de Acceso de exactamente **49 dígitos numéricos** generada en tiempo real:

$$\text{Clave de Acceso} = d_1 d_2 \dots d_{48} + \text{DV}$$

### 1.1. Estructura de los 48 Dígitos Base

| Posición | Longitud | Campo | Descripción | Ejemplo |
|---|---|---|---|---|
| 01 - 08 | 8 | Fecha de Emisión | Formato `ddmmaaaa` | `03102026` |
| 09 - 10 | 2 | Tipo de Comprobante | `01`: Factura, `04`: Nota de Crédito, `07`: Retención | `01` |
| 11 - 23 | 13 | RUC del Emisor | RUC de la librería | `1790011223001` |
| 24 - 24 | 1 | Tipo de Ambiente | `1`: Pruebas, `2`: Producción | `2` |
| 25 - 27 | 3 | Establecimiento | Serie del local (3 dígitos con ceros) | `001` |
| 28 - 30 | 3 | Punto de Emisión | Caja registradora (3 dígitos) | `001` |
| 31 - 39 | 9 | Secuencial | Número consecutivo oficial (9 dígitos) | `000000125` |
| 40 - 47 | 8 | Código Numérico | Código de seguridad aleatorio o interno | `12345678` |
| 48 - 48 | 1 | Tipo de Emisión | `1`: Emisión Normal | `1` |

### 1.2. Algoritmo de Cálculo del Dígito Verificador (Módulo 11 Ponderado)

El dígito 49 se calcula aplicando el algoritmo Módulo 11 con ponderadores cíclicos de **2 a 7 de derecha a izquierda**:

```typescript
function calculateModule11(base48: string): number {
  const weights = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  let weightIndex = 0;

  for (let i = base48.length - 1; i >= 0; i--) {
    const digit = parseInt(base48[i], 10);
    sum += digit * weights[weightIndex];
    weightIndex = (weightIndex + 1) % weights.length;
  }

  const remainder = sum % 11;
  const verifier = 11 - remainder;

  if (verifier === 11) return 0;
  if (verifier === 10) return 1;
  return verifier;
}
```

---

## 2. Estructura del XML de Factura (`factura_V1.1.0`)

El documento XML debe cumplir rigurosamente el esquema XSD oficial del SRI:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>LUMSA LIBRARY CIA. LTDA.</razonSocial>
    <nombreComercial>LUMSA LIBRARY</nombreComercial>
    <ruc>1790011223001</ruc>
    <claveAcceso>0310202601179001122300120010010000001251234567818</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000000125</secuencial>
    <dirMatriz>Av. Principal 123 y Secundaria</dirMatriz>
    <!-- Leyendas dinámicas según régimen del emisor -->
    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>03/10/2026</fechaEmision>
    <dirEstablecimiento>Av. Principal 123</dirEstablecimiento>
    <obligadoContabilidad>NO</obligadoContabilidad>
    <tipoIdentificacionComprador>05</tipoIdentificacionComprador>
    <razonSocialComprador>JUAN PEREZ</razonSocialComprador>
    <identificacionComprador>1712345678</identificacionComprador>
    <totalSinImpuestos>25.50</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo> <!-- 2 = IVA -->
        <codigoPorcentaje>4</codigoPorcentaje> <!-- Código tarifa vigente SRI -->
        <baseImponible>25.50</baseImponible>
        <valor>3.83</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>29.33</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>01</formaPago> <!-- 01 = Efectivo -->
        <total>29.33</total>
      </pago>
    </pagos>
  </infoFactura>

  <detalles>
    <detalle>
      <codigoPrincipal>PAP-0012</codigoPrincipal>
      <descripcion>CUADERNO UNIVERSITARIO 100H</descripcion>
      <cantidad>5.00</cantidad>
      <precioUnitario>2.50</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>12.50</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>15.00</tarifa>
          <baseImponible>12.50</baseImponible>
          <valor>1.88</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>
  
  <infoAdicional>
    <campoAdicional nombre="Email">cliente@correo.com</campoAdicional>
    <campoAdicional nombre="Telefono">0991234567</campoAdicional>
  </infoAdicional>
</factura>
```

---

## 3. Firma Electrónica XAdES-BES (Certificado `.p12`)

* **Estándar:** W3C XML Digital Signature + ETSI XAdES-BES v1.3.2.
* **Certificado:** Archivo PKCS#12 (`.p12` o `.pfx`) emitido por una Autoridad de Certificación acreditada en Ecuador (Banco Central del Ecuador, Security Data, ANF, UANATACA, Consejo de la Judicatura).
* **Seguridad de la Clave Privada:** La contraseña del certificado se almacena encriptada en base de datos mediante AES-256 o variable de entorno segura; **nunca en texto plano**.

---

## 4. Conectividad con los Web Services del SRI

El SRI utiliza protocolo SOAP con dos servicios principales en modalidad *Offline*:

### 4.1. Endpoints Oficiales

| Servicio | Ambiente de Pruebas (1) | Ambiente de Producción (2) |
|---|---|---|
| **Recepción** | `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl` | `https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl` |
| **Autorización** | `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl` | `https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl` |

### 4.2. Flujo de Estados del Comprobante

1. `ENVIADO`: El XML firmado fue transmitido por SOAP.
2. `RECIBIDA`: El SRI valida la sintaxis básica y lo encola para procesamiento.
3. `AUTORIZADO`: El comprobante cuenta con validez legal. El SRI adjunta el nodo `<numeroAutorizacion>` y `<fechaAutorizacion>`.
4. `DEVUELTA` / `NO AUTORIZADO`: Ocurrió un error (ej. RUC no existe, fecha inválida, error de firma). El sistema captura el código de error y mensaje para notificación y corrección inmediata.

---

## 5. Especificaciones del RIDE (Representación Impresa en PDF)

El RIDE generado por el ERP debe contener:
* Logotipo de la librería.
* Datos del emisor (Razón social, RUC, Dirección matriz y sucursal, Obligado a llevar contabilidad).
* Leyenda fiscal obligatoria (ej. *"CONTRIBUYENTE RÉGIMEN RIMPE - EMPRENDEDOR"*).
* Clave de acceso con código de barras en formato **Code 128** legible por escáner.
* Número y fecha/hora de autorización emitidos por el SRI.
* Tabla detallada de productos/servicios con precios, descuentos y tarifas de IVA.
* Resumen de subtotales: Subtotal 15%, Subtotal 0%, Subtotal No Objeto, Subtotal Exento, Subtotal Sin Impuestos, Descuentos, IVA 15%, Valor Total.
* Tabla de formas de pago oficiales y plazos.
* Información adicional (Correo, Teléfono, Vendedor).
