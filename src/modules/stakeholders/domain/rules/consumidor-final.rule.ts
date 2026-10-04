import { ValidationError } from "@/modules/core/public-api";
import { IdentificationType } from "../value-objects/ecuadorian-identification.vo";

/**
 * Límite legal máximo permitido en Ecuador por el SRI para emitir comprobantes a Consumidor Final:
 * Exactamente $50.00 USD ($5000 centavos).
 */
export const MAX_CONSUMIDOR_FINAL_CENTS = 5000;

/**
 * Valida la regla fiscal del SRI para Consumidor Final.
 * Si el monto total supera los $50.00 USD, exige obligatoriamente los datos reales del cliente.
 */
export function assertConsumidorFinalAllowed(totalAmountCents: number, idType: IdentificationType): void {
  if (idType === "CONSUMIDOR_FINAL" && totalAmountCents > MAX_CONSUMIDOR_FINAL_CENTS) {
    const formattedAmount = (totalAmountCents / 100).toFixed(2);
    throw new ValidationError(
      `Según la normativa del SRI, las ventas superiores a $50.00 USD no pueden ser emitidas a Consumidor Final (Monto: $${formattedAmount}). Debe ingresar la Cédula o RUC del cliente.`,
      "CONSUMIDOR_FINAL_LIMIT_EXCEEDED"
    );
  }
}
