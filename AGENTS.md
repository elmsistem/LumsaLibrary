<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LumsaLibrary — Normas Obligatorias para Agentes de IA

Bienvenido a LumsaLibrary, un ERP de alta disponibilidad diseñado con una proyección de 20+ años para librerías y papelerías en Ecuador.

Antes de generar o modificar cualquier archivo de código en este repositorio, **DEBES SEGUIR RIGUROSAMENTE ESTAS DIRECTRICES**:

## 0. Directriz Cero: Validación Previa Obligatoria contra el Plan (Anti-Drift Gate)
**PROHIBICIÓN DE COMPLACENCIA CIEGA:** Antes de ejecutar cualquier orden, comando o cambio de código solicitado por el usuario, el agente TIENE LA OBLIGACIÓN de contrastar la solicitud contra:
1. Las Reglas Técnicas No Negociables de este documento (`AGENTS.md`).
2. El Modelo de Dominio y Principios de Arquitectura (`docs/01` al `docs/04`).
3. La Fase Activa y Secuencia de la Hoja de Ruta (`docs/06` y `docs/07`).

**Si la solicitud del usuario:**
- Se salta fases o prerrequisitos técnicos (ej. crear pantallas sin persistencia previa en base de datos).
- Viola principios de arquitectura (ej. meter lógica en React, usar mocks/datos en memoria, omitir cálculos del SRI o PMP).
- Genera contradicciones u omisiones en el modelo de datos o planes vigentes.

**EL AGENTE TIENE PROHIBIDO EJECUTARLA DIRECTAMENTE.**  
El agente DEBE DETENERSE y emitir un **Informe de Alerta de Conformidad y Evaluación de Impacto** con el siguiente formato obligatorio:

```markdown
⚠️ [ALERTA DE CONFORMIDAD ARQUITECTÓNICA Y CONTROL DE CAMBIOS]

1. SOLICITUD EVALUADA:
   > "[Instrucción exacta del usuario]"

2. CONFLICTO NORMATIVO IDENTIFICADO:
   - Documento / Regla Afectada: [docs/XX o AGENTS.md Regla N]
   - Infracción: [Descripción precisa de la contradicción o salto de fase]

3. DIAGNÓSTICO DE RIESGO Y CONTRADICCIONES:
   - Impacto Técnico: [Riesgo de deuda técnica, pérdida de datos o inconsistencia]
   - Contradicción en el Plan: [Por qué contradice la secuencia planificada]
   - Riesgo Legal / SRI: [Si afecta normativa tributaria ecuatoriana]

4. PROCEDIMIENTO CORRECTO SEGÚN EL PLAN:
   [La secuencia técnica y ordenada que debe ejecutarse paso a paso]

5. OPCIONES DE CONTINUIDAD PARA EL USUARIO:
   - Opción A (Recomendada): Proceder con el Paso Correcto según la Hoja de Ruta.
   - Opción B (Modificación Formal del Plan): Si el negocio exige alterar el plan, actualizar formalmente docs/06 y docs/07 antes de escribir código.
```

## 1. Documentación Obligatoria de Referencia (`/docs`)
Antes de implementar cualquier módulo, debes consultar su especificación en:
- `docs/01-vision-y-alcance.md`: Modelo de negocio y glosario ecuatoriano.
- `docs/02-principios-arquitectura.md`: Clean Architecture y desacoplamiento del framework.
- `docs/03-modelo-de-dominio.md`: Entidades, fraccionamiento, PMP y reglas de clientes.
- `docs/04-normativa-sri-ecuador.md`: Especificación técnica SRI (Clave de acceso, XML v1.1.0, XAdES-BES, SOAP).
- `docs/05-estandares-de-codigo.md`: Convenciones de TypeScript y manejo de errores.
- `docs/06-plan-de-implementacion.md`: Fases ordenadas de desarrollo.
- `docs/07-trazabilidad-y-estado-de-implementacion.md`: Matriz de madurez, bitácora auditable y protocolo de verificación.

## 2. Reglas Técnicas No Negociables
1. **Desacoplamiento Total:** La lógica de negocio jamás debe residir en componentes de React (`src/app`). Debe estructurarse en `src/modules/<modulo>/domain` y `application`.
2. **Kardex Inmutable:** Prohibido realizar `UPDATE stock = stock - N` destructivo. Toda alteración de inventario debe registrar un evento inmutable en `inventory_movements`.
3. **Cálculos Monetarios:** Prohibido el uso de operaciones de punto flotante en cálculos de dinero o impuestos del SRI. Usar enteros en centavos o aritmética de precisión decimal fija.
4. **Validación Ecuatoriana Estricta:** Cédulas y RUCs deben validarse con sus algoritmos oficiales (Módulo 10 y Módulo 11). El Consumidor Final está limitado a un máximo de $50 USD según la ley ecuatoriana.
5. **Tipado Estricto:** Prohibido el uso de `any`. Toda entrada externa debe validarse con `zod`.
6. **Prohibición de Interfaces Volátiles (Anti-Mocking):** Prohibido crear maquetas estáticas con datos en memoria (`useState` con listas quemadas) para simular funcionamiento. Toda interfaz de usuario debe estar conectada a la base de datos real mediante la capa de aplicación.
7. **Trazabilidad y Verificación Obligatoria:** Toda implementación debe registrarse en `docs/07-trazabilidad-y-estado-de-implementacion.md` con evidencia comprobable (tests, scripts de BD o endpoints verificados) antes de darse por completada.
