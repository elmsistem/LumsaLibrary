import { describe, it, expect, beforeEach } from "vitest";
import { generateUUIDv7 } from "@/modules/core/public-api";
import {
  User,
  CompanySettings,
  EmissionPoint,
  BackupLog,
  SystemSettingsRepository,
  SupervisorAuthService,
  WhatsAppDispatcherService,
  EmailDispatcherService,
  AuthorizeSupervisorPinUseCase,
  RunDatabaseBackupUseCase,
  DispatchInvoiceNotificationUseCase,
} from "../../public-api";

class InMemorySystemSettingsRepository implements SystemSettingsRepository {
  private users: Map<string, User> = new Map();
  private company: CompanySettings | null = null;
  private emissionPoints: Map<string, EmissionPoint> = new Map();
  public backupLogs: BackupLog[] = [];

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.getUsername() === username) return u;
    }
    return null;
  }

  async saveUser(user: User): Promise<void> {
    this.users.set(user.getId(), user);
  }

  async listSupervisorsAndAdmins(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (u) => (u.getRole() === "ADMIN" || u.getRole() === "SUPERVISOR") && u.getIsActive()
    );
  }

  async getCompanySettings(): Promise<CompanySettings | null> {
    return this.company;
  }

  async saveCompanySettings(settings: CompanySettings): Promise<void> {
    this.company = settings;
  }

  async findEmissionPointByCode(estab: string, pto: string): Promise<EmissionPoint | null> {
    return this.emissionPoints.get(`${estab}-${pto}`) || null;
  }

  async listEmissionPoints(): Promise<EmissionPoint[]> {
    return Array.from(this.emissionPoints.values());
  }

  async saveEmissionPoint(point: EmissionPoint): Promise<void> {
    this.emissionPoints.set(point.getFullCode(), point);
  }

  async saveBackupLog(log: BackupLog): Promise<void> {
    this.backupLogs.push(log);
  }

  async listBackupLogs(): Promise<BackupLog[]> {
    return this.backupLogs;
  }
}

