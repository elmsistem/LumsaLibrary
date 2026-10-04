import { describe, it, expect } from "vitest";
import {
  assertConsumidorFinalAllowed,
  MAX_CONSUMIDOR_FINAL_CENTS,
} from "./consumidor-final.rule";

describe("Consumidor Final Legal Limit Rule ($50 USD)", () => {
  it("debe permitir ventas a Consumidor Final por $50.00 o menos", () => {
    // $0.50, $25.00, $50.00 exactos
    expect(() => assertConsumidorFinalAllowed(50, "CONSUMIDOR_FINAL")).not.toThrow();
    expect(() => assertConsumidorFinalAllowed(2500, "CONSUMIDOR_FINAL")).not.toThrow();
    expect(() => assertConsumidorFinalAllowed(MAX_CONSUMIDOR_FINAL_CENTS, "CONSUMIDOR_FINAL")).not.toThrow();
  });

  it("debe bloquear ventas a Consumidor Final por montos superiores a $50.00", () => {
    // $50.01 centavos
    expect(() => assertConsumidorFinalAllowed(5001, "CONSUMIDOR_FINAL")).toThrow(
      /no pueden ser emitidas a Consumidor Final/
    );

    // $120.00
    expect(() => assertConsumidorFinalAllowed(12000, "CONSUMIDOR_FINAL")).toThrow(
      /no pueden ser emitidas a Consumidor Final/
    );
  });

  it("no debe bloquear ventas superiores a $50.00 si el cliente tiene Cédula o RUC", () => {
    // $500.00 con Cédula o RUC
    expect(() => assertConsumidorFinalAllowed(50000, "CEDULA")).not.toThrow();
    expect(() => assertConsumidorFinalAllowed(50000, "RUC")).not.toThrow();
    expect(() => assertConsumidorFinalAllowed(50000, "PASAPORTE")).not.toThrow();
  });
});
