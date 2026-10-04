import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role_enum", [
  "ADMIN",
  "SUPERVISOR",
  "CASHIER",
  "WAREHOUSE",
]);

export const backupStatusEnum = pgEnum("backup_status_enum", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const backupStorageEnum = pgEnum("backup_storage_enum", [
  "LOCAL_ONLY",
  "CLOUD_SYNCED",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    supervisorPinHash: varchar("supervisor_pin_hash", { length: 255 }), // Hash del PIN de 4 dígitos para autorizaciones en mostrador
    role: userRoleEnum("role").default("CASHIER").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_users_role").on(table.role),
    index("idx_users_username").on(table.username),
  ]
);

export const companySettings = pgTable(
  "company_settings",
  {
    id: uuid("id").primaryKey(),
    legalName: varchar("legal_name", { length: 255 }).notNull(),
    tradeName: varchar("trade_name", { length: 255 }).notNull(),
    ruc: varchar("ruc", { length: 13 }).notNull().unique(),
    mainAddress: text("main_address").notNull(),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    logoUrl: text("logo_url"),
    ticketFooterMessage: text("ticket_footer_message").default(
      "¡Gracias por su compra! Cambios válidos dentro de las 48 horas con este ticket."
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export const emissionPoints = pgTable(
  "emission_points",
  {
    id: uuid("id").primaryKey(),
    establishmentCode: varchar("establishment_code", { length: 3 }).notNull(), // Ej: '001'
    emissionPointCode: varchar("emission_point_code", { length: 3 }).notNull(), // Ej: '001', '002'
    name: varchar("name", { length: 100 }).notNull(), // Ej: "Caja 1 - Mostrador Principal"
    assignedTerminalMac: varchar("assigned_terminal_mac", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_estab_pto").on(table.establishmentCode, table.emissionPointCode),
  ]
);

export const backupLogs = pgTable(
  "backup_logs",
  {
    id: uuid("id").primaryKey(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    storageType: backupStorageEnum("storage_type").default("CLOUD_SYNCED").notNull(),
    cloudUrl: text("cloud_url"),
    status: backupStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_backup_logs_created").on(table.createdAt)]
);

export const communicationSettings = pgTable(
  "communication_settings",
  {
    id: uuid("id").primaryKey(),
    smtpHost: varchar("smtp_host", { length: 255 }),
    smtpPort: integer("smtp_port").default(587),
    smtpUser: varchar("smtp_user", { length: 255 }),
    smtpPasswordHash: text("smtp_password_hash"),
    smtpFromEmail: varchar("smtp_from_email", { length: 255 }),
    whatsappProvider: varchar("whatsapp_provider", { length: 50 }).default("META_CLOUD_API"),
    whatsappApiUrl: text("whatsapp_api_url"),
    whatsappApiToken: text("whatsapp_api_token"),
    whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 100 }),
    autoSendInvoicesWhatsapp: boolean("auto_send_invoices_whatsapp").default(true).notNull(),
    autoSendInvoicesEmail: boolean("auto_send_invoices_email").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type CompanySettingsRow = typeof companySettings.$inferSelect;
export type NewCompanySettingsRow = typeof companySettings.$inferInsert;
export type EmissionPointRow = typeof emissionPoints.$inferSelect;
export type NewEmissionPointRow = typeof emissionPoints.$inferInsert;
export type BackupLogRow = typeof backupLogs.$inferSelect;
export type NewBackupLogRow = typeof backupLogs.$inferInsert;
export type CommunicationSettingsRow = typeof communicationSettings.$inferSelect;
export type NewCommunicationSettingsRow = typeof communicationSettings.$inferInsert;
