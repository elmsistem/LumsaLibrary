# 02. Principios de Arquitectura y Diseño a 20 Años

> **Estado:** Documento Normativo Obligatorio  
> **Patrón:** Clean Architecture + Modular Monolith + Transactional Outbox

---

## 1. La Regla de Oro: Independencia Tecnológica

> **"El núcleo del negocio no sabe qué framework lo está ejecutando."**

En LumsaLibrary, la lógica de cálculo comercial, el Kardex, las validaciones de Cédula/RUC y las reglas del SRI existen en **TypeScript Puro**, sin importar paquetes de React, Next.js, HTTP ni librerías de base de datos directas en su interior.

```
┌─────────────────────────────────────────────────────────────┐
│ 4. PRESENTACIÓN Y ENTRADA (Next.js App Router, UI, CLI)      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 3. INFRAESTRUCTURA (PostgreSQL, SOAP SRI, SMTP, FS) │   │
│   │   ┌─────────────────────────────────────────────┐   │   │
│   │   │ 2. APLICACIÓN (Casos de Uso, Orquestación)   │   │   │
│   │   │   ┌─────────────────────────────────────┐   │   │   │
│   │   │   │ 1. DOMINIO PURO (Entidades, Reglas) │   │   │   │
│   │   │   └─────────────────────────────────────┘   │   │   │
│   │   └─────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

* Las dependencias solo apuntan **hacia adentro**.
* El Dominio no depende de nada.
* Si en el año 2035 Next.js es reemplazado por otra tecnología de servidor o se añade una terminal POS de escritorio/móvil nativa, **el Dominio y los Casos de Uso se reutilizan al 100% sin modificar una sola línea**.

---

## 2. Monolito Modular (Modular Monolith)

No se implementarán microservicios distribuidos independientes en esta etapa. Todo el sistema reside en una única base de código pero estrictamente encapsulado por módulos:

```
src/modules/
├── catalog/       # Productos, presentaciones, marcas, categorías
├── inventory/     # Kardex, almacenes, lotes, movimientos
├── sales/         # Órdenes de venta, cotizaciones, listas de útiles
├── pos/           # Terminal de caja, arqueos, turnos
├── purchasing/    # Órdenes de compra, importación de facturas de proveedores
├── customers/     # Clientes, validación Cédula/RUC
├── billing-sri/   # Generación XML, firma XAdES-BES, SOAP SRI, RIDE
└── shared/        # Tipos universales, errores del sistema, utilidades matemáticas
```

### Reglas de Interacción entre Módulos:
1. Ningún módulo puede acceder directamente a las tablas o modelos internos de base de datos de otro módulo.
2. Cada módulo expone una **API de Servicio pública** (`public-api.ts`).
3. Para operaciones transaccionales cruzadas (ej. Vender requiere descontar inventario y generar factura), la orquestación se realiza mediante Casos de Uso o Eventos de Dominio.

---

## 3. Inmutabilidad del Inventario (Kardex Append-Only)

> [!CAUTION]
> **REGLA ESTRICTA:** Queda terminantemente prohibido ejecutar sentencias destructivas como `UPDATE productos SET stock = stock - N` sin un registro auditable.

* El inventario opera bajo el principio de **Libro Contable (Ledger)**.
* Toda alteración de stock es un evento inmutable registrado en `inventory_movements`:
  * `id`: Identificador único (UUIDv7).
  * `product_id`: Producto afectado.
  * `presentation_id`: Presentación comercial utilizada.
  * `movement_type`: `PURCHASE_ENTRY` | `SALE_EXIT` | `INTERNAL_DAMAGE` | `PHYSICAL_COUNT_ADJUSTMENT` | `CUSTOMER_RETURN` | `SUPPLIER_RETURN`.
  * `quantity_units`: Cantidad neta en la unidad mínima del producto.
  * `unit_cost`: Costo unitario al momento del movimiento.
  * `resulting_stock`: Stock final después del movimiento.
  * `reference_id`: ID de la venta, compra o ajuste que originó el cambio.
  * `user_id`: Operador responsable.
  * `created_at`: Marca temporal exacta inmutable.
* El stock actual es la suma aritmética del historial o el valor consolidado del último snapshot validado.

---

## 4. Resiliencia de Facturación: Patrón Transactional Outbox

Dado que los servidores del SRI ecuatoriano o el enlace a internet sufren intermitencias regulares en temporadas de alta demanda:

1. **La venta nunca espera al SRI para completarse:**
   * El cajero cobra la venta.
   * La base de datos guarda la venta y el movimiento de Kardex en una única transacción ACID local.
   * En la misma transacción se inserta un registro en la tabla `sri_outbox_queue` con el estado `PENDING_GENERATION`.
   * La caja entrega inmediatamente el comprobante/ticket al cliente con su Clave de Acceso pre-calculada.
2. **Procesamiento en Segundo Plano (Worker):**
   * Un proceso en background toma los registros pendientes de `sri_outbox_queue`.
   * Construye el XML conforme a la ficha técnica del SRI.
   * Aplica la firma electrónica digital (`.p12`).
   * Envía la solicitud al Web Service de Recepción del SRI.
   * Si es recibido, consulta la Autorización.
   * Al autorizarse, genera el RIDE (PDF) y despacha el correo al cliente.
3. **Manejo de Fallas e Idempotencia:**
   * Si el SRI está caído o devuelve error de red, la cola reintenta con retroceso exponencial (*exponential backoff*).
   * La clave de acceso de 49 dígitos es determinista y única: **jamás se duplica una factura en el SRI**.

---

## 5. Integridad Transaccional y Concurrencia

* **Motor de Base de Datos:** PostgreSQL >= 16.
* **Nivel de Aislamiento:** Transacciones críticas (como el cierre de una venta y el Kardex) se ejecutan bajo aislamiento `READ COMMITTED` con bloqueos pesimistas en las filas de stock (`SELECT ... FOR UPDATE`) o verificación optimista para prevenir ventas con stock insuficiente ante múltiples cajas simultáneas.
* **Moneda:** En Ecuador la moneda oficial es el Dólar de los Estados Unidos (USD). Todos los cálculos financieros internos se almacenan como enteros en centavos (`integer` o `bigint`) o tipos numéricos de precisión fija (`numeric(14, 4)` o `numeric(12, 2)`). **Queda prohibido el uso de punto flotante (`float` o `double`) para montos monetarios o impuestos.**

---

## 6. Principio Anti-Mocking (Prohibición de Interfaces Volátiles)

El sistema prohíbe taxativamente la creación de pantallas o vistas con arreglos de datos en memoria (`useState` con listas quemadas) para simular operatividad:
1. Toda pantalla interactiva en el frontend debe conectarse obligatoriamente a la base de datos PostgreSQL mediante Server Actions o endpoints de API que invoquen los Casos de Uso del módulo correspondiente.
2. Si un módulo aún no tiene su capa de persistencia o API completada, **no se debe construir una interfaz simulada**. Debe completarse primero la base de datos y la API.

---

## 7. Gobernanza de Arquitectura y Control de Cambios (Pre-Flight Gate)

Para proteger la visión de 20+ años del ERP contra la prisa o peticiones ambiguas de los usuarios:
1. **Validación Previa Obligatoria:** Todo desarrollador o agente de IA debe validar cualquier requerimiento nuevo contra los principios de arquitectura y la hoja de ruta en `docs/06` y `docs/07`.
2. **Prohibición de Complacencia Ciega:** Si una orden del usuario salta fases, viola la inmutabilidad del Kardex o contradice la normativa ecuatoriana del SRI, el ejecutor debe detenerse y presentar el **Informe de Alerta de Conformidad y Evaluación de Impacto**.
3. **Procedimiento de Modificación:** Ningún cambio que altere el orden de las fases o la arquitectura puede codificarse sin antes registrar formalmente la justificación y actualización del plan en `docs/06-plan-de-implementacion.md` y `docs/07-trazabilidad-y-estado-de-implementacion.md`.

