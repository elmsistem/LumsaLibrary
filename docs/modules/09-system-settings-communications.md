# Módulo 09: Configuración de Empresa, Respaldos y Comunicaciones (`system-settings-communications`)

> **Módulo:** `system-settings-communications`  
> **Estado:** Especificación Técnica y Plan de Implementación Aprobado  
> **Dependencias:** `core-infrastructure` (M00)

---

## 1. Objetivo y Alcance

### 1.1. Objetivo
Centralizar la identidad institucional de la empresa, gestionar los parámetros tributarios y de hardware, garantizar la supervivencia de los datos del ERP durante 20+ años mediante **estrategias automatizadas de copias de seguridad (Backups)** y habilitar la comunicación omnicanal con clientes mediante **Correo Electrónico Transaccional y WhatsApp**.

### 1.2. Alcance
* **Configuración Institucional y Fiscal:** Razón social, nombre comercial, RUC, logotipo oficial en alta resolución, dirección matriz y sucursales.
* **Puntos de Emisión y Cajas Físicas:** Parametrización de terminales, series del SRI (`estab-ptoEmi`), pie de página y políticas de cambio en tickets térmicos.
* **Bóveda de Seguridad para Certificado Digital (.p12):** Almacenamiento seguro y cifrado de la firma electrónica con monitor de fecha de caducidad (alertas 30, 15 y 5 días antes de expirar).
* **Sistema Automatizado de Copias de Seguridad (Disaster Recovery):**
  * Respaldos programados de base de datos PostgreSQL (`pg_dump`) comprimidos y cifrados con AES-256.
  * Estrategia de retención 7-4-12 (7 diarios, 4 semanales, 12 mensuales).
  * Doble destino: Disco local seguro + Almacenamiento externo en la nube (Cloudflare R2, Google Cloud Storage o S3).
* **Motor Omnicanal de Comunicaciones:**
  * **Correo Electrónico (SMTP / Resend):** Despacho automático de facturas electrónicas (XML + RIDE PDF) y proformas.
  * **WhatsApp (Cloud API de Meta / Webhooks):** Envío automático de facturas digitales y cotizaciones interactivas de listas de útiles a los padres de familia.
* **Control de Acceso Basado en Roles (RBAC) y Seguridad:**
  * Roles: `ADMIN` (acceso y reportes totales), `SUPERVISOR` (autorizaciones especiales), `CASHIER` (caja, cobro y cierre ciego; sin acceso a costos PMP), `WAREHOUSE` (ingreso de compras y stock).
  * Código PIN rápido de 4 dígitos para que un supervisor autorice descuentos o anulaciones directamente en la pantalla del cajero.

---

## 2. Diseño de Persistencia (PostgreSQL)

