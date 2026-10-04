import { eq, and, inArray, desc } from "drizzle-orm";
import { AppDatabase } from "@/modules/core/public-api";
import { User, UserRole } from "../../domain/entities/user.entity";
import { CompanySettings } from "../../domain/entities/company-settings.entity";
import { EmissionPoint } from "../../domain/entities/emission-point.entity";
import { BackupLog, BackupStatus, BackupStorageType } from "../../domain/entities/backup-log.entity";
import { SystemSettingsRepository } from "../../domain/repositories/system-settings.repository";
import {
  users,
  companySettings,
  emissionPoints,
  backupLogs,
  UserRow,
  CompanySettingsRow,
  EmissionPointRow,
  BackupLogRow,
} from "../database/schema/system-settings.schema";

export class DrizzleSystemSettingsRepository implements SystemSettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  public async findUserById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const row = rows[0];
    return row ? this.toUserDomain(row) : null;
  }

  public async findUserByUsername(username: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    const row = rows[0];
    return row ? this.toUserDomain(row) : null;
  }

  public async saveUser(user: User): Promise<void> {
    const existing = await this.findUserById(user.getId());
    if (existing) {
      await this.db
        .update(users)
        .set({
          username: user.getUsername(),
          fullName: user.getFullName(),
          email: user.getEmail(),
          passwordHash: user.getPasswordHash(),
          supervisorPinHash: user.getSupervisorPinHash(),
          role: user.getRole(),
          isActive: user.getIsActive(),
          updatedAt: user.getUpdatedAt(),
        })
        .where(eq(users.id, user.getId()));
    } else {
      await this.db.insert(users).values({
        id: user.getId(),
        username: user.getUsername(),
        fullName: user.getFullName(),
        email: user.getEmail(),
        passwordHash: user.getPasswordHash(),
        supervisorPinHash: user.getSupervisorPinHash(),
        role: user.getRole(),
        isActive: user.getIsActive(),
        createdAt: user.getCreatedAt(),
        updatedAt: user.getUpdatedAt(),
      });
    }
  }

  public async listSupervisorsAndAdmins(): Promise<User[]> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(inArray(users.role, ["ADMIN", "SUPERVISOR"]), eq(users.isActive, true)));

    return rows.map((r) => this.toUserDomain(r));
  }

  public async getCompanySettings(): Promise<CompanySettings | null> {
    const rows = await this.db.select().from(companySettings).limit(1);
    const row = rows[0];
    return row ? this.toCompanyDomain(row) : null;
  }

  public async saveCompanySettings(settings: CompanySettings): Promise<void> {
    const existing = await this.db.select().from(companySettings).limit(1);
    if (existing.length > 0 && existing[0]) {
      await this.db
        .update(companySettings)
        .set({
          legalName: settings.getLegalName(),
          tradeName: settings.getTradeName(),
          ruc: settings.getRuc(),
          mainAddress: settings.getMainAddress(),
          phone: settings.getPhone(),
          email: settings.getEmail(),
          website: settings.getWebsite(),
          logoUrl: settings.getLogoUrl(),
          ticketFooterMessage: settings.getTicketFooterMessage(),
          updatedAt: settings.getUpdatedAt(),
        })
        .where(eq(companySettings.id, existing[0].id));
    } else {
      await this.db.insert(companySettings).values({
        id: settings.getId(),
        legalName: settings.getLegalName(),
        tradeName: settings.getTradeName(),
        ruc: settings.getRuc(),
        mainAddress: settings.getMainAddress(),
        phone: settings.getPhone(),
        email: settings.getEmail(),
        website: settings.getWebsite(),
        logoUrl: settings.getLogoUrl(),
        ticketFooterMessage: settings.getTicketFooterMessage(),
        createdAt: settings.getCreatedAt(),
        updatedAt: settings.getUpdatedAt(),
      });
    }
  }

  public async findEmissionPointByCode(estab: string, pto: string): Promise<EmissionPoint | null> {
    const rows = await this.db
      .select()
      .from(emissionPoints)
      .where(
        and(
          eq(emissionPoints.establishmentCode, estab),
          eq(emissionPoints.emissionPointCode, pto)
        )
      )
      .limit(1);

    const row = rows[0];
    return row ? this.toEmissionDomain(row) : null;
  }

  public async listEmissionPoints(): Promise<EmissionPoint[]> {
    const rows = await this.db.select().from(emissionPoints);
    return rows.map((r) => this.toEmissionDomain(r));
  }

  public async saveEmissionPoint(point: EmissionPoint): Promise<void> {
    const existing = await this.findEmissionPointByCode(
      point.getEstablishmentCode(),
      point.getEmissionPointCode()
    );

    if (existing) {
      await this.db
        .update(emissionPoints)
        .set({
          name: point.getName(),
          assignedTerminalMac: point.getAssignedTerminalMac(),
          isActive: point.getIsActive(),
        })
        .where(
          and(
            eq(emissionPoints.establishmentCode, point.getEstablishmentCode()),
            eq(emissionPoints.emissionPointCode, point.getEmissionPointCode())
          )
        );
    } else {
      await this.db.insert(emissionPoints).values({
        id: point.getId(),
        establishmentCode: point.getEstablishmentCode(),
        emissionPointCode: point.getEmissionPointCode(),
        name: point.getName(),
        assignedTerminalMac: point.getAssignedTerminalMac(),
        isActive: point.getIsActive(),
        createdAt: point.getCreatedAt(),
      });
    }
  }

  public async saveBackupLog(log: BackupLog): Promise<void> {
    await this.db.insert(backupLogs).values({
      id: log.getId(),
      fileName: log.getFileName(),
      fileSizeBytes: log.getFileSizeBytes(),
      storageType: log.getStorageType(),
      cloudUrl: log.getCloudUrl(),
      status: log.getStatus(),
      errorMessage: log.getErrorMessage(),
      durationMs: log.getDurationMs(),
      createdAt: log.getCreatedAt(),
    });
  }

  public async listBackupLogs(limit = 20): Promise<BackupLog[]> {
    const rows = await this.db
      .select()
      .from(backupLogs)
      .orderBy(desc(backupLogs.createdAt))
      .limit(limit);

    return rows.map((r) => this.toBackupDomain(r));
  }

  private toUserDomain(row: UserRow): User {
    return new User({
      id: row.id,
      username: row.username,
      fullName: row.fullName,
      email: row.email,
      passwordHash: row.passwordHash,
      supervisorPinHash: row.supervisorPinHash ?? undefined,
      role: row.role as UserRole,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toCompanyDomain(row: CompanySettingsRow): CompanySettings {
    return new CompanySettings({
      id: row.id,
      legalName: row.legalName,
      tradeName: row.tradeName,
      ruc: row.ruc,
      mainAddress: row.mainAddress,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      website: row.website ?? undefined,
      logoUrl: row.logoUrl ?? undefined,
      ticketFooterMessage: row.ticketFooterMessage ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toEmissionDomain(row: EmissionPointRow): EmissionPoint {
    return new EmissionPoint({
      id: row.id,
      establishmentCode: row.establishmentCode,
      emissionPointCode: row.emissionPointCode,
      name: row.name,
      assignedTerminalMac: row.assignedTerminalMac ?? undefined,
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  }

  private toBackupDomain(row: BackupLogRow): BackupLog {
    return new BackupLog({
      id: row.id,
      fileName: row.fileName,
      fileSizeBytes: row.fileSizeBytes,
      storageType: row.storageType as BackupStorageType,
      cloudUrl: row.cloudUrl ?? undefined,
      status: row.status as BackupStatus,
      errorMessage: row.errorMessage ?? undefined,
      durationMs: row.durationMs ?? undefined,
      createdAt: row.createdAt,
    });
  }
}
