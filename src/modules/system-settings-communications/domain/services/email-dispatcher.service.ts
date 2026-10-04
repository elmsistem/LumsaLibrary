import { ValidationError } from "@/modules/core/public-api";

export interface InvoiceEmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
}

export interface InvoiceEmailPayload {
  toEmail: string;
  customerName: string;
  invoiceNumber: string; // 001-001-000000123
  accessKey: string;
  totalAmountDollars: string;
  pdfRideBuffer?: Buffer;
  xmlContent?: string;
}

export interface FormattedEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments: InvoiceEmailAttachment[];
}

/**
 * Servicio de Generación y Despacho de Correos Electrónicos Transaccionales (SMTP / Resend).
 */
export class EmailDispatcherService {
  public static buildInvoiceEmail(payload: InvoiceEmailPayload): FormattedEmailMessage {
    if (!payload.toEmail || !payload.toEmail.includes("@")) {
      throw new ValidationError(
        `Dirección de correo electrónico inválida: ${payload.toEmail}`,
        "INVALID_EMAIL_ADDRESS"
      );
    }

    const subject = `Factura Electrónica ${payload.invoiceNumber} - LUMSA LIBRARY CIA. LTDA.`;

    const text = [
      `Estimado(a) ${payload.customerName},`,
      ``,
      `Adjuntamos su comprobante electrónico autorizado por el Servicio de Rentas Internas (SRI):`,
      ``,
      `Comprobante: Factura`,
      `Número: ${payload.invoiceNumber}`,
      `Clave de Acceso / Autorización: ${payload.accessKey}`,
      `Total a Pagar: $${payload.totalAmountDollars} USD`,
      ``,
      `Gracias por su preferencia.`,
      `LUMSA LIBRARY CIA. LTDA.`,
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
        <h2 style="color: #1e3a8a; margin-top: 0;">LUMSA LIBRARY CIA. LTDA.</h2>
        <p>Estimado(a) <strong>${payload.customerName}</strong>,</p>
        <p>Le informamos que su comprobante electrónico ha sido generado y autorizado exitosamente por el <strong>SRI</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f8fafc;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Tipo de Comprobante:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Factura</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Número:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${payload.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Total:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 16px; color: #047857;"><strong>$${payload.totalAmountDollars} USD</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px;"><strong>Clave de Acceso:</strong></td>
            <td style="padding: 10px; font-family: monospace; font-size: 12px;">${payload.accessKey}</td>
          </tr>
        </table>

        <p>Encontrará adjunto su documento en formato <strong>XML oficial</strong> y la representación impresa <strong>RIDE (PDF)</strong>.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b; text-align: center;">Este es un mensaje generado automáticamente por el sistema ERP LumsaLibrary. Por favor no responda a este correo.</p>
      </div>
    `;

    const attachments: InvoiceEmailAttachment[] = [];

    if (payload.xmlContent) {
      attachments.push({
        filename: `${payload.invoiceNumber}.xml`,
        content: payload.xmlContent,
        contentType: "application/xml",
      });
    }

    if (payload.pdfRideBuffer) {
      attachments.push({
        filename: `${payload.invoiceNumber}.pdf`,
        content: payload.pdfRideBuffer,
        contentType: "application/pdf",
      });
    }

    return {
      to: payload.toEmail.trim(),
      subject,
      text,
      html,
      attachments,
    };
  }
}
