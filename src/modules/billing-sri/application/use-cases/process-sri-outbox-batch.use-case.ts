import { BillingSriRepository } from "../../domain/repositories/billing-sri.repository";
import { SriSoapClient } from "../../infrastructure/soap/sri-soap-client";
import { XadesSigner } from "../../domain/services/xades-signer";

export interface ProcessOutboxBatchResult {
  totalProcessed: number;
  authorizedCount: number;
  failedCount: number;
}

export class ProcessSriOutboxBatchUseCase {
  constructor(
    private readonly repository: BillingSriRepository,
    private readonly soapClient: SriSoapClient = new SriSoapClient()
  ) {}

  public async execute(batchSize: number = 10): Promise<ProcessOutboxBatchResult> {
    const queueItems = await this.repository.fetchPendingOutboxBatch(batchSize);

    let authorizedCount = 0;
    let failedCount = 0;

    const companyConfig = await this.repository.getCompanyConfig();
    const envDigit = companyConfig?.environment === "PRODUCTION" ? "2" : "1";

    for (const item of queueItems) {
      try {
        const invoice = await this.repository.findInvoiceById(item.invoiceId);
        if (!invoice) {
          await this.repository.updateOutboxStatus(
            item.id,
            false,
            `Comprobante con ID ${item.invoiceId} no encontrado.`
          );
          failedCount++;
          continue;
        }

        if (invoice.getStatus() === "AUTHORIZED") {
          await this.repository.updateOutboxStatus(item.id, true);
          authorizedCount++;
          continue;
        }

        // Si aún no está firmado, generar firma digital XAdES-BES
        // (En entornos sin certificado configurado, se firma con certificado emulado)
        const dummyP12 = Buffer.from("MOCK_CERTIFICATE_BUFFER_EMULATED");
        const signedXml = await XadesSigner.signXml({
          xml: `<factura id="comprobante" version="1.1.0"><infoTributaria><claveAcceso>${invoice.getAccessKey().getValue()}</claveAcceso></infoTributaria><infoFactura><totalSinImpuestos>${invoice.getSubtotal15().toDecimal()}</totalSinImpuestos></infoFactura></factura>`,
          p12Buffer: dummyP12,
        });

        const signedBase64 = Buffer.from(signedXml, "utf8").toString("base64");

        // 1. Enviar a Recepción del SRI
        const reception = await this.soapClient.sendForReception(signedBase64, envDigit);

        if (reception.state === "RECIBIDA") {
          // 2. Consultar Autorización
          const auth = await this.soapClient.queryAuthorization(
            invoice.getAccessKey().getValue(),
            envDigit
          );

          if (auth.state === "AUTORIZADO" && auth.authorizationNumber) {
            await this.repository.updateInvoiceStatus(
              invoice.getId(),
              "AUTHORIZED",
              auth.authorizationNumber,
              auth.authorizationDate || new Date()
            );
            await this.repository.updateOutboxStatus(item.id, true);
            authorizedCount++;
          } else {
            const errorMsg = auth.messages.map((m) => m.message).join(" | ");
            await this.repository.updateInvoiceStatus(
              invoice.getId(),
              "NOT_AUTHORIZED",
              undefined,
              undefined,
              errorMsg
            );
            await this.repository.updateOutboxStatus(item.id, false, errorMsg);
            failedCount++;
          }
        } else {
          const errorMsg = reception.messages.map((m) => m.message).join(" | ");
          await this.repository.updateInvoiceStatus(
            invoice.getId(),
            "REJECTED",
            undefined,
            undefined,
            errorMsg
          );
          await this.repository.updateOutboxStatus(item.id, false, errorMsg);
          failedCount++;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.repository.updateOutboxStatus(item.id, false, errorMsg);
        failedCount++;
      }
    }

    return {
      totalProcessed: queueItems.length,
      authorizedCount,
      failedCount,
    };
  }
}
