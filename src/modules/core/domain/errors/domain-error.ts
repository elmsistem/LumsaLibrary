/**
 * Clase base para todas las excepciones del dominio de LumsaLibrary.
 * Los errores de dominio son predecibles y contienen un código estándar
 * para serialización y mapeo en capas superiores (API/UI).
 */
export abstract class DomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message, code);
  }
}
