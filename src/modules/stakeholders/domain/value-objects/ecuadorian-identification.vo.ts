import { ValidationError } from "@/modules/core/public-api";

export type IdentificationType =
  | "CEDULA"
  | "RUC"
  | "PASAPORTE"
  | "CONSUMIDOR_FINAL"
  | "EXTERIOR";

export type RucSubtype = "PERSONA_NATURAL" | "SOCIEDAD_PRIVADA" | "INSTITUCION_PUBLICA";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  rucSubtype?: RucSubtype;
}

/**
 * Value Object inmutable para Validaciones Oficiales de Identificación Tributaria en Ecuador.
 * Implementa estrictamente los algoritmos del Servicio de Rentas Internas (SRI):
 * - Cédula (Módulo 10)
 * - RUC Persona Natural (Cédula + 001)
 * - RUC Sociedad Privada (Módulo 11 con tercer dígito 9)
 * - RUC Institución Pública (Módulo 11 con tercer dígito 6)
 * - Consumidor Final (9999999999999)
 */
export class EcuadorianIdentification {
  private readonly type: IdentificationType;
  private readonly value: string;
  private readonly rucSubtype?: RucSubtype;

  private constructor(type: IdentificationType, value: string, rucSubtype?: RucSubtype) {
    this.type = type;
    this.value = value;
    this.rucSubtype = rucSubtype;
    Object.freeze(this);
  }

  public static create(type: IdentificationType, rawValue: string): EcuadorianIdentification {
    const sanitized = rawValue ? rawValue.trim() : "";
    const result = EcuadorianIdentification.validate(type, sanitized);

    if (!result.isValid) {
      throw new ValidationError(
        result.error || `Identificación inválida para tipo ${type}: ${sanitized}`,
        "INVALID_IDENTIFICATION"
      );
    }

    return new EcuadorianIdentification(type, sanitized, result.rucSubtype);
  }

  public static validate(type: IdentificationType, value: string): ValidationResult {
    if (!value || typeof value !== "string") {
      return { isValid: false, error: "El número de identificación no puede estar vacío." };
    }

    switch (type) {
      case "CONSUMIDOR_FINAL":
        return EcuadorianIdentification.validateConsumidorFinal(value);
      case "CEDULA":
        return EcuadorianIdentification.validateCedula(value);
      case "RUC":
        return EcuadorianIdentification.validateRuc(value);
      case "PASAPORTE":
      case "EXTERIOR":
        return EcuadorianIdentification.validatePassport(value);
      default:
        return { isValid: false, error: `Tipo de identificación desconocido: ${type}` };
    }
  }

  /**
   * Valida la Cédula Ecuatoriana (10 dígitos, Módulo 10).
   */
  public static validateCedula(cedula: string): ValidationResult {
    if (!/^\d{10}$/.test(cedula)) {
      return { isValid: false, error: "La cédula debe contener exactamente 10 dígitos numéricos." };
    }

    const province = parseInt(cedula.substring(0, 2), 10);
    // Provincias del 01 al 24 o código 30 para ecuatorianos en el exterior
    if (!((province >= 1 && province <= 24) || province === 30)) {
      return { isValid: false, error: `Código de provincia inválido: ${province}. Debe estar entre 01-24 o ser 30.` };
    }

    const thirdDigit = parseInt(cedula.charAt(2), 10);
    if (thirdDigit >= 6) {
      return { isValid: false, error: "El tercer dígito de una cédula debe ser menor a 6." };
    }

    const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      let product = parseInt(cedula.charAt(i), 10) * coefficients[i]!;
      if (product >= 10) {
        product -= 9;
      }
      sum += product;
    }

    const nextTen = Math.ceil(sum / 10) * 10;
    const expectedVerifier = (nextTen - sum) % 10;
    const actualVerifier = parseInt(cedula.charAt(9), 10);

    if (expectedVerifier !== actualVerifier) {
      return { isValid: false, error: "Dígito verificador de cédula no coincide (Módulo 10)." };
    }

