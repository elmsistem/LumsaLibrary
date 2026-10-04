import { ValidationError } from "@/modules/core/public-api";
import { SystemSettingsRepository } from "../../domain/repositories/system-settings.repository";
import { SupervisorAuthService } from "../../domain/services/supervisor-auth.service";

export interface AuthorizeSupervisorPinInput {
  pin: string;
  requiredOperation: string; // Ej: "DISCOUNT_OVERRIDE", "SALE_VOID", "DRAWER_OPEN"
}

export interface AuthorizeSupervisorPinResult {
  authorized: boolean;
  supervisorId: string;
  supervisorName: string;
  supervisorRole: string;
}

/**
 * Caso de Uso: Autorización Rápida con PIN de Supervisor en Terminal POS.
 */
export class AuthorizeSupervisorPinUseCase {
  constructor(private readonly repo: SystemSettingsRepository) {}

  public async execute(
    input: AuthorizeSupervisorPinInput
  ): Promise<AuthorizeSupervisorPinResult> {
    if (!/^\d{4}$/.test(input.pin)) {
      throw new ValidationError(
        "El código PIN debe tener exactamente 4 dígitos numéricos.",
        "INVALID_PIN_FORMAT"
      );
    }

    const supervisors = await this.repo.listSupervisorsAndAdmins();
    if (supervisors.length === 0) {
      throw new ValidationError(
        "No existen supervisores o administradores activos configurados en el sistema.",
        "NO_SUPERVISORS_FOUND"
      );
    }

    for (const supervisor of supervisors) {
      if (SupervisorAuthService.verifyPin(supervisor, input.pin)) {
        return {
          authorized: true,
          supervisorId: supervisor.getId(),
          supervisorName: supervisor.getFullName(),
          supervisorRole: supervisor.getRole(),
        };
      }
    }

    throw new ValidationError(
      "PIN de supervisor incorrecto o no autorizado para esta operación.",
      "INVALID_SUPERVISOR_PIN"
    );
  }
}
