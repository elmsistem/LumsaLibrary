import {
  AnalyticsRepository,
  FinancialSummaryData,
  FilterDateParams,
} from "../../domain/repositories/analytics.repository";

export interface GetFinancialSummaryInput {
  fromDate?: Date;
  toDate?: Date;
  warehouseId?: string;
}

/**
 * Caso de Uso: Resumen Financiero y Auditoría de Márgenes de Ganancia.
 */
export class GetFinancialSummaryUseCase {
  constructor(private readonly analyticsRepo: AnalyticsRepository) {}

  public async execute(input: GetFinancialSummaryInput = {}): Promise<FinancialSummaryData> {
    const filters: FilterDateParams = {
      fromDate: input.fromDate,
      toDate: input.toDate,
      warehouseId: input.warehouseId,
    };

    return this.analyticsRepo.getFinancialSummary(filters);
  }
}
