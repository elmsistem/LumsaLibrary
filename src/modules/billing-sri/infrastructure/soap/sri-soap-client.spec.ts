import { describe, it, expect } from "vitest";
import { SriSoapClient } from "./sri-soap-client";

describe("SriSoapClient (SOAP Response Parser)", () => {
  const client = new SriSoapClient();

  it("debe parsear correctamente una respuesta de Recepción RECIBIDA", () => {
    const xml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion">
      <RespuestaRecepcionComprobante>
        <estado>RECIBIDA</estado>
        <comprobantes/>
      </RespuestaRecepcionComprobante>
    </ns2:validarComprobanteResponse>
  </soap:Body>
</soap:Envelope>`;

    const result = client.parseReceptionResponse(xml);
    expect(result.state).toBe("RECIBIDA");
    expect(result.messages.length).toBe(0);
  });

  it("debe parsear errores en una respuesta de Recepción DEVUELTA", () => {
    const xml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion">
      <RespuestaRecepcionComprobante>
        <estado>DEVUELTA</estado>
        <comprobantes>
          <comprobante>
            <claveAcceso>0310202601179001122300110010010000000011234567818</claveAcceso>
            <mensajes>
              <mensaje>
                <identificador>43</identificador>
                <mensaje>CLAVE ACCESO REGISTRADA</mensaje>
                <informacionAdicional>El comprobante ya fue transmitido anteriormente</informacionAdicional>
                <tipo>ERROR</tipo>
              </mensaje>
            </mensajes>
          </comprobante>
        </comprobantes>
      </RespuestaRecepcionComprobante>
    </ns2:validarComprobanteResponse>
  </soap:Body>
</soap:Envelope>`;

    const result = client.parseReceptionResponse(xml);
    expect(result.state).toBe("DEVUELTA");
    expect(result.messages.length).toBe(1);
    expect(result.messages[0]!.identifier).toBe("43");
    expect(result.messages[0]!.message).toBe("CLAVE ACCESO REGISTRADA");
  });

  it("debe parsear correctamente una respuesta de Autorización AUTORIZADO", () => {
    const xml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion">
      <RespuestaAutorizacion>
        <claveAccesoConsultada>0310202601179001122300110010010000000011234567818</claveAccesoConsultada>
        <numeroComprobantes>1</numeroComprobantes>
        <autorizaciones>
          <autorizacion>
            <estado>AUTORIZADO</estado>
            <numeroAutorizacion>0310202601179001122300110010010000000011234567818</numeroAutorizacion>
            <fechaAutorizacion>2026-10-03T15:30:00-05:00</fechaAutorizacion>
            <ambiente>PRUEBAS</ambiente>
            <mensajes/>
          </autorizacion>
        </autorizaciones>
      </RespuestaAutorizacion>
    </ns2:autorizacionComprobanteResponse>
  </soap:Body>
</soap:Envelope>`;

    const result = client.parseAuthorizationResponse(xml);
    expect(result.state).toBe("AUTORIZADO");
    expect(result.authorizationNumber).toBe("0310202601179001122300110010010000000011234567818");
    expect(result.authorizationDate).toBeDefined();
  });
});
