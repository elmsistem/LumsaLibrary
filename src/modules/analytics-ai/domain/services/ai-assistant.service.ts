import { ProductStockInfoForAi } from "../repositories/analytics.repository";

export interface AiCounterAdviceRequest {
  query: string;
  productsContext: ProductStockInfoForAi[];
}

export interface SuggestedProductItem {
  sku: string;
  name: string;
  retailPriceDollars: number;
  availableStock: number;
  reason: string;
}

export interface AiCounterAdviceResponse {
  answer: string;
  suggestedProducts: SuggestedProductItem[];
}

export interface AiDemandPredictionRequest {
  region: "COSTA" | "SIERRA";
  historicalSummary: string;
}

export interface RecommendedPurchaseItem {
  productName: string;
  suggestedQuantity: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  justification: string;
}

export interface AiDemandPredictionResponse {
  seasonalInsight: string;
  recommendedPurchases: RecommendedPurchaseItem[];
}

export interface AiAssistantService {
  askCounterAssistant(request: AiCounterAdviceRequest): Promise<AiCounterAdviceResponse>;
  predictSeasonalDemand(request: AiDemandPredictionRequest): Promise<AiDemandPredictionResponse>;
}
