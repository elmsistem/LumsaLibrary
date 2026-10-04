import { ValidationError } from "@/modules/core/public-api";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import {
  AiAssistantService,
  AiCounterAdviceResponse,
} from "../../domain/services/ai-assistant.service";

export interface AskStationeryAssistantInput {
  query: string;
  warehouseId?: string;
}

/**
 * Caso de Uso: Asistente Inteligente de Mostrador (Gemini).
 * Permite a cajeros consultar rápidamente sustitutos o artículos de catálogo con stock en vivo.
 */
export class AskStationeryAssistantUseCase {
  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly aiAssistantService: AiAssistantService
  ) {}

  public async execute(input: AskStationeryAssistantInput): Promise<AiCounterAdviceResponse> {
    if (!input.query || input.query.trim().length === 0) {
      throw new ValidationError(
        "La consulta para el asistente no puede estar vacía.",
        "EMPTY_ASSISTANT_QUERY"
      );
    }

    // 1. Obtener contexto de productos disponibles con stock en el almacén
    const productsContext = await this.analyticsRepo.getProductsInStockForAi(input.warehouseId, 50);

    // 2. Invocar servicio de IA Gemini
    return this.aiAssistantService.askCounterAssistant({
      query: input.query.trim(),
      productsContext,
    });
  }
}
