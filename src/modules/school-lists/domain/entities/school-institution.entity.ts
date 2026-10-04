import { assertUUID, generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export type SchoolRegime = "COSTA" | "SIERRA";

export interface CreateSchoolInstitutionProps {
  id?: string;
  name: string;
  city: string;
  regime?: SchoolRegime;
  isActive?: boolean;
  createdAt?: Date;
}

export class SchoolInstitution {
  private readonly id: string;
  private name: string;
  private city: string;
  private regime: SchoolRegime;
  private isActive: boolean;
  private readonly createdAt: Date;

  private constructor(props: {
    id: string;
    name: string;
    city: string;
    regime: SchoolRegime;
    isActive: boolean;
    createdAt: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.city = props.city;
    this.regime = props.regime;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
  }

  public static create(props: CreateSchoolInstitutionProps): SchoolInstitution {
    const trimmedName = props.name.trim();
    if (!trimmedName || trimmedName.length < 3) {
      throw new ValidationError(
        "El nombre de la institución educativa debe tener al menos 3 caracteres.",
        "INVALID_INSTITUTION_NAME"
      );
    }

    const trimmedCity = props.city.trim();
    if (!trimmedCity || trimmedCity.length < 2) {
      throw new ValidationError(
        "La ciudad de la institución educativa es obligatoria.",
        "INVALID_INSTITUTION_CITY"
      );
    }

    const id = props.id || generateUUIDv7();
    assertUUID(id, "ID de institución inválido.");

    return new SchoolInstitution({
      id,
      name: trimmedName,
      city: trimmedCity,
      regime: props.regime || "SIERRA",
      isActive: props.isActive ?? true,
      createdAt: props.createdAt || new Date(),
    });
  }

  public static reconstitute(props: {
    id: string;
    name: string;
    city: string;
    regime: SchoolRegime;
    isActive: boolean;
    createdAt: Date;
  }): SchoolInstitution {
    return new SchoolInstitution(props);
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getCity(): string {
    return this.city;
  }

  public getRegime(): SchoolRegime {
    return this.regime;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
