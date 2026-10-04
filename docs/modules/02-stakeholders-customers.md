# Módulo 02: Clientes y Proveedores (`stakeholders`)

> **Módulo:** `stakeholders`  
> **Estado:** Especificación Técnica y Plan de Implementación Aprobado  
> **Dependencias:** `core-infrastructure` (Módulo 00)

---

## 1. Objetivo y Alcance

### 1.1. Objetivo
Gestionar el directorio de actores comerciales (clientes y proveedores) asegurando el cumplimiento riguroso de la legislación tributaria ecuatoriana en la identificación fiscal (Cédula, RUC, Pasaporte y Consumidor Final) y administrando condiciones de crédito para clientes recurrentes y convenios con escuelas.

### 1.2. Alcance
* Validador oficial algorítmico de **Cédula de Identidad de Ecuador** (Módulo 10).
* Validador oficial de **RUC** para los tres regímenes ecuatorianos:
  1. Persona Natural (10 dígitos + `001`).
  2. Sociedad Privada o Extranjera sin cédula (tercer dígito `9`, Módulo 11).
  3. Institución Pública (tercer dígito `6`, Módulo 11).
* Control estricto de la regla fiscal de **Consumidor Final** (límite máximo de $50.00 USD).
* Perfil de clientes con control de crédito (límite de crédito, días de plazo, saldo adeudado).
* Directorio de proveedores para compras y recepción de facturas electrónicas.

### 1.3. Exclusiones
* No emite comprobantes de retención tributaria (responsabilidad del Módulo 04: `billing-sri`).
* No registra pagos de cuentas por cobrar (responsabilidad del Módulo 05: `pos`).

---

## 2. Modelo del Dominio y Algoritmos Ecuatorianos

### 2.1. Algoritmo Oficial de Cédula (Módulo 10)
1. Longitud exacta de 10 dígitos numéricos.
2. Los dos primeros dígitos corresponden a una provincia válida (01 a 24) o código especial (30).
3. El tercer dígito debe ser menor a 6 (`0` a `5`).
4. Coeficientes de ponderación: `[2, 1, 2, 1, 2, 1, 2, 1, 2]`.
5. Si el producto de cada dígito por su coeficiente es $\ge 10$, se le resta $9$.
6. Se suman todos los resultados parciales.
7. La decena superior menos la suma debe ser igual al décimo dígito (o 0 si la suma es múltiplo de 10).

### 2.2. Algoritmo de RUC Sociedad Privada (Módulo 11)
1. Longitud exacta de 13 dígitos numéricos terminados en `001`.
2. El tercer dígito es estrictamente `9`.
3. Coeficientes: `[4, 3, 2, 7, 6, 5, 4, 3, 2]`.
4. El residuo de la suma ponderada dividido para 11 determina el dígito verificador (décimo dígito).

### 2.3. Algoritmo de RUC Institución Pública (Módulo 11)
1. Longitud exacta de 13 dígitos terminados en `0001`.
2. El tercer dígito es estrictamente `6`.
3. Coeficientes: `[3, 2, 7, 6, 5, 4, 3, 2]`.
4. El dígito verificador es el noveno dígito.

---

## 3. Diseño de Persistencia (PostgreSQL)

```sql
CREATE TYPE id_type_enum AS ENUM (
    'CEDULA', 
    'RUC', 
    'PASAPORTE', 
    'CONSUMIDOR_FINAL', 
    'EXTERIOR'
);

CREATE TABLE customers (
    id UUID PRIMARY KEY,
    id_type id_type_enum NOT NULL,
    id_number VARCHAR(20) NOT NULL UNIQUE,
    legal_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    credit_limit_cents INTEGER DEFAULT 0 NOT NULL,
    current_debt_cents INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_debt CHECK (current_debt_cents <= credit_limit_cents OR credit_limit_cents = 0)
);

CREATE INDEX idx_customers_id_number ON customers(id_number);
CREATE INDEX idx_customers_legal_name ON customers USING gin (legal_name gin_trgm_ops);

-- Proveedores de útiles y papelería (Distribuidoras, editoriales)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY,
    ruc VARCHAR(13) NOT NULL UNIQUE,
    legal_name VARCHAR(255) NOT NULL,
    commercial_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    contact_person VARCHAR(150),
    credit_days INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_suppliers_ruc ON suppliers(ruc);
```

---

## 4. Casos de Uso (Application Layer)

1. **`ValidateAndRegisterCustomerUseCase`**:
   - Ejecuta el algoritmo correspondiente según el tipo de documento.
   - Si es Consumidor Final, asegura el uso de `9999999999999`.
   - Registra o actualiza el cliente sin duplicar registros.
2. **`CheckConsumidorFinalThresholdUseCase`**:
   - Evalúa si el monto total de la venta supera los $50.00 USD. Si es así y el cliente seleccionado es Consumidor Final, lanza una excepción de negocio `ConsumidorFinalExceededError`.
3. **`AuthorizeCreditUseCase`**:
   - Valida si el cliente tiene margen de crédito disponible antes de autorizar una venta fiada.

---

## 5. API Pública (`public-api.ts`)

```typescript
export interface StakeholdersModule {
  validateEcuadorianId(idType: IdType, idNumber: string): { isValid: boolean; error?: string };
  getCustomerById(id: string): Promise<Customer | null>;
  getCustomerByIdNumber(idNumber: string): Promise<Customer | null>;
  getSupplierByRuc(ruc: string): Promise<Supplier | null>;
  assertConsumidorFinalAllowed(totalAmountCents: number, idType: IdType): void;
}
```

---

## 6. Criterios de Aceptación (Definition of Done)

- [ ] Suite de pruebas con al menos 20 cédulas y RUCs reales/oficiales de prueba válidos e inválidos.
- [ ] Rechazo contundente de cédulas con tercer dígito inválido o dígitos verificadores incorrectos.
- [ ] Venta superior a $50.00 USD bloqueada si se intenta facturar a Consumidor Final.

---

## 7. Plan de Implementación Paso a Paso

* [ ] **Tarea 2.1:** Crear el Value Object `EcuadorianIdentification` en TypeScript puro con pruebas unitarias (`ecuadorian-id.spec.ts`).
* [ ] **Tarea 2.2:** Definir esquemas Drizzle para tablas `customers` y `suppliers`.
* [ ] **Tarea 2.3:** Implementar el caso de uso `RegisterCustomerUseCase`.
* [ ] **Tarea 2.4:** Implementar la regla de negocio `ConsumidorFinalRule`.
* [ ] **Tarea 2.5:** Crear pruebas de integración con base de datos.