```sql
CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'SUPERVISOR', 'CASHIER', 'WAREHOUSE');

-- Usuarios y Seguridad
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    supervisor_pin_hash VARCHAR(255), -- Hash del PIN de 4 dígitos para autorizaciones en mostrador
    role user_role_enum DEFAULT 'CASHIER' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Configuración General de la Empresa
CREATE TABLE company_settings (
    id UUID PRIMARY KEY,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255) NOT NULL,
    ruc VARCHAR(13) NOT NULL UNIQUE,
    main_address TEXT NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    ticket_footer_message TEXT DEFAULT '¡Gracias por su compra! Cambios válidos dentro de las 48 horas con este ticket.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Puntos de Emisión Autorizados por el SRI
CREATE TABLE emission_points (
    id UUID PRIMARY KEY,
    establishment_code VARCHAR(3) NOT NULL, -- Ej: '001'
    emission_point_code VARCHAR(3) NOT NULL, -- Ej: '001' para Caja 1, '002' para Caja 2
    name VARCHAR(100) NOT NULL,             -- Ej: "Caja Principal - Mostrador 1"
    assigned_terminal_mac VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_estab_pto UNIQUE (establishment_code, emission_point_code)
);

-- Registro de Copias de Seguridad (Backups)
CREATE TYPE backup_status_enum AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE backup_storage_enum AS ENUM ('LOCAL_ONLY', 'CLOUD_SYNCED');

CREATE TABLE backup_logs (
    id UUID PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_type backup_storage_enum DEFAULT 'CLOUD_SYNCED' NOT NULL,
    cloud_url TEXT,
    status backup_status_enum NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Configuración de Canales de Notificación (WhatsApp y SMTP)
CREATE TABLE communication_settings (
    id UUID PRIMARY KEY,
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_password_hash TEXT,
    smtp_from_email VARCHAR(255),
    whatsapp_provider VARCHAR(50) DEFAULT 'META_CLOUD_API', -- O 'EVOLUTION_API'
    whatsapp_api_url TEXT,
    whatsapp_api_token TEXT,
    whatsapp_phone_number_id VARCHAR(100),
    auto_send_invoices_whatsapp BOOLEAN DEFAULT TRUE NOT NULL,
    auto_send_invoices_email BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 3. Especificación Técnica de Copias de Seguridad (Backups)

### 3.1. Procedimiento de Ejecución Automatizado
1. **Extracción:** Se ejecuta `pg_dump` con formato custom binario (`-Fc`) para compresión máxima.
2. **Cifrado en Tránsito y Reposo:** El archivo generado se encripta mediante AES-256-CBC con clave simétrica maestra definida en el entorno.
3. **Sincronización Cloud:** Se sube el archivo cifrado a un bucket compatible con S3 (ej. Cloudflare R2 con costo de egreso $0).
4. **Verificación de Integridad:** Se valida la suma de comprobación SHA-256 entre el archivo local y el remoto.
5. **Rotación:** Se eliminan los respaldos locales y remotos que excedan la política de retención (7 días).

---

## 4. Especificación Técnica de Comunicaciones (WhatsApp & Email)

### 4.1. Despacho de Factura Electrónica vía WhatsApp
Cuando el SRI autoriza una factura:
1. El sistema recupera el número celular del cliente (normalizado a formato E.164, ej: `+593991234567`).
2. Si el cliente tiene habilitado WhatsApp, despacha una plantilla interactiva:
   > *"Estimado(a) {{cliente}}, LumsaLibrary le agradece por su compra. Adjuntamos su factura electrónica Nro. {{secuencial}} por el valor de ${{monto}}. Puede descargar su comprobante legal aquí: {{enlace_ride}}"*
3. El enlace permite descargar directamente el RIDE en PDF y el XML oficial del SRI.

---

## 5. Control de Autorizaciones de Supervisor (PIN en POS)

Para operaciones restringidas en mostrador:
* **Operaciones que exigen PIN:** Descuentos mayores al 5%, anulación de ítems ya confirmados, cancelaciones de venta o apertura manual de gaveta de dinero sin venta.
* **Mecanismo:** Un modal en pantalla solicita el PIN de 4 dígitos. El backend valida el hash contra usuarios con rol `SUPERVISOR` o `ADMIN` y registra el ID del supervisor autorizante en la auditoría de la venta.

---

## 6. Plan de Implementación Paso a Paso

* [ ] **Tarea 9.1:** Crear esquemas Drizzle para `users`, `company_settings`, `emission_points`, `backup_logs` y `communication_settings`.
* [ ] **Tarea 9.2:** Implementar servicio de autenticación y verificación de PIN de supervisor (`supervisor-auth.service.ts`).
* [ ] **Tarea 9.3:** Desarrollar el script de respaldo automatizado de base de datos con cifrado AES-256 (`backup-runner.ts`).
* [ ] **Tarea 9.4:** Implementar adaptador de correo SMTP transaccional (`email-dispatcher.ts`).
* [ ] **Tarea 9.5:** Implementar adaptador para mensajería de facturas y proformas por WhatsApp (`whatsapp-dispatcher.ts`).
* [ ] **Tarea 9.6:** Construir pantalla de administración para configuración de empresa, puntos de emisión y gestión de respaldos.