    return { isValid: true };
  }

  /**
   * Valida un RUC ecuatoriano de 13 dígitos según su régimen (Natural, Privada o Pública).
   */
  public static validateRuc(ruc: string): ValidationResult {
    if (!/^\d{13}$/.test(ruc)) {
      return { isValid: false, error: "El RUC debe contener exactamente 13 dígitos numéricos." };
    }

    const province = parseInt(ruc.substring(0, 2), 10);
    if (!((province >= 1 && province <= 24) || province === 30)) {
      return { isValid: false, error: `Código de provincia inválido en RUC: ${province}.` };
    }

    const thirdDigit = parseInt(ruc.charAt(2), 10);

    // Caso 1: RUC de Institución Pública (tercer dígito = 6)
    if (thirdDigit === 6) {
      return EcuadorianIdentification.validateRucPublicEntity(ruc);
    }

    // Caso 2: RUC de Sociedad Privada / Extranjera sin cédula (tercer dígito = 9)
    if (thirdDigit === 9) {
      return EcuadorianIdentification.validateRucPrivateSociety(ruc);
    }

    // Caso 3: RUC de Persona Natural (tercer dígito < 6)
    if (thirdDigit < 6) {
      return EcuadorianIdentification.validateRucNaturalPerson(ruc);
    }

    return { isValid: false, error: `Tercer dígito del RUC inválido (${thirdDigit}).` };
  }

  private static validateRucNaturalPerson(ruc: string): ValidationResult {
    const establishment = ruc.substring(10, 13);
    if (establishment === "000") {
      return { isValid: false, error: "El RUC de persona natural no puede tener establecimiento 000." };
    }

    const cedulaPart = ruc.substring(0, 10);
    const cedulaValidation = EcuadorianIdentification.validateCedula(cedulaPart);

    if (!cedulaValidation.isValid) {
      return { isValid: false, error: `Los primeros 10 dígitos del RUC no forman una cédula válida: ${cedulaValidation.error}` };
    }

    return { isValid: true, rucSubtype: "PERSONA_NATURAL" };
  }

  private static validateRucPrivateSociety(ruc: string): ValidationResult {
    const establishment = ruc.substring(10, 13);
    if (establishment === "000") {
      return { isValid: false, error: "El RUC de sociedad privada no puede terminar en 000." };
    }

    const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      sum += parseInt(ruc.charAt(i), 10) * coefficients[i]!;
    }

    const remainder = sum % 11;
    const expectedVerifier = remainder === 0 ? 0 : 11 - remainder;
    const actualVerifier = parseInt(ruc.charAt(9), 10);

    if (expectedVerifier !== actualVerifier) {
      return { isValid: false, error: "Dígito verificador de RUC de sociedad privada no coincide (Módulo 11)." };
    }

    return { isValid: true, rucSubtype: "SOCIEDAD_PRIVADA" };
  }

  private static validateRucPublicEntity(ruc: string): ValidationResult {
    const establishment = ruc.substring(9, 13);
    if (establishment === "0000") {
      return { isValid: false, error: "El RUC de entidad pública no puede terminar en 0000." };
    }

    const coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 8; i++) {
      sum += parseInt(ruc.charAt(i), 10) * coefficients[i]!;
    }

    const remainder = sum % 11;
    const expectedVerifier = remainder === 0 ? 0 : 11 - remainder;
    const actualVerifier = parseInt(ruc.charAt(8), 10);

    if (expectedVerifier !== actualVerifier) {
      return { isValid: false, error: "Dígito verificador de RUC de entidad pública no coincide (Módulo 11)." };
    }

    return { isValid: true, rucSubtype: "INSTITUCION_PUBLICA" };
  }

  private static validateConsumidorFinal(value: string): ValidationResult {
    if (value === "9999999999999") {
      return { isValid: true };
    }
    return { isValid: false, error: "Consumidor Final debe ser exactamente 9999999999999." };
  }

  private static validatePassport(value: string): ValidationResult {
    if (!/^[a-zA-Z0-9-]{3,20}$/.test(value)) {
      return { isValid: false, error: "El pasaporte/ID exterior debe tener entre 3 y 20 caracteres alfanuméricos." };
    }
    return { isValid: true };
  }

  public getType(): IdentificationType {
    return this.type;
  }

  public getValue(): string {
    return this.value;
  }

  public getRucSubtype(): RucSubtype | undefined {
    return this.rucSubtype;
  }

  public isConsumidorFinal(): boolean {
    return this.type === "CONSUMIDOR_FINAL";
  }

  public toString(): string {
    return this.value;
  }
}