describe("System Settings, Backups, and Communications Module", () => {
  let repo: InMemorySystemSettingsRepository;
  let supervisorUser: User;
  let cashierUser: User;

  beforeEach(async () => {
    repo = new InMemorySystemSettingsRepository();

    // Supervisor con PIN '4321'
    supervisorUser = User.create({
      id: generateUUIDv7(),
      username: "super_ana",
      fullName: "Ana Gómez (Supervisora)",
      email: "ana.gomez@lumsalibrary.com",
      passwordHash: "dummy-pwd-hash",
      role: "SUPERVISOR",
      isActive: true,
    });
    supervisorUser.setSupervisorPin("4321", (p) => SupervisorAuthService.hashPin(p));
    await repo.saveUser(supervisorUser);

    // Cajero sin permisos de supervisor
    cashierUser = User.create({
      id: generateUUIDv7(),
      username: "cajero_pedro",
      fullName: "Pedro Morales",
      email: "pedro@lumsalibrary.com",
      passwordHash: "dummy-pwd-hash",
      role: "CASHIER",
      isActive: true,
    });
    await repo.saveUser(cashierUser);
  });

  describe("AuthorizeSupervisorPinUseCase", () => {
    it("debe autorizar correctamente una operación con el PIN válido de un supervisor", async () => {
      const useCase = new AuthorizeSupervisorPinUseCase(repo);
      const result = await useCase.execute({
        pin: "4321",
        requiredOperation: "DISCOUNT_OVERRIDE",
      });

      expect(result.authorized).toBe(true);
      expect(result.supervisorId).toBe(supervisorUser.getId());
      expect(result.supervisorName).toBe("Ana Gómez (Supervisora)");
      expect(result.supervisorRole).toBe("SUPERVISOR");
    });

    it("debe rechazar un PIN incorrecto", async () => {
      const useCase = new AuthorizeSupervisorPinUseCase(repo);
      await expect(
        useCase.execute({
          pin: "9999",
          requiredOperation: "SALE_VOID",
        })
      ).rejects.toThrowError("PIN de supervisor incorrecto");
    });

    it("debe rechazar PINs que no tengan exactamente 4 dígitos", async () => {
      const useCase = new AuthorizeSupervisorPinUseCase(repo);
      await expect(
        useCase.execute({
          pin: "123",
          requiredOperation: "DRAWER_OPEN",
        })
      ).rejects.toThrowError("El código PIN debe tener exactamente 4 dígitos numéricos");
    });
  });

  describe("CompanySettings y EmissionPoint", () => {
    it("debe aceptar configuraciones con RUC ecuatoriano oficial válido", () => {
      const company = CompanySettings.create({
        id: generateUUIDv7(),
        legalName: "LUMSA LIBRARY CIA. LTDA.",
        tradeName: "LUMSA LIBRARY",
        ruc: "1790016927001", // RUC oficial válido (Módulo 11)
        mainAddress: "Av. Amazonas 123 y Cordero, Quito",
        phone: "022555666",
        email: "facturacion@lumsalibrary.com",
      });

      expect(company.getRuc()).toBe("1790016927001");
      expect(company.getTradeName()).toBe("LUMSA LIBRARY");
      expect(company.getTicketFooterMessage()).toContain("¡Gracias por su compra!");
    });

    it("debe rechazar configuraciones con RUC inválido", () => {
      expect(() =>
        CompanySettings.create({
          id: generateUUIDv7(),
          legalName: "LUMSA LIBRARY CIA. LTDA.",
          tradeName: "LUMSA LIBRARY",
          ruc: "1790016928001", // RUC con dígito verificador inválido (Módulo 11)
          mainAddress: "Av. Amazonas 123",
        })
      ).toThrowError("El RUC de la empresa es inválido");
    });

    it("debe validar el formato de 3 dígitos de puntos de emisión", () => {
      const point = EmissionPoint.create({
        id: generateUUIDv7(),
        establishmentCode: "001",
        emissionPointCode: "002",
        name: "Caja 2 - Pasillo Cuadernos",
      });

      expect(point.getFullCode()).toBe("001-002");
      expect(() =>
        EmissionPoint.create({
          id: generateUUIDv7(),
          establishmentCode: "1", // Inválido
          emissionPointCode: "002",
          name: "Caja 1",
        })
      ).toThrowError("El código de establecimiento debe tener exactamente 3 dígitos numéricos");
    });
  });

  describe("WhatsAppDispatcherService", () => {
    it("debe normalizar números telefónicos ecuatorianos al estándar internacional E.164", () => {
      expect(WhatsAppDispatcherService.normalizeEcuadorianPhoneNumber("0991234567")).toBe("+593991234567");
      expect(WhatsAppDispatcherService.normalizeEcuadorianPhoneNumber("991234567")).toBe("+593991234567");
      expect(WhatsAppDispatcherService.normalizeEcuadorianPhoneNumber("+593981234567")).toBe("+593981234567");
    });

    it("debe rechazar números que no correspondan a celulares ecuatorianos", () => {
      expect(() => WhatsAppDispatcherService.normalizeEcuadorianPhoneNumber("123456")).toThrowError(
        "El número celular no tiene un formato ecuatoriano válido"
      );
    });

    it("debe generar el texto interactivo de factura para WhatsApp con links de descarga", () => {
      const msg = WhatsAppDispatcherService.buildInvoiceMessage({
        customerName: "Carlos Benítez",
        phoneNumber: "0991234567",
        invoiceNumber: "001-001-000000123",
        totalAmountDollars: "45.50",
        ridePdfUrl: "https://lumsa.ec/ride/123.pdf",
        xmlDownloadUrl: "https://lumsa.ec/xml/123.xml",
      });

      expect(msg).toContain("LUMSA LIBRARY — Factura Electrónica");
      expect(msg).toContain("001-001-000000123");
      expect(msg).toContain("$45.50");
      expect(msg).toContain("+593991234567");
    });
  });

  describe("EmailDispatcherService", () => {
    it("debe formatear correos transaccionales con asunto y adjuntos legales", () => {
      const email = EmailDispatcherService.buildInvoiceEmail({
        toEmail: "cliente@gmail.com",
        customerName: "María López",
        invoiceNumber: "001-001-000000888",
        accessKey: "0110202601179001692700120010010000008881234567812",
        totalAmountDollars: "15.00",
        xmlContent: "<factura></factura>",
        pdfRideBuffer: Buffer.from("PDF-MOCK"),
      });

      expect(email.to).toBe("cliente@gmail.com");
      expect(email.subject).toContain("001-001-000000888");
      expect(email.html).toContain("María López");
      expect(email.attachments).toHaveLength(2);
      expect(email.attachments[0]?.filename).toBe("001-001-000000888.xml");
      expect(email.attachments[1]?.filename).toBe("001-001-000000888.pdf");
    });
  });

  describe("BackupRunnerService y RunDatabaseBackupUseCase", () => {
    it("debe cifrar con AES-256 y registrar la copia de seguridad de la base de datos", async () => {
      const useCase = new RunDatabaseBackupUseCase(repo);
      const rawDump = Buffer.from("CREATE TABLE products ... DUMP TEST DATA ...", "utf-8");

      const result = await useCase.execute({
        rawDumpData: rawDump,
        fileNamePrefix: "lumsa-prod-backup",
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.fileName).toContain("lumsa-prod-backup");
      expect(result.fileName).toContain(".sql.enc");
      expect(result.fileSizeBytes).toBeGreaterThan(0);
      expect(result.sha256Checksum).toHaveLength(64); // SHA-256 hex string

      // Verificar registro en repositorio
      expect(repo.backupLogs).toHaveLength(1);
      expect(repo.backupLogs[0]?.getId()).toBe(result.logId);
      expect(repo.backupLogs[0]?.getStatus()).toBe("COMPLETED");
    });
  });

  describe("DispatchInvoiceNotificationUseCase", () => {
    it("debe despachar factura electrónica por WhatsApp y Correo simultáneamente", async () => {
      const useCase = new DispatchInvoiceNotificationUseCase();
      const result = await useCase.execute({
        customerName: "Juan Pérez",
        phoneNumber: "0991234567",
        email: "juan@ejemplo.com",
        invoiceNumber: "001-001-000000555",
        accessKey: "0110202601179001692700120010010000005551234567812",
        totalAmountDollars: "28.50",
        ridePdfUrl: "https://lumsa.ec/ride/555.pdf",
        xmlDownloadUrl: "https://lumsa.ec/xml/555.xml",
      });

      expect(result.whatsappSent).toBe(true);
      expect(result.whatsappNormalizedPhone).toBe("+593991234567");
      expect(result.emailSent).toBe(true);
      expect(result.emailRecipient).toBe("juan@ejemplo.com");
      expect(result.emailSubject).toContain("001-001-000000555");
    });
  });
});
