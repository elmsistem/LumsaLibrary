// --- Value Objects & Domain ---
export { Money } from "./domain/value-objects/money.vo";
export { generateUUIDv7, isValidUUID, assertUUID } from "./domain/value-objects/uuid.vo";
export { DomainError, ValidationError } from "./domain/errors/domain-error";

// --- Database & Infrastructure ---
export { getDb, getDbPool, schema, type AppDatabase } from "./infrastructure/database/client";
export {
  systemAuditLogs,
  type SystemAuditLog,
  type NewSystemAuditLog,
} from "./infrastructure/database/schema/audit.schema";
export { getEnv, type Env } from "./infrastructure/env/env.schema";
