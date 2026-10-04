import { randomBytes } from "crypto";
import { ValidationError } from "../errors/domain-error";

let lastTimestamp = -1;
let sequenceCounter = 0;

/**
 * Genera un identificador universal UUID versión 7 (RFC 9562).
 *
 * Características críticas para el ERP:
 * 1. Ordenable cronológicamente: Los primeros 48 bits contienen la marca temporal en milisegundos.
 * 2. Excelente rendimiento en índices B-Tree de PostgreSQL (evita la fragmentación de páginas de UUIDv4 aleatorios).
 * 3. Totalmente compatible con el tipo nativo `uuid` de PostgreSQL.
 */
export function generateUUIDv7(): string {
  let timestamp = Date.now();

  // Control de monotonicidad dentro del mismo milisegundo
  if (timestamp === lastTimestamp) {
    sequenceCounter = (sequenceCounter + 1) & 0xfff;
    if (sequenceCounter === 0) {
      // Si se satura el contador de 12 bits en el mismo milisegundo, avanza el timestamp
      while (timestamp <= lastTimestamp) {
        timestamp = Date.now();
      }
    }
  } else {
    lastTimestamp = timestamp;
    sequenceCounter = 0;
  }

  // 48 bits de timestamp
  const timeHex = timestamp.toString(16).padStart(12, "0");

  // 16 bits de versión (7) y subsecuencia/aleatorio
  const verAndSeq = (0x7000 | (sequenceCounter & 0x0fff)).toString(16).padStart(4, "0");

  // Bytes aleatorios para los 64 bits restantes
  const random = randomBytes(8);
  // Variante 10xx (RFC 4122 / 9562) en los bits 64-65
  random[0] = (random[0]! & 0x3f) | 0x80;

  const randHex = random.toString("hex");

  // Formato estándar: 8-4-4-4-12
  return [
    timeHex.substring(0, 8),
    timeHex.substring(8, 12),
    verAndSeq,
    randHex.substring(0, 4),
    randHex.substring(4, 16),
  ].join("-");
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida si una cadena es un UUID válido según el estándar.
 */
export function isValidUUID(value: string): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Asegura que una cadena sea un UUID válido o lanza ValidationError.
 */
export function assertUUID(value: string, fieldName = "ID"): void {
  if (!isValidUUID(value)) {
    throw new ValidationError(
      `El campo ${fieldName} debe ser un UUID válido. Recibido: ${value}`,
      "INVALID_UUID"
    );
  }
}
