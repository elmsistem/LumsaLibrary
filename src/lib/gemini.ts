import { GoogleGenAI } from "@google/genai";

let clientInstance: GoogleGenAI | null = null;

/**
 * Obtiene o inicializa la instancia singleton de GoogleGenAI.
 * La inicialización se realiza bajo demanda (lazy) para evitar advertencias
 * o errores durante la fase de compilación estática de Next.js.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY no está definida. Por favor agrégala en el archivo .env.local"
    );
  }

  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey });
  }

  return clientInstance;
}

export const DEFAULT_MODEL = "gemini-2.5-flash";
