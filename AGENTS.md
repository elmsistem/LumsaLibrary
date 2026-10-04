<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LumsaLibrary — Normas Obligatorias para Agentes de IA

Bienvenido a LumsaLibrary, un ERP de alta disponibilidad diseñado con una proyección de 20+ años para librerías y papelerías en Ecuador.

Antes de generar o modificar cualquier archivo de código en este repositorio, **DEBES SEGUIR RIGUROSAMENTE ESTAS DIRECTRICES**:

## 1. Documentación Obligatoria de Referencia (`/docs`)
Antes de implementar cualquier módulo, debes consultar su especificación en:
- `docs/01-vision-y-alcance.md`: Modelo de negocio y glosario ecuatoriano.
- `docs/02-principios-arquitectura.md`: Clean Architecture y desacoplamiento del framework.
- `docs/03-modelo-de-dominio.md`: Entidades, fraccionamiento, PMP y reglas de clientes.
- `docs/04-normativa-sri-ecuador.md`: Especificación técnica SRI (Clave de acceso, XML v1.1.0, XAdES-BES, SOAP).
- `docs/05-estandares-de-codigo.md`: Convenciones de TypeScript y manejo de errores.
- `docs/06-plan-de-implementacion.md`: Fases ordenadas de desarrollo.

## 2. Reglas Técnicas No Negociables
1. **Desacoplamiento Total:** La lógica de negocio jamás debe residir en componentes de React (`src/app`). Debe estructurarse en `src/modules/<modulo>/domain` y `application`.
2. **Kardex Inmutable:** Prohibido realizar `UPDATE stock = stock - N` destructivo. Toda alteración de inventario debe registrar un evento inmutable en `inventory_movements`.
3. **Cálculos Monetarios:** Prohibido el uso de operaciones de punto flotante en cálculos de dinero o impuestos del SRI. Usar enteros en centavos o aritmética de precisión decimal fija.
4. **Validación Ecuatoriana Estricta:** Cédulas y RUCs deben validarse con sus algoritmos oficiales (Módulo 10 y Módulo 11). El Consumidor Final está limitado a un máximo de $50 USD según la ley ecuatoriana.
5. **Tipado Estricto:** Prohibido el uso de `any`. Toda entrada externa debe validarse con `zod`.
