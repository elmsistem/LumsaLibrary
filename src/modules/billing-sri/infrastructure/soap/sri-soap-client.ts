export interface SriReceptionResponse {
  state: "RECIBIDA" | "DEVUELTA";
  messages: Array<{
    identifier: string;
    message: string;
    additionalInfo?: string;
    type: string;
  }>;
}

export interface SriAuthorizationResponse {
  state: "AUTORIZADO" | "NO AUTORIZADO" | "EN PROCESO";
  authorizationNumber?: string;
  authorizationDate?: Date;
  xmlAuthorized?: string;
  messages: Array<{
    identifier: string;
    message: string;
    additionalInfo?: string;
    type: string;
  }>;
}

export class SriSoapClient {
  private static readonly URLS = {
    test: {
      reception: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
      authorization: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
    },
    production: {
      reception: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
      authorization: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
    },
  };

  /**
   * Envía un XML firmado en Base64 al servicio de Recepción del SRI por SOAP.
   */
  public async sendForReception(
    signedXmlBase64: string,
    environment: "1" | "2" = "1"
  ): Promise<SriReceptionResponse> {
    const url = environment === "2" ? SriSoapClient.URLS.production.reception : SriSoapClient.URLS.test.reception;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${signedXmlBase64}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml;charset=utf-8",
          SOAPAction: "",
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Error de comunicación con SRI Recepción: HTTP ${response.status}`);
      }

      const responseXml = await response.text();
      return this.parseReceptionResponse(responseXml);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        state: "DEVUELTA",
        messages: [
          {
            identifier: "CONN_ERR",
            message: `Fallo de conexión SOAP con SRI: ${message}`,
            type: "ERROR",
          },
        ],
      };
    }
  }

  /**
   * Consulta el estado de autorización de un comprobante ante el SRI por SOAP.
   */
  public async queryAuthorization(
    accessKey: string,
    environment: "1" | "2" = "1"
  ): Promise<SriAuthorizationResponse> {
    const url =
      environment === "2"
        ? SriSoapClient.URLS.production.authorization
        : SriSoapClient.URLS.test.authorization;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAcceso>${accessKey}</claveAcceso>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml;charset=utf-8",
          SOAPAction: "",
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Error de comunicación con SRI Autorización: HTTP ${response.status}`);
      }

      const responseXml = await response.text();
      return this.parseAuthorizationResponse(responseXml);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        state: "EN PROCESO",
        messages: [
          {
            identifier: "CONN_ERR",
            message: `Fallo de consulta SOAP con SRI: ${message}`,
            type: "ERROR",
          },
        ],
      };
    }
  }

  // --- Analizadores XML de Respuesta SOAP ---

  public parseReceptionResponse(xml: string): SriReceptionResponse {
    const isReceived = xml.includes("<estado>RECIBIDA</estado>");
    const messages = this.extractSriMessages(xml);

    return {
      state: isReceived ? "RECIBIDA" : "DEVUELTA",
      messages,
    };
  }

  public parseAuthorizationResponse(xml: string): SriAuthorizationResponse {
    const isAuthorized = xml.includes("<estado>AUTORIZADO</estado>");
    const isNotAuthorized = xml.includes("<estado>NO AUTORIZADO</estado>");

    let authNum: string | undefined;
    let authDate: Date | undefined;

    const numMatch = xml.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/);
    if (numMatch && numMatch[1]) {
      authNum = numMatch[1];
    }

    const dateMatch = xml.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/);
    if (dateMatch && dateMatch[1]) {
      authDate = new Date(dateMatch[1]);
    }

    const messages = this.extractSriMessages(xml);

    return {
      state: isAuthorized ? "AUTORIZADO" : isNotAuthorized ? "NO AUTORIZADO" : "EN PROCESO",
      authorizationNumber: authNum,
      authorizationDate: authDate,
      messages,
    };
  }

  private extractSriMessages(xml: string): Array<{
    identifier: string;
    message: string;
    additionalInfo?: string;
    type: string;
  }> {
    const messages: Array<{
      identifier: string;
      message: string;
      additionalInfo?: string;
      type: string;
    }> = [];

    const mensajesBlockMatch = xml.match(/<mensajes>([\s\S]*?)<\/mensajes>/);
    if (!mensajesBlockMatch || !mensajesBlockMatch[1]) {
      return messages;
    }

    const content = mensajesBlockMatch[1];
    const itemRegex =
      /<identificador>([\s\S]*?)<\/identificador>[\s\S]*?<mensaje>([\s\S]*?)<\/mensaje>(?:[\s\S]*?<informacionAdicional>([\s\S]*?)<\/informacionAdicional>)?[\s\S]*?<tipo>([\s\S]*?)<\/tipo>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(content)) !== null) {
      messages.push({
        identifier: match[1]?.trim() ?? "",
        message: match[2]?.trim() ?? "",
        additionalInfo: match[3]?.trim() || undefined,
        type: match[4]?.trim() ?? "ERROR",
      });
    }

    return messages;
  }
}
