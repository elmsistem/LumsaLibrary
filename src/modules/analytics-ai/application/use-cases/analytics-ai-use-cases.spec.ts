import { describe, it, expect, beforeEach } from "vitest";
import { generateUUIDv7 } from "@/modules/core/public-api";
import {
  AnalyticsRepository,
  FinancialSummaryData,
  SlowMovingItemData,
  ProductProfitabilityData,
  ProductStockInfoForAi,
  AiAssistantService,
  AiCounterAdviceRequest,
  AiCounterAdviceResponse,
  AiDemandPredictionRequest,
  AiDemandPredictionResponse,
  GetFinancialSummaryUseCase,
  GetSlowMovingInventoryUseCase,
  AskStationeryAssistantUseCase,
  PredictSeasonSuppliesDemandUseCase,
} from "../../public-api";

class MockAnalyticsRepository implements AnalyticsRepository {
  public financialData: FinancialSummaryData = {
    totalSalesCents: 50000, // $500.00
    totalCogsCents: 35000,  // $350.00
    grossProfitCents: 15000,// $150.00
    profitMarginPercent: 30.0, // 30%
    salesCount: 25,
    paymentMethodsBreakdown: [
      { method: "CASH", totalCents: 30000, count: 18 },
      { method: "BANK_TRANSFER_DEUNA", totalCents: 20000, count: 7 },
    ],
  };

  public slowMovingItems: SlowMovingItemData[] = [
    {
      productId: generateUUIDv7(),
      sku: "DIC-ING-01",
      productName: "Diccionario Español-Inglés Avanzado",
      categoryName: "Libros y Diccionarios",
      currentStockUnits: 20,
      currentPmpCents: 1200, // $12.00
      tiedCapitalCents: 24000, // $240.00 capital inmovilizado
      lastMovementDate: new Date("2026-05-01"),
      daysInactive: 156,
    },
  ];

  public stockForAi: ProductStockInfoForAi[] = [
    {
      sku: "TEM-PEL-06",
      name: "Témperas Pelikan 6 Colores",
      category: "Pinturas y Arte",
      stockUnits: 45,
      retailPriceCents: 250, // $2.50
      minUnit: "UNIDAD",
    },
    {
      sku: "CUA-NORM-100",
      name: "Cuaderno Espiral 100H Norma",
      category: "Cuadernos",
      stockUnits: 120,
      retailPriceCents: 180, // $1.80
      minUnit: "UNIDAD",
    },
  ];

  async getFinancialSummary(): Promise<FinancialSummaryData> {
    return this.financialData;
  }

  async getSlowMovingInventory(): Promise<SlowMovingItemData[]> {
    return this.slowMovingItems;
  }

  async getProductProfitability(): Promise<ProductProfitabilityData[]> {
    return [];
  }

  async getProductsInStockForAi(): Promise<ProductStockInfoForAi[]> {
    return this.stockForAi;
  }
}

class MockAiAssistantService implements AiAssistantService {
  async askCounterAssistant(
    request: AiCounterAdviceRequest
  ): Promise<AiCounterAdviceResponse> {
    const matching = request.productsContext.filter((p) =>
      p.name.toLowerCase().includes("témpera")
    );

    return {
      answer: "Tenemos disponibles témperas Pelikan de 6 colores ideales para primaria.",
      suggestedProducts: matching.map((m) => ({
        sku: m.sku,
        name: m.name,
        retailPriceDollars: m.retailPriceCents / 100,
        availableStock: m.stockUnits,
        reason: "Excelente relación calidad-precio para uso escolar.",
      })),
    };
  }

  async predictSeasonalDemand(
    request: AiDemandPredictionRequest
  ): Promise<AiDemandPredictionResponse> {
    return {
      seasonalInsight: `Para Régimen ${request.region}, se proyecta una alta concentración de ventas en la última quincena de agosto.`,
      recommendedPurchases: [
        {
          productName: "Cuaderno Grapa y Espiral 100H",
          suggestedQuantity: 800,
          priority: "HIGH",
          justification: "Artículo central en el 95% de las listas escolares de la región.",
        },
      ],
    };
  }
}

describe("Analytics and AI Module Use Cases", () => {
  let mockAnalyticsRepo: MockAnalyticsRepository;
  let mockAiService: MockAiAssistantService;

  beforeEach(() => {
    mockAnalyticsRepo = new MockAnalyticsRepository();
    mockAiService = new MockAiAssistantService();
  });

  it("GetFinancialSummaryUseCase debe retornar métricas de ingresos, costo PMP y margen bruto", async () => {
    const useCase = new GetFinancialSummaryUseCase(mockAnalyticsRepo);
    const summary = await useCase.execute({
      fromDate: new Date("2026-10-01"),
      toDate: new Date("2026-10-31"),
    });

    expect(summary.totalSalesCents).toBe(50000); // $500.00
    expect(summary.totalCogsCents).toBe(35000);  // $350.00
    expect(summary.grossProfitCents).toBe(15000);// $150.00
    expect(summary.profitMarginPercent).toBe(30.0);
    expect(summary.salesCount).toBe(25);
    expect(summary.paymentMethodsBreakdown).toHaveLength(2);
  });

  it("GetSlowMovingInventoryUseCase debe reportar productos con más de 90 días inactivos y capital congelado", async () => {
    const useCase = new GetSlowMovingInventoryUseCase(mockAnalyticsRepo);
    const items = await useCase.execute({ minDaysInactive: 90 });

    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item?.sku).toBe("DIC-ING-01");
    expect(item?.daysInactive).toBe(156);
    expect(item?.tiedCapitalCents).toBe(24000); // $240.00
  });

  it("AskStationeryAssistantUseCase debe inyectar el catálogo con stock y devolver recomendaciones precisas", async () => {
    const useCase = new AskStationeryAssistantUseCase(mockAnalyticsRepo, mockAiService);
    const response = await useCase.execute({
      query: "¿Qué témperas económicas tenemos en mostrador?",
    });

    expect(response.answer).toContain("témperas Pelikan");
    expect(response.suggestedProducts).toHaveLength(1);
    const [prod] = response.suggestedProducts;
    expect(prod?.sku).toBe("TEM-PEL-06");
    expect(prod?.availableStock).toBe(45);
  });

  it("AskStationeryAssistantUseCase debe rechazar consultas vacías", async () => {
    const useCase = new AskStationeryAssistantUseCase(mockAnalyticsRepo, mockAiService);
    await expect(useCase.execute({ query: "" })).rejects.toThrowError(
      "La consulta para el asistente no puede estar vacía."
    );
  });

  it("PredictSeasonSuppliesDemandUseCase debe procesar la región escolar y generar recomendaciones de compra", async () => {
    const useCase = new PredictSeasonSuppliesDemandUseCase(mockAiService);
    const prediction = await useCase.execute({ region: "SIERRA", year: 2026 });

    expect(prediction.seasonalInsight).toContain("Régimen SIERRA");
    expect(prediction.recommendedPurchases).toHaveLength(1);
    const [rec] = prediction.recommendedPurchases;
    expect(rec?.priority).toBe("HIGH");
    expect(rec?.suggestedQuantity).toBe(800);
  });
});
