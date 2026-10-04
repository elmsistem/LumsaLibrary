import { SystemSettingsRepository } from "../../domain/repositories/system-settings.repository";
import { BackupRunnerService } from "../../domain/services/backup-runner.service";

export interface RunDatabaseBackupInput {
  rawDumpData?: Buffer;
  fileNamePrefix?: string;
}

export interface RunDatabaseBackupResult {
  logId: string;
  fileName: string;
  fileSizeBytes: number;
  status: "COMPLETED" | "FAILED";
  cloudUrl?: string;
  durationMs?: number;
  sha256Checksum: string;
}

/**
 * Caso de Uso: Ejecución de Respaldo Automatizado de Base de Datos con Cifrado AES-256.
 */
export class RunDatabaseBackupUseCase {
  constructor(private readonly repo: SystemSettingsRepository) {}

  public async execute(
    input: RunDatabaseBackupInput = {}
  ): Promise<RunDatabaseBackupResult> {
    const rawData =
      input.rawDumpData ??
      Buffer.from("-- LumsaLibrary PostgreSQL ERP Backup Snapshot --\n", "utf-8");

    const execution = BackupRunnerService.executeBackup(
      rawData,
      input.fileNamePrefix ?? "lumsa-erp"
    );

    await this.repo.saveBackupLog(execution.log);

    return {
      logId: execution.log.getId(),
      fileName: execution.log.getFileName(),
      fileSizeBytes: execution.log.getFileSizeBytes(),
      status: execution.log.getStatus() as "COMPLETED" | "FAILED",
      cloudUrl: execution.log.getCloudUrl(),
      durationMs: execution.log.getDurationMs(),
      sha256Checksum: execution.sha256Checksum,
    };
  }
}
