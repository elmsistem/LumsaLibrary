import { ValidationError } from "../../../core/domain/errors/domain-error";

export type SriDocumentType = "01" | "04" | "07"; // 01: Factura, 04: Nota de Crédito, 07: Retención
export type SriEnvironment = "1" | "2"; // 1: Pruebas, 2: Producción

export interface GenerateAccessKeyProps {
  emissionDate: Date;
  documentType: SriDocumentType;
  ruc: string;
  environment: SriEnvironment;
  establishment: string; // 3 dígitos
  emissionPoint: string; // 3 dígitos
  sequential: number | string; // 9 dígitos
  numericCode?: string; // 8 dígitos aleatorios o deterministas
  emissionType?: "1"; // 1: Normal
}

/**
 * Value Object inmutable que representa y genera la Clave de Acceso oficial de 49 dígitos
 * exigida por el Servicio de Rentas Internas (SRI) del Ecuador.
 */
export class AccessKey {
  private readonly value: string;

  private constructor(value: string) {
    if (!/^\d{49}$/.test(value)) {
      throw new ValidationError(
        `La clave de acceso del SRI debe contener exactamente 49 dígitos numéricos. Recibido: ${value}`,
        "INVALID_ACCESS_KEY_LENGTH"
      );
    }

    const base48 = value.substring(0, 48);
    const expectedVerifier = AccessKey.calculateModule11(base48);
    const actualVerifier = parseInt(value.charAt(48), 10);

    if (expectedVerifier !== actualVerifier) {
      throw new ValidationError(
        `El dígito verificador de la clave de acceso es inválido. Calculado: ${expectedVerifier}, recibido: ${actualVerifier}`,
        "INVALID_ACCESS_KEY_CHECKSUM"
      );
    }

    this.value = value;
    Object.freeze(this);
  }

  /**
   * Genera una Clave de Acceso válida a partir de los datos requeridos por la ficha técnica del SRI.
   */
  public static generate(props: GenerateAccessKeyProps): AccessKey {
    // 1. Fecha en formato ddmmaaaa (8 dígitos)
    const day = String(props.emissionDate.getDate()).padStart(2, "0");
    const month = String(props.emissionDate.getMonth() + 1).padStart(2, "0");
    const year = String(props.emissionDate.getFullYear());
    const dateStr = `${day}${month}${year}`;

    // 2. Tipo de comprobante (2 dígitos)
    const docType = props.documentType;

    // 3. RUC (13 dígitos)
    const cleanRuc = props.ruc.trim();
    if (!/^\d{13}$/.test(cleanRuc)) {
      throw new ValidationError(
        `El RUC del emisor debe tener exactamente 13 dígitos numéricos. Recibido: ${cleanRuc}`,
        "INVALID_RUC_FOR_ACCESS_KEY"
      );
    }

    // 4. Tipo de ambiente (1 dígito: 1=Pruebas, 2=Producción)
    const env = props.environment;

    // 5. Serie: Establecimiento (3 dígitos) + Punto de Emisión (3 dígitos)
    const estab = String(props.establishment).padStart(3, "0").substring(0, 3);
    const ptoEmi = String(props.emissionPoint).padStart(3, "0").substring(0, 3);

    // 6. Secuencial (9 dígitos)
    const seq = String(props.sequential).padStart(9, "0").substring(0, 9);

    // 7. Código numérico de seguridad (8 dígitos)
    let numCode = props.numericCode ? String(props.numericCode).padStart(8, "0").substring(0, 8) : "";
    if (!numCode || !/^\d{8}$/.test(numCode)) {
      // Generar 8 dígitos deterministas basados en el secuencial y timestamp si no se provee
      numCode = String(Math.floor(10000000 + Math.random() * 90000000));
    }

    // 8. Tipo de emisión (1 dígito: 1=Normal)
    const emissionType = props.emissionType || "1";

    // 48 dígitos base
    const base48 = `${dateStr}${docType}${cleanRuc}${env}${estab}${ptoEmi}${seq}${numCode}${emissionType}`;

    // 9. Dígito verificador Módulo 11 (1 dígito)
    const verifier = AccessKey.calculateModule11(base48);

    const fullKey = `${base48}${verifier}`;
    return new AccessKey(fullKey);
  }

  /**
   * Crea una instancia a partir de una clave existente de 49 dígitos verificándola.
   */
  public static fromString(key: string): AccessKey {
    return new AccessKey(key.trim());
  }

  /**
   * Algoritmo Módulo 11 ponderado oficial del SRI (Factores cíclicos del 2 al 7 de derecha a izquierda).
   */
  public static calculateModule11(base48: string): number {
    const weights = [2, 3, 4, 5, 6, 7];
    let sum = 0;
    let weightIndex = 0;

    for (let i = base48.length - 1; i >= 0; i--) {
      const digit = parseInt(base48[i]!, 10);
      sum += digit * weights[weightIndex]!;
      weightIndex = (weightIndex + 1) % weights.length;
    }

    const remainder = sum % 11;
    const verifier = 11 - remainder;

    if (verifier === 11) return 0;
    if (verifier === 10) return 1;
    return verifier;
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }
}
