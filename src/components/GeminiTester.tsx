"use client";

import { useEffect, useState } from "react";

interface StatusData {
  configured: boolean;
  model: string;
  message: string;
}

export default function GeminiTester() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai")
      .then((res) => res.json())
      .then((data: StatusData) => {
        setStatus(data);
        setLoadingStatus(false);
      })
      .catch((err) => {
        console.error("Error al obtener estado:", err);
        setLoadingStatus(false);
      });
  }, []);

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loadingPrompt) return;

    setLoadingPrompt(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error en la solicitud");
      }

      setResponse(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoadingPrompt(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Conexión con Google AI Studio
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            SDK Oficial de Google Gen AI en Next.js App Router
          </p>
        </div>

        {/* Estado de la API Key */}
        <div>
          {loadingStatus ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 animate-pulse">
              Verificando...
            </span>
          ) : status?.configured ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              API Key Vinculada ({status.model})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              API Key Pendiente
            </span>
          )}
        </div>
      </div>

      {/* Alerta si falta la clave */}
      {!loadingStatus && !status?.configured && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-2">
          <p className="font-semibold flex items-center gap-2">
            ⚠️ Falta configurar tu clave en el archivo local
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            Para activar la vinculación, crea el archivo <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">.env.local</code> en la raíz del proyecto y escribe:
          </p>
          <pre className="font-mono text-xs bg-zinc-900 text-zinc-100 p-2.5 rounded-lg overflow-x-auto select-all">
            GEMINI_API_KEY=tu_clave_de_google_ai_studio
          </pre>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/80">
            Puedes obtenerla gratis en{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="underline font-medium hover:text-amber-950 dark:hover:text-amber-100"
            >
              aistudio.google.com/apikey
            </a>
            . Luego reinicia el servidor local (<code className="font-mono">npm run dev</code>).
          </p>
        </div>
      )}

      {/* Formulario de prueba de prompt */}
      <form onSubmit={handleSendPrompt} className="space-y-4">
        <div>
          <label
            htmlFor="prompt"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
          >
            Probar generación con Gemini:
          </label>
          <textarea
            id="prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe una pregunta para Gemini... Ej: ¿Cuáles son las ventajas de Next.js App Router?"
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loadingPrompt || !prompt.trim()}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {loadingPrompt ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-current"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                ></path>
              </svg>
              <span>Generando respuesta...</span>
            </>
          ) : (
            <span>Enviar a Google AI Studio</span>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-4 text-sm text-red-800 dark:text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Respuesta */}
      {response && (
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Respuesta de Google AI Studio:
            </span>
            <span>{status?.model || "gemini-2.5-flash"}</span>
          </div>
          <div className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {response}
          </div>
        </div>
      )}
    </div>
  );
}
