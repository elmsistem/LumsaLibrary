import { describe, it, expect } from "vitest";
import { Money } from "./money.vo";

describe("Money Value Object", () => {
  it("debe crear instancias desde centavos enteros y devolver valores exactos", () => {
    const money = Money.fromCents(250);
    expect(money.toCents()).toBe(250);
    expect(money.toDecimal()).toBe(2.5);
  });

  it("debe evitar errores de punto flotante de JavaScript (0.1 + 0.2 === 0.30)", () => {
    const m1 = Money.fromDecimal(0.1);
    const m2 = Money.fromDecimal(0.2);
    const sum = m1.add(m2);

    expect(sum.toDecimal()).toBe(0.3);
    expect(sum.toCents()).toBe(30);
  });

  it("debe sumar y restar correctamente", () => {
    const a = Money.fromDecimal(10.5);
    const b = Money.fromDecimal(4.25);

    expect(a.add(b).toDecimal()).toBe(14.75);
    expect(a.subtract(b).toDecimal()).toBe(6.25);
  });

  it("debe multiplicar por cantidades y redondear al centavo", () => {
    const price = Money.fromDecimal(2.55);
    // 3 unidades a 2.55 = 7.65
    expect(price.multiply(3).toDecimal()).toBe(7.65);
  });

  it("debe calcular porcentajes de impuestos con exactitud (IVA 15%)", () => {
    // Base imponible: $10.00
    const base = Money.fromDecimal(10.0);
    const iva15 = base.percentage(15);
    expect(iva15.toDecimal()).toBe(1.5);

    // Base imponible: $25.50 * 15% = 3.825 -> redondeo legal a 3.83
    const base2 = Money.fromDecimal(25.5);
    const iva2 = base2.percentage(15);
    expect(iva2.toDecimal()).toBe(3.83);
  });

  it("debe comparar montos correctamente", () => {
    const a = Money.fromDecimal(50.0);
    const b = Money.fromDecimal(50.01);
    const c = Money.fromDecimal(50.0);

    expect(a.equals(c)).toBe(true);
    expect(a.lessThan(b)).toBe(true);
    expect(b.greaterThan(a)).toBe(true);
    expect(a.lessThanOrEqual(c)).toBe(true);
  });

  it("debe formatear a moneda ecuatoriana/estadounidense", () => {
    const money = Money.fromDecimal(1250.75);
    // En es-EC el separador de miles es '.' y decimales es ','
    expect(money.format()).toContain("1.250");
    expect(money.format()).toContain("75");
    expect(money.format()).toContain("$");
  });

  it("debe rechazar centavos no enteros o no finitos", () => {
    expect(() => Money.fromCents(12.34 as unknown as number)).toThrow();
    expect(() => Money.fromDecimal(NaN)).toThrow();
    expect(() => Money.fromDecimal(Infinity)).toThrow();
  });
});
