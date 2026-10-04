import { createHash } from "node:crypto";
import { User } from "../entities/user.entity";

/**
 * Servicio de Autenticación y Autorización para Operaciones de Supervisor en mostrador.
 */
export class SupervisorAuthService {
  /**
   * Hashea un PIN de 4 dígitos usando SHA-256 con salt de aplicación.
   */
  public static hashPin(pin: string, salt = "lumsa-supervisor-pin"): string {
    return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
  }

  /**
   * Valida si un PIN de 4 dígitos coincide con el PIN registrado de un usuario supervisor o administrador.
   */
  public static verifyPin(user: User, rawPin: string, salt = "lumsa-supervisor-pin"): boolean {
    return user.verifySupervisorPin(rawPin, (p) => this.hashPin(p, salt));
  }
}
