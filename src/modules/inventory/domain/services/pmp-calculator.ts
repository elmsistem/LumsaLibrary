import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface PmpCalculationInput {
  currentStockUnits: number;
  currentPmp: Money;
  incomingUnits: number;
  incomingUnitCost: Money;
}

export interface PmpCalculationResult {
  newStockUnits: number;
  newPmp: Money;
  totalValueCents: number;
}

/**
 * Calculadora pura de dominio para la valoración de inventario bajo el método
 * oficial de Precio Medio Ponderado (PMP) exigido por el SRI en Ecuador.
 *
 * Invariante: Cero operaciones de punto flotante en dinero; todo cálculo se
 * redondea al centavo entero más cercano.
 */
export class PmpCalculator {
  /**
   * Calcula el nuevo PMP ante una entrada de inventario (compra, ajuste positivo, devolución).
   */
  public static calculateOnEntry(input: PmpCalculationInput): PmpCalculationResult {
    const { currentStockUnits, currentPmp, incomingUnits, incomingUnitCost } = input;

    if (incomingUnits <= 0) {
      throw new ValidationError(
        "La cantidad entrante debe ser mayor que cero para calcular PMP.",
        "INVALID_INCOMING_UNITS"
      );
    }

    if (currentStockUnits < 0) {
      throw new ValidationError(
        "El stock actual no puede ser negativo.",
        "NEGATIVE_STOCK_NOT_ALLOWED"
      );
    }

    // Redondeo de stock a 4 decimales para consistencia con la precisión de base de datos
    const roundedIncomingUnits = Math.round(incomingUnits * 10000) / 10000;
    const roundedCurrentStock = Math.round(currentStockUnits * 10000) / 10000;
    const newStockUnits = Math.round((roundedCurrentStock + roundedIncomingUnits) * 10000) / 10000;

    // Si el stock actual era 0, el nuevo costo promedio ponderado es idéntico al de la compra actual
    if (roundedCurrentStock === 0) {
      const totalValueCents = Math.round(newStockUnits * incomingUnitCost.getCents());
      return {
        newStockUnits,
        newPmp: incomingUnitCost,
        totalValueCents,
      };
    }

    // Valoración total anterior en centavos
    const previousTotalValueCents = roundedCurrentStock * currentPmp.getCents();
    // Valoración de la entrada actual en centavos
    const incomingTotalValueCents = roundedIncomingUnits * incomingUnitCost.getCents();

    const totalValueCents = Math.round(previousTotalValueCents + incomingTotalValueCents);
    const calculatedPmpCents = Math.round(totalValueCents / newStockUnits);

    return {
      newStockUnits,
      newPmp: Money.fromCents(calculatedPmpCents),
      totalValueCents,
    };
  }

  /**
   * Valida y calcula el nuevo saldo de stock ante una salida de inventario (venta, merma, transferencia).
   * Recuerde: Las salidas no alteran el PMP unitario vigente.
   */
  public static calculateOnExit(
    currentStockUnits: number,
    currentPmp: Money,
    outgoingUnits: number
  ): { newStockUnits: number; pmp: Money; exitCost: Money } {
    if (outgoingUnits <= 0) {
      throw new ValidationError(
        "La cantidad saliente debe ser mayor que cero.",
        "INVALID_OUTGOING_UNITS"
      );
    }

    const roundedOutgoingUnits = Math.round(outgoingUnits * 10000) / 10000;
    const roundedCurrentStock = Math.round(currentStockUnits * 10000) / 10000;

    if (roundedCurrentStock < roundedOutgoingUnits) {
      throw new ValidationError(
        `Stock insuficiente. Disponible: ${roundedCurrentStock}, Requerido: ${roundedOutgoingUnits}`,
        "INSUFFICIENT_STOCK"
      );
    }

    const newStockUnits = Math.round((roundedCurrentStock - roundedOutgoingUnits) * 10000) / 10000;

    return {
      newStockUnits,
      pmp: currentPmp,
      exitCost: currentPmp,
    };
  }
}
