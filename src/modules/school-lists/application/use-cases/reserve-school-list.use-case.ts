import { SchoolListRepository } from "../../domain/repositories/school-list.repository";
import { SchoolList } from "../../domain/entities/school-list.entity";
import { PosRepository } from "../../../pos/public-api";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface ReserveSchoolListDto {
  schoolListId: string;
  cashSessionId: string;
  amountCents: number;
  paymentMethod: string;
}

export interface ReserveSchoolListResult {
  schoolList: SchoolList;
  receiptCode: string;
  advanceAmount: Money;
}

export class ReserveSchoolListUseCase {
  constructor(
    private readonly schoolListRepo: SchoolListRepository,
    private readonly posRepo: PosRepository
  ) {}

  public async execute(dto: ReserveSchoolListDto): Promise<ReserveSchoolListResult> {
    const list = await this.schoolListRepo.findSchoolListById(dto.schoolListId);
    if (!list) {
      throw new ValidationError(
        `Lista escolar con ID ${dto.schoolListId} no encontrada.`,
        "SCHOOL_LIST_NOT_FOUND"
      );
    }

    const session = await this.posRepo.findSessionById(dto.cashSessionId);
    if (!session || !session.isOpen()) {
      throw new ValidationError(
        "No se puede registrar un abono sin una sesión de caja activa y abierta.",
        "CASH_SESSION_NOT_OPEN"
      );
    }

    if (dto.amountCents <= 0) {
      throw new ValidationError(
        "El monto del anticipo debe ser mayor que cero.",
        "INVALID_ADVANCE_AMOUNT"
      );
    }

    const advanceAmount = Money.fromCents(dto.amountCents);
    const receiptCode = await this.schoolListRepo.getNextAdvanceSequential();

    // 1. Transición de estado en la lista y reserva de ítems
    list.reserve(advanceAmount);

    // 2. Registrar el anticipo en caja
    await this.schoolListRepo.saveAdvance({
      id: generateUUIDv7(),
      schoolListId: list.getId(),
      cashSessionId: session.getId(),
      amount: advanceAmount,
      paymentMethod: dto.paymentMethod,
      receiptCode,
      createdAt: new Date(),
    });

    // 3. Persistir lista actualizada
    await this.schoolListRepo.saveSchoolList(list);

    return {
      schoolList: list,
      receiptCode,
      advanceAmount,
    };
  }
}
