import { BillingSriRepository } from "../../domain/repositories/billing-sri.repository";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export class GetNextSequentialUseCase {
  constructor(private readonly repository: BillingSriRepository) {}

  public async execute(
    establishmentCode: string,
    emissionPointCode: string,
    documentTypeCode: string = "01"
  ): Promise<string> {
    if (!/^\d{3}$/.test(establishmentCode)) {
      throw new ValidationError(
        "El código de establecimiento debe ser de 3 dígitos (ej: 001).",
        "INVALID_ESTABLISHMENT_CODE"
      );
    }

    if (!/^\d{3}$/.test(emissionPointCode)) {
      throw new ValidationError(
        "El código de punto de emisión debe ser de 3 dígitos (ej: 001).",
        "INVALID_EMISSION_POINT_CODE"
      );
    }

    return this.repository.getNextSequential(
      establishmentCode,
      emissionPointCode,
      documentTypeCode
    );
  }
}
