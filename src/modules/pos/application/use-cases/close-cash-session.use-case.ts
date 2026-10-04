import { PosRepository } from "../../domain/repositories/pos.repository";
import { CashSession } from "../../domain/entities/cash-session.entity";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface CloseCashSessionDto {
  sessionId: string;
  declaredCashCents: number;
  closingNotes?: string | null;
}

export class CloseCashSessionUseCase {
  constructor(private readonly posRepo: PosRepository) {}

  public async execute(dto: CloseCashSessionDto): Promise<CashSession> {
    const session = await this.posRepo.findSessionById(dto.sessionId);
    if (!session) {
      throw new ValidationError(
        `Sesión de caja con ID ${dto.sessionId} no encontrada.`,
        "CASH_SESSION_NOT_FOUND"
      );
    }

    if (!session.isOpen()) {
      throw new ValidationError(
        "La sesión de caja seleccionada ya está cerrada.",
        "CASH_SESSION_ALREADY_CLOSED"
      );
    }

    // Calcular el efectivo esperado del sistema (Fondo Inicial + Pagos Efectivo)
    const expectedCash = await this.posRepo.calculateSessionExpectedCash(dto.sessionId);
    const declaredCash = Money.fromCents(dto.declaredCashCents);

    // Cierre ciego: Graba la declaración del cajero y la discrepancia calculada
    session.closeBlind(declaredCash, expectedCash, dto.closingNotes || undefined);

    await this.posRepo.saveSession(session);
    return session;
  }
}
