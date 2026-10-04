import { z } from "zod";

/**
 * Esquema estricto de variables de entorno para LumsaLibrary.
 * Se valida con Zod para impedir que la aplicación inicie con configuraciones inválidas.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL debe ser una URL de conexión de base de datos válida")
    .default("postgresql://postgres:postgres@localhost:5432/lumsa_library"),
  GEMINI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | null = null;

export function getEnv(): Env {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("❌ Error de validación en variables de entorno:", result.error.format());
      throw new Error("Variables de entorno inválidas. Revisa el archivo .env.local");
    }
    parsedEnv = result.data;
  }
  return parsedEnv;
}
