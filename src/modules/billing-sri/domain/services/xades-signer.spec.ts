import { describe, it, expect } from "vitest";
import { XadesSigner } from "./xades-signer";
import { ValidationError } from "../../../core/domain/errors/domain-error";

describe("XadesSigner (XAdES-BES v1.3.2 for SRI Ecuador)", () => {
  const dummyXml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <claveAcceso>0310202601179001122300110010010000000011234567818</claveAcceso>
  </infoTributaria>
  <infoFactura>
    <totalSinImpuestos>10.00</totalSinImpuestos>
  </infoFactura>
</factura>`;

  const dummyP12 = Buffer.from("MOCK_PKCS12_CERTIFICATE_CONTENT_FOR_TESTING");

  it("debe insertar correctamente los nodos de firma XAdES-BES en el XML", async () => {
    const signedXml = await XadesSigner.signXml({
      xml: dummyXml,
      p12Buffer: dummyP12,
      password: "secretPassword",
      signingTime: new Date(2026, 9, 3, 10, 0, 0),
    });

    expect(signedXml).toContain("<ds:Signature");
    expect(signedXml).toContain("xmlns:etsi=\"http://uri.etsi.org/01903/v1.3.2#\"");
    expect(signedXml).toContain("<ds:SignedInfo");
    expect(signedXml).toContain("<ds:SignatureValue");
    expect(signedXml).toContain("<ds:KeyInfo");
    expect(signedXml).toContain("<etsi:QualifyingProperties");
    expect(signedXml).toContain("<etsi:SignedProperties");
    expect(signedXml).toContain("</factura>");
  });

  it("debe rechazar XML malformado o sin etiqueta raíz válida", async () => {
    await expect(
      XadesSigner.signXml({
        xml: "<invalidDocument></invalidDocument>",
        p12Buffer: dummyP12,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("debe rechazar certificados vacíos", async () => {
    await expect(
      XadesSigner.signXml({
        xml: dummyXml,
        p12Buffer: Buffer.alloc(0),
      })
    ).rejects.toThrow(ValidationError);
  });
});
