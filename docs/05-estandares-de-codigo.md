# 05. Estándares de Código y Directrices para Agentes y Desarrolladores

> **Estado:** Documento Normativo Obligatorio  
> **Destinatarios:** Todos los Desarrolladores Humanos y Agentes Autónomos de IA

---

## 1. Directiva Principal para Agentes de Inteligencia Artificial

> [!CRITICAL]
> **Antes de escribir o modificar código en este repositorio:**
> 1. Debes leer el contexto del módulo correspondiente en `/docs`.
> 2. No debes colocar lógica de negocio o cálculos fiscales dentro de componentes de interfaz (React / JSX).
> 3. Debes respetar el tipado estricto de TypeScript. El uso de `any` está prohibido.
> 4. Toda operación que involucre inventario debe pasar por un evento auditable de Kardex.
> 5. Toda operación monetaria debe usar aritmética de precisión fija (evitar errores de punto flotante de JavaScript).

---

## 2. Convenciones de TypeScript

### 2.1. Tipado Estricto y Prohibición de `any`
* Si el tipo no se conoce de antemano (ej. carga dinámica de JSON/XML), usar `unknown` combinado con validación mediante esquemas (`zod`).
* Preferir `type` para uniones discriminadas y tipos de datos puros; `interface` para contratos y puertos de servicios.

### 2.2. Aritmética Monetaria y Decimal
JavaScript evalúa `0.1 + 0.2 === 0.30000000000000004`. En un ERP que emite facturas legales, esto produce descuadres fiscales sancionables por el SRI:
* **Regla:** Todos los cálculos de precios, subtotales, descuentos e IVA deben realizarse utilizando enteros en centavos o librerías de precisión decimal exacta (ej. `decimal.js`).
* El redondeo oficial del SRI es a **dos decimales** utilizando redondeo estándar (mitad hacia arriba):
  $$\text{Redondeo}(2.555) = 2.56$$

### 2.3. Manejo de Errores Tipados
No arrojar cadenas genéricas (`throw "error"`). Utilizar clases de error de dominio bien tipadas:

```typescript
export abstract class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productName: string, requested: number, available: number) {
    super(
      `Stock insuficiente para "${productName}". Solicitado: ${requested}, Disponible: ${available}`,
      "INSUFFICIENT_STOCK"
    );
  }
}

export class InvalidEcuadorianIdError extends DomainError {
  constructor(id: string) {
    super(`El número de identificación "${id}" no es válido en Ecuador.`, "INVALID_ID");
  }
}
```

---

## 3. Estructura Canónica de un Módulo

Cada módulo bajo `src/modules/<nombre_modulo>/` debe seguir esta distribución:

```
src/modules/<modulo>/
├── domain/                    # Capa 1: Entidades, Value Objects, Errores y Reglas Puras
│   ├── entities/
│   ├── value-objects/
│   ├── errors/
│   └── repositories/          # Interfaces (Puertos) de persistencia
│
├── application/               # Capa 2: Casos de Uso (Orquestación del flujo)
│   ├── use-cases/
│   └── dtos/
│
├── infrastructure/            # Capa 3: Implementación concreta (Adapters)
│   ├── persistence/           # Repositorios PostgreSQL
│   └── external/              # Clientes de APIs, Web Services, etc.
│
└── public-api.ts              # Único punto de exportación hacia otros módulos
```

---

## 4. Convenciones de Nombres y Archivos

* **Archivos y Directorios:** `kebab-case` (ej. `create-sale-order.use-case.ts`, `inventory-movement.entity.ts`).
* **Clases y Tipos:** `PascalCase` (ej. `SaleOrder`, `InventoryMovement`).
* **Funciones y Variables:** `camelCase` (ej. `calculateSubtotals`, `customerRuc`).
* **Constantes Globales:** `SCREAMING_SNAKE_CASE` (ej. `MAX_CONSUMIDOR_FINAL_AMOUNT = 50.00`).

---

## 5. Control de Versiones (Git)

* **Convención de Commits (Conventional Commits):**
  * `feat:` Nueva funcionalidad para el usuario.
  * `fix:` Corrección de un defecto o error.
  * `refactor:` Mejora interna de código sin cambio de comportamiento.
  * `test:` Adición o corrección de pruebas unitarias/integración.
  * `docs:` Cambios exclusivamente en documentación.
  * `chore:` Mantenimiento de dependencias o configuraciones.
* Todo commit debe pasar automáticamente las verificaciones del hook de pre-commit (`npm run type-check` y `npm run lint`).
