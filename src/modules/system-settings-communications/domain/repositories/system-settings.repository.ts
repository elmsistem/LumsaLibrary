import { User } from "../entities/user.entity";
import { CompanySettings } from "../entities/company-settings.entity";
import { EmissionPoint } from "../entities/emission-point.entity";
import { BackupLog } from "../entities/backup-log.entity";

export interface SystemSettingsRepository {
  // --- Usuarios y Seguridad ---
  findUserById(id: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  listSupervisorsAndAdmins(): Promise<User[]>;

  // --- Configuración de Empresa ---
  getCompanySettings(): Promise<CompanySettings | null>;
  saveCompanySettings(settings: CompanySettings): Promise<void>;

  // --- Puntos de Emisión SRI ---
  findEmissionPointByCode(estab: string, pto: string): Promise<EmissionPoint | null>;
  listEmissionPoints(): Promise<EmissionPoint[]>;
  saveEmissionPoint(point: EmissionPoint): Promise<void>;

  // --- Copias de Seguridad ---
  saveBackupLog(log: BackupLog): Promise<void>;
  listBackupLogs(limit?: number): Promise<BackupLog[]>;
}
