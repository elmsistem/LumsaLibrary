# Módulo 01: Catálogo, Productos y Fraccionamiento (`catalog`)

> **Módulo:** `catalog`  
> **Estado:** Especificación Técnica y Plan de Implementación Aprobado  
> **Dependencias:** `core-infrastructure` (Módulo 00)

---

## 1. Objetivo y Alcance

### 1.1. Objetivo
Gestionar el catálogo unificado de artículos de papelería, útiles escolares, suministros de oficina, textos didácticos y servicios auxiliares, permitiendo la venta bimodal (minorista/mayorista) mediante un sistema flexible de **fraccionamiento de unidades y presentaciones comerciales**.

### 1.2. Alcance
* Catálogo de productos base con atributos: SKU interno, código de barras principal, marca, categoría, unidad mínima indivisible.
* Presentaciones comerciales múltiples por producto (Unidad, Docena, Paquete, Caja, Resma, Rollo, Pliego) con factores de conversión exactos.
* Esquema impositivo ecuatoriano por producto: IVA 0% (libros, cuadernos, material exento), IVA 15% (suministros gravados), No Objeto y Exento.
* Soporte de **Servicios de Papelería** (`is_service = true`), tales como fotocopias, impresiones, anillados y plastificados (se cobran en caja sin restar inventario físico).
* Búsqueda fonética ultrarrápida (índice trigram `pg_trgm`) para artículos pequeños que se venden sueltos sin código de barras.

### 1.3. Exclusiones
* No calcula stock actual ni costos contables (responsabilidad del Módulo 03: `inventory`).
* No calcula totales de venta ni facturación fiscal (responsabilidad de Módulos 04 y 05).

---

## 2. Modelo del Dominio e Invariantes

### 2.1. Invariantes del Negocio
1. **Unicidad de SKU y Códigos de Barras:** No pueden existir dos productos o presentaciones activas con el mismo código de barras o SKU en el sistema.
2. **Factor de Conversión Estricto:** Toda presentación debe tener un `conversion_factor >= 1.0`. La presentación base ("Unidad") siempre tiene `conversion_factor = 1.0`.
3. **Monotonía de Precios:** El precio mayorista de una presentación debe ser matemáticamente menor o igual que su precio minorista (`wholesale_price <= retail_price`).
4. **Servicios sin Kardex:** Si `is_service = true`, el producto no puede tener presentaciones fraccionables ni alertas de stock mínimo.

---

## 3. Diseño de Persistencia (PostgreSQL)

```sql
-- Categorías de papelería
CREATE TABLE categories (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Marcas (Norma, Bic, Faber-Castell, Artesco, Pelikan, etc.)
CREATE TABLE brands (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Producto base
CREATE TYPE tax_rate_enum AS ENUM ('IVA_0', 'IVA_15', 'NO_OBJETO', 'EXENTO');
CREATE TYPE unit_type_enum AS ENUM ('UNIDAD', 'PLIEGO', 'METRO', 'JUEGO', 'SERVICIO');

CREATE TABLE products (
    id UUID PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID NOT NULL REFERENCES categories(id),
    brand_id UUID REFERENCES brands(id),
    tax_rate tax_rate_enum DEFAULT 'IVA_15' NOT NULL,
    min_unit unit_type_enum DEFAULT 'UNIDAD' NOT NULL,
    is_service BOOLEAN DEFAULT FALSE NOT NULL,
    min_stock_alert NUMERIC(10, 2) DEFAULT 5.0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índice trigram para búsqueda en mostrador de productos sin código de barras
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_barcode ON products(barcode);

-- Presentaciones comerciales (Fraccionamiento)
CREATE TABLE product_presentations (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- "Unidad", "Docena", "Caja x 50", "Resma x 500"
    conversion_factor NUMERIC(10, 4) NOT NULL CHECK (conversion_factor >= 1.0),
    barcode VARCHAR(100) UNIQUE, -- Código de barras propio de la caja si aplica
    retail_price_cents INTEGER NOT NULL CHECK (retail_price_cents >= 0),
    wholesale_price_cents INTEGER NOT NULL CHECK (wholesale_price_cents >= 0),
    min_wholesale_quantity INTEGER DEFAULT 1 NOT NULL,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_prices CHECK (wholesale_price_cents <= retail_price_cents)
);

CREATE INDEX idx_presentations_product ON product_presentations(product_id);
CREATE INDEX idx_presentations_barcode ON product_presentations(barcode);
```

---

## 4. Casos de Uso (Application Layer)

1. **`CreateProductUseCase`**:
   - Valida que SKU y código de barras no existan.
   - Crea el producto y automáticamente su presentación base por defecto (*"Unidad"*, factor 1.0).
2. **`AddPresentationUseCase`**:
   - Añade una presentación adicional (ej. *"Caja x 12"*, factor 12.0) con sus precios minorista y mayorista.
3. **`SearchProductsUseCase`**:
   - Búsqueda simultánea: por coincidencia exacta de código de barras (lector óptico) o por similitud de texto difuso con `pg_trgm` (ej: el cajero escribe "cartul irs roj" y encuentra "Cartulina Iris Roja Pliego").
4. **`GenerateBarcodeLabelUseCase`**:
   - Genera etiquetas adhesivas en formato PDF o comandos ZPL/TSPL para impresoras térmicas (Zebra, Xprinter) con código de barras Code 128 o QR para artículos sueltos sin código de fábrica (pliegos, borradores, carpetas).

---

## 5. API Pública (`public-api.ts`)

```typescript
export interface CatalogModule {
  getProductById(id: string): Promise<Product | null>;
  getPresentationById(id: string): Promise<ProductPresentation | null>;
  findProductByBarcode(barcode: string): Promise<ProductWithPresentations | null>;
  searchProducts(query: string, limit?: number): Promise<ProductSearchResult[]>;
  generateBarcodeLabels(presentationId: string, quantity: number): Promise<Buffer>;
}
```

---

## 6. Criterios de Aceptación (Definition of Done)

- [ ] Un producto puede venderse en 3 presentaciones distintas (Unidad, Docena, Caja) vinculadas al mismo ID base.
- [ ] La búsqueda difusa responde en menos de 50ms para un catálogo de 10,000 productos.
- [ ] No es posible registrar una presentación con precio mayorista superior al minorista.
- [ ] Generación e impresión de etiquetas con código de barras Code 128 legible por lectores láser para artículos sueltos.
- [ ] Pruebas unitarias completas de la entidad `Product` y `ProductPresentation`.

---

## 7. Plan de Implementación Paso a Paso

* [ ] **Tarea 1.1:** Definir esquemas Drizzle de `categories`, `brands`, `products` y `product_presentations`.
* [ ] **Tarea 1.2:** Crear entidades ricas de Dominio `Product` y `ProductPresentation` con validaciones de invariantes.
* [ ] **Tarea 1.3:** Implementar `CreateProductUseCase` con creación automática de presentación base.
* [ ] **Tarea 1.4:** Implementar `AddPresentationUseCase`.
* [ ] **Tarea 1.5:** Implementar `SearchProductsUseCase` con soporte de lector de barras e índice trigram.
* [ ] **Tarea 1.6:** Implementar generador de etiquetas adhesivas de código de barras (`barcode-label.generator.ts`).
* [ ] **Tarea 1.7:** Escribir suite de pruebas unitarias (`catalog.spec.ts`).
