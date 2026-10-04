import { WhatsAppDispatcherService } from "../../domain/services/whatsapp-dispatcher.service";
import { EmailDispatcherService } from "../../domain/services/email-dispatcher.service";

export interface DispatchInvoiceNotificationInput {
  customerName: string;
  phoneNumber?: string;
  email?: string;
  invoiceNumber: string;
  accessKey: string;
  totalAmountDollars: string;
  ridePdfUrl: string;
  xmlDownloadUrl: string;
  xmlContent?: string;
  pdfRideBuffer?: Buffer;
  sendWhatsapp?: boolean;
  sendEmail?: boolean;
}

export interface DispatchInvoiceNotificationResult {
  invoiceNumber: string;
  whatsappSent: boolean;
  whatsappMessage?: string;
  whatsappNormalizedPhone?: string;
  whatsappError?: string;
  emailSent: boolean;
  emailSubject?: string;
  emailRecipient?: string;
  emailError?: string;
}

/**
 * Caso de Uso: Despacho Multicanal de Facturas Electrónicas (WhatsApp y Correo Electrónico).
 */
export class DispatchInvoiceNotificationUseCase {
  public async execute(
    input: DispatchInvoiceNotificationInput
  ): Promise<DispatchInvoiceNotificationResult> {
    const shouldSendWhatsapp = input.sendWhatsapp ?? true;
    const shouldSendEmail = input.sendEmail ?? true;

    let whatsappSent = false;
    let whatsappMessage: string | undefined;
    let whatsappNormalizedPhone: string | undefined;
    let whatsappError: string | undefined;

    let emailSent = false;
    let emailSubject: string | undefined;
    let emailRecipient: string | undefined;
    let emailError: string | undefined;

    // 1. Despacho por WhatsApp si se proporcionó teléfono
    if (shouldSendWhatsapp && input.phoneNumber) {
      try {
        whatsappNormalizedPhone = WhatsAppDispatcherService.normalizeEcuadorianPhoneNumber(
          input.phoneNumber
        );
        whatsappMessage = WhatsAppDispatcherService.buildInvoiceMessage({
          customerName: input.customerName,
          phoneNumber: input.phoneNumber,
          invoiceNumber: input.invoiceNumber,
          totalAmountDollars: input.totalAmountDollars,
          ridePdfUrl: input.ridePdfUrl,
          xmlDownloadUrl: input.xmlDownloadUrl,
        });
        // En producción se dispara la llamada HTTP a Meta Cloud API o Evolution API
        whatsappSent = true;
      } catch (err: unknown) {
        whatsappError = err instanceof Error ? err.message : String(err);
      }
    }

    // 2. Despacho por Email si se proporcionó correo
    if (shouldSendEmail && input.email) {
      try {
        const formattedEmail = EmailDispatcherService.buildInvoiceEmail({
          toEmail: input.email,
          customerName: input.customerName,
          invoiceNumber: input.invoiceNumber,
          accessKey: input.accessKey,
          totalAmountDollars: input.totalAmountDollars,
          xmlContent: input.xmlContent,
          pdfRideBuffer: input.pdfRideBuffer,
        });
        emailSubject = formattedEmail.subject;
        emailRecipient = formattedEmail.to;
        // En producción se dispara el transporte SMTP o API de Resend
        emailSent = true;
      } catch (err: unknown) {
        emailError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      invoiceNumber: input.invoiceNumber,
      whatsappSent,
      whatsappMessage,
      whatsappNormalizedPhone,
      whatsappError,
      emailSent,
      emailSubject,
      emailRecipient,
      emailError,
    };
  }
}
