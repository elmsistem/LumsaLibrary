import { PosRepository } from "../../domain/repositories/pos.repository";
import { CashSession } from "../../domain/entities/cash-session.entity";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface OpenCashSessionDto {
  userId: string;
  terminalCode: string;
  establishmentCode?: string;
  emissionPointCode?: string;
  initialFloatCents: number;
}

export class OpenCashSessionUseCase {
  constructor(private readonly posRepo: PosRepository) {}

  public async execute(dto: OpenCashSessionDto): Promise<CashSession> {
    // 1. Validar que el cajero no tenga otro turno activo
    const existingUserSession = await this.posRepo.findOpenSessionByUser(dto.userId);
    if (existingUserSession) {
      throw new ValidationError(
        `El usuario ya tiene una sesión de caja abierta en la terminal "${existingUserSession.getTerminalCode()}".`,
        "USER_ALREADY_HAS_OPEN_SESSION"
      );
    }

    // 2. Validar que la terminal no esté ocupada por otro usuario
    const existingTerminalSession = await this.posRepo.findOpenSessionByTerminal(dto.terminalCode);
    if (existingTerminalSession) {
      throw new ValidationError(
        `La terminal "${dto.terminalCode}" ya tiene una sesión activa abierta por otro cajero.`,
        "TERMINAL_ALREADY_OCCUPIED"
      );
    }

    const session = CashSession.open({
      userId: dto.userId,
      terminalCode: dto.terminalCode,
      establishmentCode: dto.establishmentCode || "001",
      emissionPointCode: dto.emissionPointCode || "001",
      initialFloat: Money.fromCents(dto.initialFloatCents),
    });

    await this.posRepo.saveSession(session);
    return session;
  }
}
