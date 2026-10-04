import { describe, it, expect } from "vitest";
import { EcuadorianIdentification } from "./ecuadorian-identification.vo";

describe("EcuadorianIdentification Value Object", () => {
  describe("Validación de Cédulas", () => {
    it("debe aceptar cédulas ecuatorianas válidas (Módulo 10)", () => {
      // Cédula válida Pichincha
      const ced1 = EcuadorianIdentification.create("CEDULA", "1710034065");
      expect(ced1.getValue()).toBe("1710034065");
      expect(ced1.getType()).toBe("CEDULA");

      // Cédula válida Guayas
      const ced2 = EcuadorianIdentification.create("CEDULA", "0926687856");
      expect(ced2.getValue()).toBe("0926687856");
    });

    it("debe rechazar cédulas con dígito verificador incorrecto", () => {
      // 1710034065 alterando el último dígito a 6
      expect(() => EcuadorianIdentification.create("CEDULA", "1710034066")).toThrow(
        /Dígito verificador de cédula no coincide/
      );
    });

    it("debe rechazar cédulas con código de provincia inválido", () => {
      // Provincia 99 no existe en Ecuador
      expect(() => EcuadorianIdentification.create("CEDULA", "9910034065")).toThrow(
        /Código de provincia inválido/
      );
    });

    it("debe rechazar cédulas con tercer dígito >= 6", () => {
      // Tercer dígito 7 no corresponde a persona natural
      expect(() => EcuadorianIdentification.create("CEDULA", "1770034065")).toThrow(
        /El tercer dígito de una cédula debe ser menor a 6/
      );
    });

    it("debe rechazar cédulas con longitud distinta a 10 dígitos", () => {
      expect(() => EcuadorianIdentification.create("CEDULA", "171003406")).toThrow();
      expect(() => EcuadorianIdentification.create("CEDULA", "17100340651")).toThrow();
    });
  });

  describe("Validación de RUC de Persona Natural", () => {
    it("debe aceptar RUCs válidos de personas naturales terminados en 001", () => {
      const ruc = EcuadorianIdentification.create("RUC", "1710034065001");
      expect(ruc.getValue()).toBe("1710034065001");
      expect(ruc.getRucSubtype()).toBe("PERSONA_NATURAL");
    });

    it("debe rechazar RUCs de persona natural terminados en 000", () => {
      expect(() => EcuadorianIdentification.create("RUC", "1710034065000")).toThrow(
        /no puede tener establecimiento 000/
      );
    });

    it("debe rechazar RUCs cuya cédula base sea inválida", () => {
      expect(() => EcuadorianIdentification.create("RUC", "1710034066001")).toThrow();
    });
  });

  describe("Validación de RUC de Sociedad Privada (Módulo 11)", () => {
    it("debe aceptar RUC de sociedad privada válido con tercer dígito 9", () => {
      // 1790016927001 calculado por Módulo 11
      const ruc = EcuadorianIdentification.create("RUC", "1790016927001");
      expect(ruc.getValue()).toBe("1790016927001");
      expect(ruc.getRucSubtype()).toBe("SOCIEDAD_PRIVADA");
    });

    it("debe rechazar RUC de sociedad privada con dígito verificador incorrecto", () => {
      expect(() => EcuadorianIdentification.create("RUC", "1790016928001")).toThrow(
        /Dígito verificador de RUC de sociedad privada no coincide/
      );
    });
  });

  describe("Validación de RUC de Institución Pública (Módulo 11)", () => {
    it("debe aceptar RUC de entidad pública válido con tercer dígito 6", () => {
      // 1760001550001 calculado por Módulo 11
      const ruc = EcuadorianIdentification.create("RUC", "1760001550001");
      expect(ruc.getValue()).toBe("1760001550001");
      expect(ruc.getRucSubtype()).toBe("INSTITUCION_PUBLICA");
    });

    it("debe rechazar RUC de entidad pública con dígito verificador incorrecto", () => {
      expect(() => EcuadorianIdentification.create("RUC", "1760001560001")).toThrow(
        /Dígito verificador de RUC de entidad pública no coincide/
      );
    });
  });

  describe("Validación de Consumidor Final", () => {
    it("debe aceptar exactamente 9999999999999 como Consumidor Final", () => {
      const cf = EcuadorianIdentification.create("CONSUMIDOR_FINAL", "9999999999999");
      expect(cf.isConsumidorFinal()).toBe(true);
      expect(cf.getValue()).toBe("9999999999999");
    });

    it("debe rechazar números distintos para Consumidor Final", () => {
      expect(() => EcuadorianIdentification.create("CONSUMIDOR_FINAL", "9999999999998")).toThrow(
        /Consumidor Final debe ser exactamente 9999999999999/
      );
    });
  });

  describe("Validación de Pasaporte / Extranjero", () => {
    it("debe aceptar pasaportes alfanuméricos válidos", () => {
      const pass = EcuadorianIdentification.create("PASAPORTE", "A12345678");
      expect(pass.getValue()).toBe("A12345678");
    });

    it("debe rechazar pasaportes con caracteres especiales inválidos", () => {
      expect(() => EcuadorianIdentification.create("PASAPORTE", "A123$456")).toThrow();
    });
  });
});
