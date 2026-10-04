import { ValidationError } from "@/modules/core/public-api";

export interface InvoiceWhatsAppPayload {
  customerName: string;
  phoneNumber: string;
  invoiceNumber: string; // 001-001-000000123
  totalAmountDollars: string;
  ridePdfUrl: string;
  xmlDownloadUrl: string;
}

export interface SchoolListWhatsAppPayload {
  customerName: string;
  phoneNumber: string;
  studentName?: string;
  institutionName: string;
  totalQuoteDollars: string;
  proformaUrl: string;
}

/**
 * Servicio de Generación y Despacho de Mensajes Interactivos de WhatsApp.
 * Normaliza números ecuatorianos y estructura payloads para Meta Cloud API o Evolution API.
 */
export class WhatsAppDispatcherService {
  /**
   * Normaliza un número telefónico ecuatoriano al estándar internacional E.164.
   * Ejemplos:
   * "0991234567" -> "+593991234567"
   * "0981234567" -> "+593981234567"
   * "+593991234567" -> "+593991234567"
   */
  public static normalizeEcuadorianPhoneNumber(rawPhone: string): string {
    const cleaned = rawPhone.replace(/\D/g, "");

    if (cleaned.length === 10 && cleaned.startsWith("09")) {
      // 0991234567 -> 593991234567
      return `+593${cleaned.slice(1)}`;
    }

    if (cleaned.length === 9 && cleaned.startsWith("9")) {
      // 991234567 -> 593991234567
      return `+593${cleaned}`;
    }

    if (cleaned.length === 12 && cleaned.startsWith("5939")) {
      // 593991234567
      return `+${cleaned}`;
    }

    throw new ValidationError(
      `El número celular no tiene un formato ecuatoriano válido (debe iniciar con 09 y tener 10 dígitos). Recibido: ${rawPhone}`,
      "INVALID_ECUADORIAN_PHONE"
    );
  }

  /**
   * Construye el texto interactivo de notificación de factura electrónica autorizada.
   */
  public static buildInvoiceMessage(payload: InvoiceWhatsAppPayload): string {
    const normalizedPhone = this.normalizeEcuadorianPhoneNumber(payload.phoneNumber);

    return [
      `📚 *LUMSA LIBRARY — Factura Electrónica*`,
      ``,
      `Estimado(a) *${payload.customerName.trim()}*,`,
      `Agradecemos su compra. Su factura legal ha sido autorizada por el SRI:`,
      ``,
      `🧾 *Factura Nro:* ${payload.invoiceNumber}`,
      `💰 *Monto Total:* $${payload.totalAmountDollars}`,
      ``,
      `📥 *Descargar RIDE (PDF):* ${payload.ridePdfUrl}`,
      `📄 *Descargar XML SRI:* ${payload.xmlDownloadUrl}`,
      ``,
      `_WhatsApp destinatario: ${normalizedPhone}_`,
    ].join("\n");
  }

  /**
   * Construye el texto para proformas de listas de útiles escolares.
   */
  public static buildSchoolListProformaMessage(payload: SchoolListWhatsAppPayload): string {
    const normalizedPhone = this.normalizeEcuadorianPhoneNumber(payload.phoneNumber);
    const studentInfo = payload.studentName ? ` para el/la alumno(a) *${payload.studentName}*` : "";

    return [
      `🎒 *LUMSA LIBRARY — Cotización de Lista de Útiles*`,
      ``,
      `Hola *${payload.customerName.trim()}*,`,
      `Hemos cotizado la lista escolar${studentInfo} de la institución *${payload.institutionName}*:`,
      ``,
      `💵 *Total de la lista:* $${payload.totalQuoteDollars}`,
      ``,
      `📲 *Ver detalle completo y reservar stock:*`,
      `${payload.proformaUrl}`,
      ``,
      `¡Separe sus libros y cuadernos con anticipación para la temporada!`,
      `_Destinatario: ${normalizedPhone}_`,
    ].join("\n");
  }
}
