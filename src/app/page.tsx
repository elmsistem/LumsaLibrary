import GeminiTester from "@/components/GeminiTester";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-6 md:p-12">
      <main className="w-full max-w-4xl flex flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            Next.js App Router + TypeScript + Tailwind CSS
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            LumsaLibrary
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm md:text-base">
            Panel de control y verificación de la integración con Google AI Studio.
          </p>
        </div>

        <GeminiTester />
      </main>
    </div>
  );
}
