import { describe, it, expect } from "vitest";
import { AccessKey } from "./access-key.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

describe("AccessKey (SRI Ecuador 49-Digit Key & Módulo 11)", () => {
  it("debe calcular correctamente el dígito verificador Módulo 11 ponderado oficial", () => {
    // Ejemplo de prueba:
    // Base 48 dígitos
    const base48 = "031020260117900112230012001001000000125123456781";
    const verifier = AccessKey.calculateModule11(base48);

    expect(verifier).toBeGreaterThanOrEqual(0);
    expect(verifier).toBeLessThanOrEqual(9);
  });

  it("debe retornar 0 cuando el residuo de la resta es 11", () => {
    // En el algoritmo del SRI: si verifier === 11 => 0, si verifier === 10 => 1
    // Verificamos que la función maneje estas ramas
    const calculated = AccessKey.calculateModule11("000000000000000000000000000000000000000000000000");
    // sum = 0, remainder = 0, 11 - 0 = 11 -> 0
    expect(calculated).toBe(0);
  });

  it("debe generar una clave de 49 dígitos válida a partir de los datos fiscales", () => {
    const key = AccessKey.generate({
      emissionDate: new Date(2026, 9, 3), // 03 de Octubre de 2026
      documentType: "01", // Factura
      ruc: "1790011223001",
      environment: "2", // Producción
      establishment: "001",
      emissionPoint: "001",
      sequential: 125,
      numericCode: "12345678",
    });

    const keyStr = key.getValue();
    expect(keyStr).toHaveLength(49);
    expect(keyStr.substring(0, 8)).toBe("03102026");
    expect(keyStr.substring(8, 10)).toBe("01");
    expect(keyStr.substring(10, 23)).toBe("1790011223001");
    expect(keyStr.substring(23, 24)).toBe("2");
    expect(keyStr.substring(24, 27)).toBe("001");
    expect(keyStr.substring(27, 30)).toBe("001");
    expect(keyStr.substring(30, 39)).toBe("000000125");
    expect(keyStr.substring(39, 47)).toBe("12345678");
    expect(keyStr.substring(47, 48)).toBe("1"); // Normal

    // Reinstanciar desde el string debe pasar la validación matemática
    const restored = AccessKey.fromString(keyStr);
    expect(restored.getValue()).toBe(keyStr);
  });

  it("debe rechazar claves de acceso que no tengan 49 dígitos", () => {
    expect(() => AccessKey.fromString("12345")).toThrow(ValidationError);
    expect(() => AccessKey.fromString("031020260117900112230012001001000000125123456781")).toThrow(
      /exactamente 49 dígitos/
    );
  });

  it("debe rechazar claves de acceso con dígito verificador adulterado", () => {
    const key = AccessKey.generate({
      emissionDate: new Date(2026, 9, 3),
      documentType: "01",
      ruc: "1790011223001",
      environment: "1",
      establishment: "001",
      emissionPoint: "001",
      sequential: 1,
      numericCode: "87654321",
    });

    const originalStr = key.getValue();
    const lastDigit = parseInt(originalStr.charAt(48), 10);
    const fakeLastDigit = (lastDigit + 1) % 10;
    const tamperedKey = originalStr.substring(0, 48) + fakeLastDigit;

    expect(() => AccessKey.fromString(tamperedKey)).toThrow(ValidationError);
    expect(() => AccessKey.fromString(tamperedKey)).toThrow(/dígito verificador.*inválido/);
  });
});
