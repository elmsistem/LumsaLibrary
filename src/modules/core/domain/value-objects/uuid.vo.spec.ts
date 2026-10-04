import { describe, it, expect } from "vitest";
import { generateUUIDv7, isValidUUID, assertUUID } from "./uuid.vo";

describe("UUIDv7 Generator & Validator", () => {
  it("debe generar un UUID versión 7 sintácticamente válido", () => {
    const id = generateUUIDv7();
    expect(isValidUUID(id)).toBe(true);

    // El 13vo caracter (versión) debe ser '7'
    expect(id.charAt(14)).toBe("7");
  });

  it("debe generar UUIDs secuenciales cronológicamente ordenables", () => {
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      ids.push(generateUUIDv7());
    }

    // Verificar que cada UUID generado sea lexicográficamente mayor o igual que el anterior
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]! >= ids[i - 1]!).toBe(true);
    }
  });

  it("debe validar UUIDs correctos y rechazar cadenas malformadas", () => {
    expect(isValidUUID("01923f7a-8b12-7000-8000-000000000001")).toBe(true);
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("01923f7a-8b12-7000-8000")).toBe(false);
  });

  it("assertUUID debe lanzar ValidationError ante cadenas no válidas", () => {
    expect(() => assertUUID("invalid")).toThrow();
    expect(() => assertUUID(generateUUIDv7())).not.toThrow();
  });
});
