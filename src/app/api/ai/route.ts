import { NextResponse } from "next/server";
import { getGeminiClient, DEFAULT_MODEL } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { prompt, model } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "El campo 'prompt' es obligatorio y debe ser un texto." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY no encontrada. Agrega tu API key en el archivo .env.local para comenzar.",
        },
        { status: 500 }
      );
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: model || DEFAULT_MODEL,
      contents: prompt,
    });

    return NextResponse.json({
      text: response.text,
      model: model || DEFAULT_MODEL,
    });
  } catch (error) {
    console.error("[API AI Error]:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error inesperado al conectar con Google AI Studio.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
