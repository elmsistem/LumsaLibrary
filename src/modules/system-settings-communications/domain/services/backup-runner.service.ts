import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { generateUUIDv7 } from "@/modules/core/public-api";
import { BackupLog } from "../entities/backup-log.entity";

export interface BackupExecutionResult {
  log: BackupLog;
  encryptedBuffer: Buffer;
  sha256Checksum: string;
}

export class BackupRunnerService {
  /**
   * Cifra un buffer de datos (ej. dump de base de datos) usando AES-256-CBC con clave maestra.
   */
  public static encryptBackupData(
    rawBuffer: Buffer,
    masterKeySecret = "lumsa-library-enterprise-secret-key-32chars!!"
  ): { encryptedBuffer: Buffer; sha256Checksum: string } {
    // Asegurar clave de 32 bytes usando SHA-256
    const key = createHash("sha256").update(masterKeySecret).digest();
    const iv = randomBytes(16);

    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(rawBuffer), cipher.final()]);

    // Estructura: [16 bytes IV] + [Datos Cifrados]
    const finalBuffer = Buffer.concat([iv, encrypted]);
    const sha256Checksum = createHash("sha256").update(finalBuffer).digest("hex");

    return {
      encryptedBuffer: finalBuffer,
      sha256Checksum,
    };
  }

  /**
   * Ejecuta la rutina de respaldo y genera la entidad de log con métricas de tiempo y tamaño.
   */
  public static executeBackup(
    rawDumpData: Buffer,
    fileNamePrefix = "lumsa-backup"
  ): BackupExecutionResult {
    const startTime = Date.now();
    const backupId = generateUUIDv7();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${fileNamePrefix}-${timestamp}.sql.enc`;

    try {
      const { encryptedBuffer, sha256Checksum } = this.encryptBackupData(rawDumpData);
      const durationMs = Date.now() - startTime;

      const log = BackupLog.create({
        id: backupId,
        fileName,
        fileSizeBytes: encryptedBuffer.length,
        status: "COMPLETED",
        durationMs,
        storageType: "CLOUD_SYNCED",
        cloudUrl: `s3://lumsa-backups/${fileName}`,
      });

      return {
        log,
        encryptedBuffer,
        sha256Checksum,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const log = BackupLog.create({
        id: backupId,
        fileName,
        fileSizeBytes: 0,
        status: "FAILED",
        errorMessage,
        durationMs,
        storageType: "LOCAL_ONLY",
      });

      return {
        log,
        encryptedBuffer: Buffer.alloc(0),
        sha256Checksum: "",
      };
    }
  }
}
