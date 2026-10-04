// --- Domain Entities & Types ---
export {
  User,
  type UserRole,
  type CreateUserProps,
} from "./domain/entities/user.entity";
export {
  CompanySettings,
  type CreateCompanySettingsProps,
} from "./domain/entities/company-settings.entity";
export {
  EmissionPoint,
  type CreateEmissionPointProps,
} from "./domain/entities/emission-point.entity";
export {
  BackupLog,
  type BackupStatus,
  type BackupStorageType,
  type CreateBackupLogProps,
} from "./domain/entities/backup-log.entity";

// --- Domain Services ---
export { SupervisorAuthService } from "./domain/services/supervisor-auth.service";
export {
  WhatsAppDispatcherService,
  type InvoiceWhatsAppPayload,
  type SchoolListWhatsAppPayload,
} from "./domain/services/whatsapp-dispatcher.service";
export {
  EmailDispatcherService,
  type InvoiceEmailPayload,
  type FormattedEmailMessage,
  type InvoiceEmailAttachment,
} from "./domain/services/email-dispatcher.service";
export {
  BackupRunnerService,
  type BackupExecutionResult,
} from "./domain/services/backup-runner.service";

// --- Domain Repositories ---
export { type SystemSettingsRepository } from "./domain/repositories/system-settings.repository";

// --- Application Use Cases ---
export {
  AuthorizeSupervisorPinUseCase,
  type AuthorizeSupervisorPinInput,
  type AuthorizeSupervisorPinResult,
} from "./application/use-cases/authorize-supervisor-pin.use-case";

export {
  RunDatabaseBackupUseCase,
  type RunDatabaseBackupInput,
  type RunDatabaseBackupResult,
} from "./application/use-cases/run-database-backup.use-case";

export {
  DispatchInvoiceNotificationUseCase,
  type DispatchInvoiceNotificationInput,
  type DispatchInvoiceNotificationResult,
} from "./application/use-cases/dispatch-invoice-notification.use-case";

// --- Infrastructure ---
export {
  users,
  companySettings,
  emissionPoints,
  backupLogs,
  communicationSettings,
  userRoleEnum,
  backupStatusEnum,
  backupStorageEnum,
  type UserRow,
  type NewUserRow,
  type CompanySettingsRow,
  type NewCompanySettingsRow,
  type EmissionPointRow,
  type NewEmissionPointRow,
  type BackupLogRow,
  type NewBackupLogRow,
  type CommunicationSettingsRow,
  type NewCommunicationSettingsRow,
} from "./infrastructure/database/schema/system-settings.schema";

export { DrizzleSystemSettingsRepository } from "./infrastructure/persistence/drizzle-system-settings.repository";
