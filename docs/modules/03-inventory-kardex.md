# Módulo 03: Inventario y Kardex Inmutable (`inventory`)

> **Módulo:** `inventory`  
> **Estado:** Especificación Técnica y Plan de Implementación Aprobado  
> **Dependencias:** `core-infrastructure` (Módulo 00), `catalog` (Módulo 01)

---

## 1. Objetivo y Alcance

### 1.1. Objetivo
Garantizar la trazabilidad absoluta, auditoría histórica y valoración contable del stock físico de la librería y papelería mediante un **Kardex inmutable tipo Libro Mayor (Ledger)** basado en el método oficial de **Precio Medio Ponderado (PMP)** exigido en Ecuador.

### 1.2. Alcance
* Registro inmutable (Append-Only) de cada movimiento físico de entrada, salida o ajuste.
* Cálculo matemático exacto del Costo Promedio Ponderado tras cada compra.
* Soporte multi-almacén (Local Principal/Matriz, Bodega de Reserva, Sucursal).
* Control de concurrencia y prevención estricta de stock negativo ante ventas simultáneas en mostrador.
* Ajustes de inventario por toma física periódica y registro de mermas (útiles dañados o abiertos en mostrador).

### 1.3. Exclusiones
* No define los precios de venta al público (responsabilidad del Módulo 01: `catalog`).
* No gestiona pagos ni facturación electrónica (Módulos 04 y 05).

---

## 2. Modelo del Dominio y Reglas Matemáticas

### 2.1. Invariantes del Kardex
1. **Inmutabilidad Absoluta:** Ningún registro de la tabla `inventory_movements` puede ser actualizado (`UPDATE`) ni eliminado (`DELETE`). Las correcciones se realizan exclusivamente mediante un movimiento inverso compensatorio.
2. **Unidad Mínima como Estándar:** Todos los movimientos de Kardex se registran en la **unidad mínima indivisible** del producto (definida en `products.min_unit`), independientemente de si la venta o compra se realizó en cajas, docenas o resmas.
3. **Fórmula Oficial del PMP en Compras:**

$$\text{Costo Promedio Ponderado Nuevo} = \frac{(S_{\text{ant}} \times C_{\text{ant}}) + (Q_{\text{compra}} \times C_{\text{compra}})}{S_{\text{ant}} + Q_{\text{compra}}}$$

* Las ventas **no modifican el costo unitario promedio**, solo consumen unidades valoradas al PMP vigente al momento de la venta.

---

## 3. Diseño de Persistencia (PostgreSQL)

```sql
CREATE TABLE warehouses (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TYPE inventory_movement_type_enum AS ENUM (
    'PURCHASE_ENTRY',
    'SALE_EXIT',
    'INTERNAL_DAMAGE',
    'PHYSICAL_COUNT_ADJUSTMENT',
    'CUSTOMER_RETURN',
    'SUPPLIER_RETURN',
    'WAREHOUSE_TRANSFER'
);

-- Libro Mayor Inmutable de Movimientos de Inventario (Kardex)
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    movement_type inventory_movement_type_enum NOT NULL,
    quantity_units NUMERIC(12, 4) NOT NULL, -- Positivo para entradas, negativo para salidas
    unit_cost_cents INTEGER NOT NULL,       -- Costo de la operación en centavos
    average_cost_cents INTEGER NOT NULL,    -- PMP resultante en centavos
    balance_units NUMERIC(12, 4) NOT NULL,  -- Stock total resultante en ese almacén
    reference_id UUID,                      -- ID de la factura, venta o compra que originó el cambio
    reference_code VARCHAR(100),            -- Nro. Factura proveedor o ticket POS
    notes TEXT,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_kardex_product_wh ON inventory_movements(product_id, warehouse_id);
CREATE INDEX idx_kardex_created_at ON inventory_movements(created_at);

-- Snapshot de Balance Actual (Caché de alto rendimiento transaccional)
CREATE TABLE inventory_balances (
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    current_stock_units NUMERIC(12, 4) DEFAULT 0.0 NOT NULL,
    current_pmp_cents INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (warehouse_id, product_id),
    CONSTRAINT chk_non_negative_stock CHECK (current_stock_units >= 0)
);
```

---

## 4. Casos de Uso (Application Layer)

1. **`RecordPurchaseMovementUseCase`**:
   - Lee el balance actual del producto en el almacén.
   - Aplica la fórmula del PMP para calcular el nuevo costo unitario promedio.
   - Inserta el movimiento inmutable en `inventory_movements`.
   - Actualiza el snapshot en `inventory_balances`.
2. **`RecordSaleExitUseCase`**:
   - Bloquea la fila del balance (`SELECT ... FOR UPDATE`) para evitar condiciones de carrera.
   - Verifica que `current_stock_units >= requested_units`.
   - Si no hay stock suficiente, lanza `InsufficientStockError` y cancela la transacción.
   - Registra la salida en Kardex valorada al PMP actual.
3. **`GetProductKardexUseCase`**:
   - Devuelve la sábana histórica completa de movimientos con entradas, salidas y saldos para inspección fiscal o auditoría interna.

---

## 5. API Pública (`public-api.ts`)

```typescript
export interface InventoryModule {
  getCurrentStock(productId: string, warehouseId: string): Promise<number>;
  getCurrentPmp(productId: string, warehouseId: string): Promise<Money>;
  recordSaleExit(params: SaleExitParams): Promise<InventoryMovement>;
  recordPurchaseEntry(params: PurchaseEntryParams): Promise<InventoryMovement>;
  getKardexHistory(productId: string, warehouseId: string, from?: Date, to?: Date): Promise<KardexEntry[]>;
}
```

---

## 6. Criterios de Aceptación (Definition of Done)

- [ ] Simulación de 50 ventas concurrentes sobre el mismo artículo no produce saldo negativo ni descuadres en el saldo de Kardex.
- [ ] El costo PMP coincide con el cálculo matemático exigido por el SRI tras compras sucesivas a costos distintos.
- [ ] No existe ninguna instrucción SQL `UPDATE inventory_movements` en todo el repositorio.

---

## 7. Plan de Implementación Paso a Paso

* [ ] **Tarea 3.1:** Crear esquemas Drizzle para `warehouses`, `inventory_movements` e `inventory_balances`.
* [ ] **Tarea 3.2:** Implementar la calculadora pura de dominio del PMP con pruebas unitarias (`pmp-calculator.spec.ts`).
* [ ] **Tarea 3.3:** Implementar `RecordSaleExitUseCase` con bloqueos pesimistas de PostgreSQL.
* [ ] **Tarea 3.4:** Implementar `RecordPurchaseMovementUseCase`.
* [ ] **Tarea 3.5:** Implementar `GetProductKardexUseCase`.
* [ ] **Tarea 3.6:** Pruebas de estrés y concurrencia sobre stock simultáneo.
