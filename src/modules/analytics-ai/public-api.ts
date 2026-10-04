// --- Domain Repositories & Services ---
export {
  type AnalyticsRepository,
  type FinancialSummaryData,
  type SlowMovingItemData,
  type ProductProfitabilityData,
  type FilterDateParams,
  type ProductStockInfoForAi,
} from "./domain/repositories/analytics.repository";

export {
  type AiAssistantService,
  type AiCounterAdviceRequest,
  type AiCounterAdviceResponse,
  type SuggestedProductItem,
  type AiDemandPredictionRequest,
  type AiDemandPredictionResponse,
  type RecommendedPurchaseItem,
} from "./domain/services/ai-assistant.service";

// --- Application Use Cases ---
export {
  GetFinancialSummaryUseCase,
  type GetFinancialSummaryInput,
} from "./application/use-cases/get-financial-summary.use-case";

export {
  GetSlowMovingInventoryUseCase,
  type GetSlowMovingInventoryInput,
} from "./application/use-cases/get-slow-moving-inventory.use-case";

export {
  AskStationeryAssistantUseCase,
  type AskStationeryAssistantInput,
} from "./application/use-cases/ask-stationery-assistant.use-case";

export {
  PredictSeasonSuppliesDemandUseCase,
  type PredictSeasonSuppliesDemandInput,
} from "./application/use-cases/predict-season-supplies-demand.use-case";

// --- Infrastructure ---
export { DrizzleAnalyticsRepository } from "./infrastructure/persistence/drizzle-analytics.repository";
export { GeminiAiAssistantService } from "./infrastructure/ai/gemini-ai-assistant.service";
