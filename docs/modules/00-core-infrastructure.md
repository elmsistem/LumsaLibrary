# Módulo 00: Fundaciones e Infraestructura Base (`core-infrastructure`)

> **Módulo:** `core-infrastructure`  
> **Estado:** Especificación Técnica y Plan de Implementación Aprobado  
> **Dependencias:** Ninguna (Módulo Raíz)

---

## 1. Objetivo y Alcance

### 1.1. Objetivo
Proveer la infraestructura compartida, el motor de base de datos relacional, el sistema de migraciones, los tipos fundamentales de dominio (dinero de alta precisión, identificadores universales) y los contratos base de auditoría que gobernarán todos los módulos del ERP durante los próximos 20 años.

### 1.2. Alcance
* Configuración del motor PostgreSQL (v16+) y el Object-Relational Mapping (ORM) con soporte de migraciones inmutables (Drizzle ORM / Prisma).
* Implementación del Value Object `Money` y aritmética de precisión fija en centavos de dólar estadounidense (USD).
* Generador de identificadores universales ordenables temporalmente (UUIDv7).
* Capa base de auditoría inmutable (`created_at`, `updated_at`, `created_by_user_id`).
* Manejador estándar de errores de dominio (`DomainError`, `Result<T, E>`).

### 1.3. Exclusiones
* No implementa tablas de negocio específicas (productos, ventas, clientes).
* No implementa autenticación ni gestión de roles (se conecta mediante el identificador de usuario de la sesión activa).

---

## 2. Modelo del Dominio e Invariantes

### 2.1. Invariante Monetaria: Prohibición de Punto Flotante
* **Regla:** Ningún valor monetario se representará como `number` flotante de JavaScript en operaciones de cálculo o almacenamiento.
* **Almacenamiento:** Enteros en centavos (`bigint` o `integer`) o precisión decimal fija en base de datos (`numeric(12, 2)` para precios finales, `numeric(14, 4)` para costos unitarios promedio del Kardex).

### 2.2. Value Object `Money`
```typescript
export class Money {
  private readonly cents: number; // Centavos enteros

  private constructor(cents: number) {
    if (!Number.isInteger(cents)) {
      throw new Error("El valor monetario en centavos debe ser un entero.");
    }
    this.cents = cents;
  }

  static fromDecimal(amount: number): Money {
    return new Money(Math.round(amount * 100));
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor));
  }

  toDecimal(): number {
    return this.cents / 100;
  }

  toCents(): number {
    return this.cents;
  }
}
```

---

## 3. Diseño de Persistencia (PostgreSQL)

### 3.1. Esquema Base y Extensiones
```sql
-- Extensiones requeridas para UUIDv7 y búsquedas de texto en papelería
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Búsqueda difusa para útiles escolares
```

### 3.2. Tabla de Auditoría Global (`system_audit_logs`)
Registra eventos críticos del sistema (cierres de caja, anulaciones de facturas, ajustes de inventario):
```sql
CREATE TABLE system_audit_logs (
    id UUID PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    user_id UUID,
    payload_before JSONB,
    payload_after JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_entity ON system_audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_created_at ON system_audit_logs(created_at);
```

---

## 4. API Pública y Utilidades Compartidas

El módulo expone a través de `src/modules/core/public-api.ts`:
* `Money`: Value Object para toda transacción financiera.
* `generateUUIDv7()`: Función de generación de UUIDs ordenables por tiempo.
* `DomainError`: Clase abstracta de excepciones del negocio.
* `db`: Instancia singleton de conexión a PostgreSQL.

---

## 5. Criterios de Aceptación (Definition of Done)

- [ ] PostgreSQL configurado y comprobado con conexión local o contenedor.
- [ ] Pruebas unitarias de `Money` verifican que `0.1 + 0.2` resulta exactamente en `0.30` sin artefactos flotantes.
- [ ] Migraciones de base de datos se ejecutan de forma reproducible y reversible.
- [ ] Todas las pruebas de este módulo pasan con `npm run type-check` y `npm run lint`.

---

## 6. Plan de Implementación Paso a Paso

* [ ] **Tarea 0.1:** Instalar y configurar Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `postgres` / `pg`).
* [ ] **Tarea 0.2:** Crear la implementación de `Money` con su suite de pruebas unitarias (`money.vo.spec.ts`).
* [ ] **Tarea 0.3:** Implementar el generador de identificadores UUIDv7.
* [ ] **Tarea 0.4:** Configurar el cliente de conexión a PostgreSQL con variables de entorno validadas con `zod`.
* [ ] **Tarea 0.5:** Crear la tabla `system_audit_logs` y la utilidad de registro de auditoría.
