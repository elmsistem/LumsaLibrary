import {
  AiAssistantService,
  AiDemandPredictionResponse,
} from "../../domain/services/ai-assistant.service";

export interface PredictSeasonSuppliesDemandInput {
  region: "COSTA" | "SIERRA";
  year?: number;
  historicalNotes?: string;
}

/**
 * Caso de Uso: Asistente Predictivo de Compras para Temporada Escolar (Gemini).
 */
export class PredictSeasonSuppliesDemandUseCase {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  public async execute(
    input: PredictSeasonSuppliesDemandInput
  ): Promise<AiDemandPredictionResponse> {
    const year = input.year ?? new Date().getFullYear();
    const historicalSummary =
      input.historicalNotes ??
      `Temporada Escolar Régimen ${input.region} - Año ${year}. Histórico de incremento en ventas de listas escolares del 45% en cuadernos Norma y papelería Faber-Castell durante las 3 semanas previas al inicio de clases.`;

    return this.aiAssistantService.predictSeasonalDemand({
      region: input.region,
      historicalSummary,
    });
  }
}
