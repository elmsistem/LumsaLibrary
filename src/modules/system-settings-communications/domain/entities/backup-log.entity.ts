export type BackupStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type BackupStorageType = "LOCAL_ONLY" | "CLOUD_SYNCED";

export interface CreateBackupLogProps {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  storageType?: BackupStorageType;
  cloudUrl?: string;
  status: BackupStatus;
  errorMessage?: string;
  durationMs?: number;
  createdAt?: Date;
}

/**
 * Entidad de Dominio para Auditoría y Trazabilidad de Copias de Seguridad (Backups).
 */
export class BackupLog {
  private readonly id: string;
  private readonly fileName: string;
  private fileSizeBytes: number;
  private storageType: BackupStorageType;
  private cloudUrl?: string;
  private status: BackupStatus;
  private errorMessage?: string;
  private durationMs?: number;
  private readonly createdAt: Date;

  public static create(props: CreateBackupLogProps): BackupLog {
    return new BackupLog(props);
  }

  constructor(props: CreateBackupLogProps) {
    this.id = props.id;
    this.fileName = props.fileName;
    this.fileSizeBytes = props.fileSizeBytes;
    this.storageType = props.storageType ?? "CLOUD_SYNCED";
    this.cloudUrl = props.cloudUrl;
    this.status = props.status;
    this.errorMessage = props.errorMessage;
    this.durationMs = props.durationMs;
    this.createdAt = props.createdAt ?? new Date();
  }

  public complete(fileSizeBytes: number, durationMs: number, cloudUrl?: string): void {
    this.status = "COMPLETED";
    this.fileSizeBytes = fileSizeBytes;
    this.durationMs = durationMs;
    if (cloudUrl) {
      this.cloudUrl = cloudUrl;
      this.storageType = "CLOUD_SYNCED";
    }
  }

  public fail(errorMessage: string, durationMs?: number): void {
    this.status = "FAILED";
    this.errorMessage = errorMessage;
    if (durationMs !== undefined) {
      this.durationMs = durationMs;
    }
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getFileName(): string {
    return this.fileName;
  }

  public getFileSizeBytes(): number {
    return this.fileSizeBytes;
  }

  public getStorageType(): BackupStorageType {
    return this.storageType;
  }

  public getCloudUrl(): string | undefined {
    return this.cloudUrl;
  }

  public getStatus(): BackupStatus {
    return this.status;
  }

  public getErrorMessage(): string | undefined {
    return this.errorMessage;
  }

  public getDurationMs(): number | undefined {
    return this.durationMs;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
