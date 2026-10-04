import { getGeminiClient, DEFAULT_MODEL } from "@/lib/gemini";
import {
  AiAssistantService,
  AiCounterAdviceRequest,
  AiCounterAdviceResponse,
  AiDemandPredictionRequest,
  AiDemandPredictionResponse,
} from "../../domain/services/ai-assistant.service";

export class GeminiAiAssistantService implements AiAssistantService {
  public async askCounterAssistant(
    request: AiCounterAdviceRequest
  ): Promise<AiCounterAdviceResponse> {
    if (!process.env.GEMINI_API_KEY) {
      // Modo fallback para desarrollo/test sin API key
      const matches = request.productsContext
        .filter((p) =>
          request.query.toLowerCase().split(" ").some((term) =>
            p.name.toLowerCase().includes(term) || (p.category && p.category.toLowerCase().includes(term))
          )
        )
        .slice(0, 3);

      return {
        answer: `(Asistente Local) Se encontraron ${matches.length} productos en stock relacionados con "${request.query}".`,
        suggestedProducts: matches.map((m) => ({
          sku: m.sku,
          name: m.name,
          retailPriceDollars: m.retailPriceCents / 100,
          availableStock: m.stockUnits,
          reason: "Coincidencia directa de catálogo disponible en inventario.",
        })),
      };
    }

    try {
      const ai = getGeminiClient();

      const contextItems = request.productsContext
        .slice(0, 50)
        .map(
          (p) =>
            `- SKU: ${p.sku} | ${p.name} | Cat: ${p.category || "General"} | Stock: ${p.stockUnits} ${p.minUnit} | Precio: $${(p.retailPriceCents / 100).toFixed(2)}`
        )
        .join("\n");

      const prompt = `Eres el Asistente Inteligente de Mostrador de LumsaLibrary, una librería y papelería líder en Ecuador.
Tu labor es responder consultas de cajeros y dependientes de mostrador para recomendar útiles escolares, libros y artículos de oficina de manera rápida, amable y precisa.

CONSULTA DEL CLIENTE / CAJERO:
"${request.query}"

PRODUCTOS ACTUALMENTE DISPONIBLES EN STOCK:
${contextItems}

INSTRUCCIONES:
1. Recomienda solo artículos que existan en el stock proporcionado.
2. Si el producto solicitado exacto no existe, sugiere alternativas o sustitutos escolares equivalentes de buena calidad y precio razonable.
3. Responde en formato JSON estricto con la siguiente estructura:
{
  "answer": "Explicación breve y amigable para el cajero (máximo 2 párrafos)",
  "suggestedProducts": [
    {
      "sku": "SKU del producto",
      "name": "Nombre exacto",
      "retailPriceDollars": 2.50,
      "availableStock": 15,
      "reason": "Por qué es la mejor opción o sustituto"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);

      return {
        answer: parsed.answer || "No se pudo generar una respuesta detallada.",
        suggestedProducts: Array.isArray(parsed.suggestedProducts)
          ? parsed.suggestedProducts
          : [],
      };
    } catch {
      // Fallback ante fallo de red o cuota del LLM
      return {
        answer: `Consulta procesada con sugerencias aproximadas para "${request.query}".`,
        suggestedProducts: request.productsContext.slice(0, 3).map((p) => ({
          sku: p.sku,
          name: p.name,
          retailPriceDollars: p.retailPriceCents / 100,
          availableStock: p.stockUnits,
          reason: "Artículo sugerido en base al stock general de librería.",
        })),
      };
    }
  }

  public async predictSeasonalDemand(
    request: AiDemandPredictionRequest
  ): Promise<AiDemandPredictionResponse> {
    if (!process.env.GEMINI_API_KEY) {
      return {
        seasonalInsight: `Proyección estacional para Régimen ${request.region}: Alta rotación de cuadernos de 100 hojas cosidos/espiral, carpetas, témperas y juegos geométricos.`,
        recommendedPurchases: [
          {
            productName: "Cuaderno Espiral 100H Cuadros/Líneas",
            suggestedQuantity: 500,
            priority: "HIGH",
            justification: "Producto básico e infaltable en todas las listas escolares ecuatorianas.",
          },
          {
            productName: "Caja Lápices de Colores x 12/24",
            suggestedQuantity: 200,
            priority: "HIGH",
            justification: "Alta demanda en educación inicial y básica.",
          },
        ],
      };
    }

    try {
      const ai = getGeminiClient();

      const prompt = `Actúa como Director de Operaciones y Abastecimiento para LumsaLibrary en Ecuador.
Analiza la demanda de la próxima Temporada Escolar para el Régimen ${request.region} (Costa o Sierra).

DATOS HISTÓRICOS Y CONTEXTO:
${request.historicalSummary}

INSTRUCCIONES:
1. Evalúa el comportamiento del mercado de útiles escolares y editoriales en Ecuador.
2. Identifica los productos clave para evitar quiebres de inventario durante el pico de compras de listas escolares.
3. Devuelve la respuesta en formato JSON estricto:
{
  "seasonalInsight": "Análisis estratégico de la temporada y recomendaciones de volumen",
  "recommendedPurchases": [
    {
      "productName": "Nombre o tipo de producto",
      "suggestedQuantity": 300,
      "priority": "HIGH",
      "justification": "Razón comercial basada en listas escolares y rotación"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);

      return {
        seasonalInsight: parsed.seasonalInsight || "Análisis completado.",
        recommendedPurchases: Array.isArray(parsed.recommendedPurchases)
          ? parsed.recommendedPurchases
          : [],
      };
    } catch {
      return {
        seasonalInsight: `Estimación automática para Temporada Escolar ${request.region}.`,
        recommendedPurchases: [
          {
            productName: "Cuadernos Universitarios y Escolares",
            suggestedQuantity: 250,
            priority: "HIGH",
            justification: "Volumen mínimo recomendado para el inicio de clases.",
          },
        ],
      };
    }
  }
}
