import { ValidationError } from "@/modules/core/public-api";

export type UserRole = "ADMIN" | "SUPERVISOR" | "CASHIER" | "WAREHOUSE";

export interface CreateUserProps {
  id: string;
  username: string;
  fullName: string;
  email: string;
  passwordHash: string;
  supervisorPinHash?: string;
  role?: UserRole;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Entidad de Dominio para Usuarios y Operadores del Sistema.
 */
export class User {
  private readonly id: string;
  private readonly username: string;
  private fullName: string;
  private email: string;
  private passwordHash: string;
  private supervisorPinHash?: string;
  private role: UserRole;
  private isActive: boolean;
  private readonly createdAt: Date;
  private updatedAt: Date;

  public static create(props: CreateUserProps): User {
    return new User(props);
  }

  constructor(props: CreateUserProps) {
    if (!props.username || props.username.trim().length < 3) {
      throw new ValidationError(
        "El nombre de usuario debe tener al menos 3 caracteres.",
        "INVALID_USERNAME"
      );
    }

    if (!props.fullName || props.fullName.trim().length < 2) {
      throw new ValidationError(
        "El nombre completo debe tener al menos 2 caracteres.",
        "INVALID_FULL_NAME"
      );
    }

    if (!props.email || !props.email.includes("@")) {
      throw new ValidationError("El correo electrónico no es válido.", "INVALID_EMAIL");
    }

    this.id = props.id;
    this.username = props.username.trim();
    this.fullName = props.fullName.trim();
    this.email = props.email.trim();
    this.passwordHash = props.passwordHash;
    this.supervisorPinHash = props.supervisorPinHash;
    this.role = props.role ?? "CASHIER";
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public canAuthorizeSupervisorAction(): boolean {
    return this.isActive && (this.role === "ADMIN" || this.role === "SUPERVISOR");
  }

  public setSupervisorPin(rawPin: string, hashFn: (pin: string) => string): void {
    if (!/^\d{4}$/.test(rawPin)) {
      throw new ValidationError(
        "El PIN de supervisor debe contener exactamente 4 dígitos numéricos.",
        "INVALID_SUPERVISOR_PIN"
      );
    }

    this.supervisorPinHash = hashFn(rawPin);
    this.updatedAt = new Date();
  }

  public verifySupervisorPin(rawPin: string, hashFn: (pin: string) => string): boolean {
    if (!this.canAuthorizeSupervisorAction()) return false;
    if (!this.supervisorPinHash) return false;
    return this.supervisorPinHash === hashFn(rawPin);
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getUsername(): string {
    return this.username;
  }

  public getFullName(): string {
    return this.fullName;
  }

  public getEmail(): string {
    return this.email;
  }

  public getPasswordHash(): string {
    return this.passwordHash;
  }

  public getSupervisorPinHash(): string | undefined {
    return this.supervisorPinHash;
  }

  public getRole(): UserRole {
    return this.role;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
