# Módulo 05: Punto de Venta y Control de Cajas (`pos`)

> **Módulo:** `pos`  
> **Estado:** Especificación Técnica y Plan de Implementación Aprobado  
> **Dependencias:** `catalog` (M01), `stakeholders` (M02), `inventory` (M03), `billing-sri` (M04)

---

## 1. Objetivo y Alcance

### 1.1. Objetivo
Brindar una interfaz de mostrador ultrarrápida, ergonómica y orientada a teclado y lector de código de barras, capaz de despachar ventas en menos de 5 segundos, soportar pagos mixtos y auditar de forma estricta el flujo de efectivo mediante **arqueos y cierres ciegos de caja**.

### 1.2. Alcance
* Control de turnos de caja: Apertura con fondo inicial de cambio, movimientos menores (egresos/ingresos extraordinarios) y **Cierre Ciego de Caja** con reporte de sobrantes o faltantes.
* Carrito de compras de mostrador optimizado para atajos de teclado (F1..F12) y escaneo continuo por lector óptico de código de barras.
* Soporte de pagos múltiples y mixtos por venta (Efectivo, Transferencia DeUna/Bancaria, Tarjetas, Crédito de librería).
* Impresión de tickets térmicos estándar (formatos ESC/POS de 80mm y 58mm).
* Orquestación atómica: Cobrar $\rightarrow$ Descontar Kardex $\rightarrow$ Generar Factura en Cola SRI $\rightarrow$ Imprimir comprobante.

### 1.3. Exclusiones
* No gestiona el abastecimiento ni compras a distribuidores (responsabilidad del Módulo 07: `purchasing`).

---

## 2. Modelo del Dominio e Invariantes

### 2.1. Invariantes de Caja y Venta
1. **Obligatoriedad de Caja Abierta:** Ningún usuario puede registrar una venta sin tener un turno de caja activo asignado a su usuario y terminal.
2. **Cierre Ciego de Caja:** El cajero declara el dinero físico contado en su gaveta sin que el sistema le muestre el total esperado del sistema. El sistema calcula y graba la diferencia (`discrepancy_cents = declared_cents - expected_cents`).
3. **Comprobación de Pagos:** La suma de todos los pagos registrados en una venta debe ser matemáticamente mayor o igual que el monto total de la venta (`sum(payments) >= total_amount`). Si es mayor en efectivo, se calcula el cambio o vuelto exacto.
4. **Verificación de Stock en Tiempo Real:** El POS valida existencias físicas antes de confirmar la venta, bloqueando la confirmación si algún artículo se agotó.

---

## 3. Diseño de Persistencia (PostgreSQL)

```sql
CREATE TYPE cash_session_status_enum AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE payment_method_enum AS ENUM (
    'CASH', 
    'BANK_TRANSFER_DEUNA', 
    'DEBIT_CARD', 
    'CREDIT_CARD', 
    'STORE_CREDIT'
);

-- Sesiones y Turnos de Caja
CREATE TABLE cash_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    terminal_code VARCHAR(50) NOT NULL,
    opening_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closing_time TIMESTAMP WITH TIME ZONE,
    initial_float_cents INTEGER NOT NULL,    -- Fondo de sencillo
    declared_cash_cents INTEGER,             -- Declarado por cajero en cierre ciego
    expected_cash_cents INTEGER,             -- Calculado por sistema
    discrepancy_cents INTEGER,               -- Sobrante (+) o Faltante (-)
    status cash_session_status_enum DEFAULT 'OPEN' NOT NULL,
    closing_notes TEXT
);

-- Órdenes de Venta
CREATE TABLE sale_orders (
    id UUID PRIMARY KEY,
    sequential_code VARCHAR(50) NOT NULL UNIQUE,
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    subtotal_0_cents INTEGER NOT NULL,
    subtotal_15_cents INTEGER NOT NULL,
    discount_cents INTEGER DEFAULT 0 NOT NULL,
    iva_cents INTEGER NOT NULL,
    total_amount_cents INTEGER NOT NULL,
    change_cents INTEGER DEFAULT 0 NOT NULL, -- Vuelto entregado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Ítems de la Venta
CREATE TABLE sale_order_items (
    id UUID PRIMARY KEY,
    sale_order_id UUID NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    presentation_id UUID NOT NULL REFERENCES product_presentations(id),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    discount_cents INTEGER DEFAULT 0 NOT NULL,
    tax_rate VARCHAR(20) NOT NULL,
    total_cents INTEGER NOT NULL
);

-- Pagos asociados a la venta (Soporte de pagos mixtos)
CREATE TABLE sale_payments (
    id UUID PRIMARY KEY,
    sale_order_id UUID NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
    payment_method payment_method_enum NOT NULL,
    amount_cents INTEGER NOT NULL,
    reference_code VARCHAR(100), -- Nro. de comprobante DeUna o lote de tarjeta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 4. Casos de Uso (Application Layer)

1. **`OpenCashSessionUseCase`**:
   - Valida que el usuario no tenga otra caja abierta simultáneamente.
   - Registra el monto inicial de sencillo en caja.
2. **`ProcessSaleCheckoutUseCase`**:
   - Inicia transacción en base de datos.
   - Descuenta unidades en Kardex llamando a `inventory.recordSaleExit()`.
   - Si el total supera $50 USD y el cliente es Consumidor Final, aborta con error fiscal.
   - Registra la venta y los pagos.
   - Encola la factura electrónica en `billing-sri.sri_outbox_queue`.
   - Genera los datos para impresión inmediata del ticket térmico.
3. **`CloseCashSessionUseCase`**:
   - Recibe la declaración ciega de billetes y monedas.
   - Calcula el total acumulado en efectivo del sistema.
   - Guarda el cierre con su respectivo sobrante o faltante para auditoría.

---

## 5. Criterios de Aceptación (Definition of Done)

- [ ] Un cajero puede añadir 10 artículos con lector de código de barras y cobrar con vuelto en menos de 5 segundos.
- [ ] Soporte probado de pago mixto (ej. $10 en efectivo y $15 con transferencia DeUna).
- [ ] Cierre ciego probado: el sistema detecta diferencias de centavos sin mostrar cifras previas al cajero.
- [ ] Generación de comandos ESC/POS para impresoras térmicas de 80mm y 58mm.

---

## 6. Plan de Implementación Paso a Paso

* [ ] **Tarea 5.1:** Crear esquemas Drizzle para `cash_sessions`, `sale_orders`, `sale_order_items` y `sale_payments`.
* [ ] **Tarea 5.2:** Implementar `OpenCashSessionUseCase` y `CloseCashSessionUseCase` con cálculo de arqueo ciego.
* [ ] **Tarea 5.3:** Implementar `ProcessSaleCheckoutUseCase` orquestando Kardex, venta y cola SRI en una sola transacción ACID.
* [ ] **Tarea 5.4:** Crear componente de generación de tickets ESC/POS (`ticket-printer.ts`).
* [ ] **Tarea 5.5:** Construir interfaz de POS con atajos de teclado y escaneo continuo.
