import { describe, it, expect } from "vitest";
import { PmpCalculator } from "./pmp-calculator";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

describe("PmpCalculator (Ecuadorian Weighted Average Cost)", () => {
  describe("calculateOnEntry", () => {
    it("debe adoptar el costo de compra como nuevo PMP si el stock inicial es 0", () => {
      const result = PmpCalculator.calculateOnEntry({
        currentStockUnits: 0,
        currentPmp: Money.zero(),
        incomingUnits: 50,
        incomingUnitCost: Money.fromDollars(2.5), // 250 centavos
      });

      expect(result.newStockUnits).toBe(50);
      expect(result.newPmp.getCents()).toBe(250);
      expect(result.totalValueCents).toBe(12500); // 50 * 250
    });

    it("debe promediar adecuadamente compras sucesivas a costos distintos", () => {
      // Caso:
      // Stock anterior: 100 cuadernos a $1.00 (100 centavos) = $100.00 (10,000 centavos)
      // Compra nueva: 100 cuadernos a $2.00 (200 centavos) = $200.00 (20,000 centavos)
      // Total unidades: 200
      // Total valor: $300.00 (30,000 centavos)
      // Nuevo PMP: $1.50 (150 centavos)
      const result = PmpCalculator.calculateOnEntry({
        currentStockUnits: 100,
        currentPmp: Money.fromDollars(1.0),
        incomingUnits: 100,
        incomingUnitCost: Money.fromDollars(2.0),
      });

      expect(result.newStockUnits).toBe(200);
      expect(result.newPmp.getCents()).toBe(150);
      expect(result.newPmp.getDollars()).toBe(1.5);
      expect(result.totalValueCents).toBe(30000);
    });

    it("debe redondear al centavo entero más cercano ante fracciones indivisibles", () => {
      // Stock anterior: 10 bolígrafos a $0.35 (35 cts) = 350 cts
      // Compra nueva: 20 bolígrafos a $0.38 (38 cts) = 760 cts
      // Total unidades: 30
      // Total centavos: 1110 cts
      // PMP: 1110 / 30 = 37 centavos
      const result = PmpCalculator.calculateOnEntry({
        currentStockUnits: 10,
        currentPmp: Money.fromCents(35),
        incomingUnits: 20,
        incomingUnitCost: Money.fromCents(38),
      });

      expect(result.newStockUnits).toBe(30);
      expect(result.newPmp.getCents()).toBe(37);
      expect(result.totalValueCents).toBe(1110);
    });

    it("debe soportar cantidades decimales (útiles fraccionados o metros de cinta/papel)", () => {
      // Stock anterior: 5.5 metros a $1.20 (120 cts) = 660 cts
      // Compra nueva: 4.5 metros a $1.40 (140 cts) = 630 cts
      // Total unidades: 10 metros
      // Total centavos: 1290 cts
      // PMP: 1290 / 10 = 129 centavos ($1.29)
      const result = PmpCalculator.calculateOnEntry({
        currentStockUnits: 5.5,
        currentPmp: Money.fromCents(120),
        incomingUnits: 4.5,
        incomingUnitCost: Money.fromCents(140),
      });

      expect(result.newStockUnits).toBe(10);
      expect(result.newPmp.getCents()).toBe(129);
      expect(result.totalValueCents).toBe(1290);
    });

    it("debe rechazar entradas con unidades menores o iguales a cero", () => {
      expect(() =>
        PmpCalculator.calculateOnEntry({
          currentStockUnits: 10,
          currentPmp: Money.fromDollars(1),
          incomingUnits: 0,
          incomingUnitCost: Money.fromDollars(1),
        })
      ).toThrow(ValidationError);

      expect(() =>
        PmpCalculator.calculateOnEntry({
          currentStockUnits: 10,
          currentPmp: Money.fromDollars(1),
          incomingUnits: -5,
          incomingUnitCost: Money.fromDollars(1),
        })
      ).toThrow(ValidationError);
    });

    it("debe rechazar cálculo si el stock actual es negativo", () => {
      expect(() =>
        PmpCalculator.calculateOnEntry({
          currentStockUnits: -1,
          currentPmp: Money.fromDollars(1),
          incomingUnits: 10,
          incomingUnitCost: Money.fromDollars(1),
        })
      ).toThrow("El stock actual no puede ser negativo.");
    });
  });

  describe("calculateOnExit", () => {
    it("debe reducir el stock y mantener constante el PMP vigente", () => {
      const currentPmp = Money.fromDollars(1.75);
      const result = PmpCalculator.calculateOnExit(50, currentPmp, 20);

      expect(result.newStockUnits).toBe(30);
      expect(result.pmp.getCents()).toBe(175);
      expect(result.exitCost.getCents()).toBe(175);
    });

    it("debe permitir reducir el stock a exactamente cero sin alterar el PMP", () => {
      const currentPmp = Money.fromDollars(2.0);
      const result = PmpCalculator.calculateOnExit(15, currentPmp, 15);

      expect(result.newStockUnits).toBe(0);
      expect(result.pmp.getCents()).toBe(200);
    });

    it("debe lanzar ValidationError si las unidades salientes superan el stock disponible", () => {
      const currentPmp = Money.fromDollars(1.0);
      expect(() => PmpCalculator.calculateOnExit(10, currentPmp, 10.5)).toThrow(
        ValidationError
      );
      expect(() => PmpCalculator.calculateOnExit(10, currentPmp, 10.5)).toThrow(
        /Stock insuficiente/
      );
    });

    it("debe rechazar unidades salientes menores o iguales a cero", () => {
      const currentPmp = Money.fromDollars(1.0);
      expect(() => PmpCalculator.calculateOnExit(10, currentPmp, 0)).toThrow(
        ValidationError
      );
      expect(() => PmpCalculator.calculateOnExit(10, currentPmp, -2)).toThrow(
        ValidationError
      );
    });
  });
});
