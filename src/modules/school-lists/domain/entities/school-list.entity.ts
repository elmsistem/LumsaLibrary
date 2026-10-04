import { assertUUID, generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export type SchoolListStatus = "DRAFT" | "QUOTED" | "RESERVED" | "DISPATCHED" | "CANCELLED";

export interface SchoolListItemProps {
  id?: string;
  productId: string;
  presentationId: string;
  quantity: number;
  unitPrice: Money;
  isReserved: boolean;
  isDelivered: boolean;
  substituteProductId?: string | null;
}

export interface CreateSchoolListProps {
  id?: string;
  institutionId?: string | null;
  gradeLevel: string;
  academicYear: string;
  studentName?: string | null;
  customerId?: string | null;
  status?: SchoolListStatus;
  totalQuoted?: Money;
  advancePayment?: Money;
  notes?: string | null;
  items?: SchoolListItemProps[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class SchoolList {
  private readonly id: string;
  private readonly institutionId: string | null;
  private readonly gradeLevel: string;
  private readonly academicYear: string;
  private studentName: string | null;
  private customerId: string | null;
  private status: SchoolListStatus;
  private totalQuoted: Money;
  private advancePayment: Money;
  private notes: string | null;
  private items: SchoolListItemProps[];
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: {
    id: string;
    institutionId: string | null;
    gradeLevel: string;
    academicYear: string;
    studentName: string | null;
    customerId: string | null;
    status: SchoolListStatus;
    totalQuoted: Money;
    advancePayment: Money;
    notes: string | null;
    items: SchoolListItemProps[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.institutionId = props.institutionId;
    this.gradeLevel = props.gradeLevel;
    this.academicYear = props.academicYear;
    this.studentName = props.studentName;
    this.customerId = props.customerId;
    this.status = props.status;
    this.totalQuoted = props.totalQuoted;
    this.advancePayment = props.advancePayment;
    this.notes = props.notes;
    this.items = props.items;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: CreateSchoolListProps): SchoolList {
    const id = props.id || generateUUIDv7();
    assertUUID(id, "ID de lista escolar inválido.");

    if (props.institutionId) {
      assertUUID(props.institutionId, "ID de institución educativa inválido.");
    }
    if (props.customerId) {
      assertUUID(props.customerId, "ID de cliente inválido.");
    }

    if (!props.gradeLevel || props.gradeLevel.trim().length === 0) {
      throw new ValidationError(
        "Debe especificar el grado o curso escolar (ej: 5to de Básica).",
        "INVALID_GRADE_LEVEL"
      );
    }

    if (!props.academicYear || props.academicYear.trim().length === 0) {
      throw new ValidationError(
        "Debe especificar el año lectivo (ej: 2026-2027).",
        "INVALID_ACADEMIC_YEAR"
      );
    }

    return new SchoolList({
      id,
      institutionId: props.institutionId || null,
      gradeLevel: props.gradeLevel.trim(),
      academicYear: props.academicYear.trim(),
      studentName: props.studentName?.trim() || null,
      customerId: props.customerId || null,
      status: props.status || "DRAFT",
      totalQuoted: props.totalQuoted || Money.zero(),
      advancePayment: props.advancePayment || Money.zero(),
      notes: props.notes?.trim() || null,
      items: props.items || [],
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    });
  }

  public static reconstitute(props: {
    id: string;
    institutionId: string | null;
    gradeLevel: string;
    academicYear: string;
    studentName: string | null;
    customerId: string | null;
    status: SchoolListStatus;
    totalQuoted: Money;
    advancePayment: Money;
    notes: string | null;
    items: SchoolListItemProps[];
    createdAt: Date;
    updatedAt: Date;
  }): SchoolList {
    return new SchoolList(props);
  }

  public getId(): string {
    return this.id;
  }

  public getInstitutionId(): string | null {
    return this.institutionId;
  }

  public getGradeLevel(): string {
    return this.gradeLevel;
  }

  public getAcademicYear(): string {
    return this.academicYear;
  }

  public getStudentName(): string | null {
    return this.studentName;
  }

  public getCustomerId(): string | null {
    return this.customerId;
  }

  public getStatus(): SchoolListStatus {
    return this.status;
  }

  public getTotalQuoted(): Money {
    return this.totalQuoted;
  }

  public getAdvancePayment(): Money {
    return this.advancePayment;
  }

  public getNotes(): string | null {
    return this.notes;
  }

  public getItems(): SchoolListItemProps[] {
    return [...this.items];
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public getPendingBalance(): Money {
    return this.totalQuoted.subtract(this.advancePayment);
  }

  public quote(items: SchoolListItemProps[], total: Money): void {
    if (this.status === "DISPATCHED" || this.status === "CANCELLED") {
      throw new ValidationError(
        "No se puede cotizar una lista que ya está despachada o cancelada.",
        "INVALID_LIST_STATE"
      );
    }
    this.items = items.map((i) => ({ ...i, id: i.id || generateUUIDv7() }));
    this.totalQuoted = total;
    this.status = "QUOTED";
    this.updatedAt = new Date();
  }

  public reserve(advanceAmount: Money): void {
    if (this.status === "DISPATCHED" || this.status === "CANCELLED") {
      throw new ValidationError(
        "No se puede reservar una lista despachada o cancelada.",
        "INVALID_LIST_STATE"
      );
    }

    if (advanceAmount.toCents() <= 0) {
      throw new ValidationError(
        "El abono económico para reserva debe ser mayor que cero.",
        "INVALID_ADVANCE_AMOUNT"
      );
    }

    this.advancePayment = this.advancePayment.add(advanceAmount);
    this.status = "RESERVED";
    // Marcar ítems como reservados en bodega
    this.items = this.items.map((item) => ({ ...item, isReserved: true }));
    this.updatedAt = new Date();
  }

  public dispatch(): void {
    if (this.status === "CANCELLED") {
      throw new ValidationError(
        "No se puede despachar una lista que ha sido cancelada.",
        "INVALID_LIST_STATE"
      );
    }

    this.status = "DISPATCHED";
    this.items = this.items.map((item) => ({ ...item, isDelivered: true }));
    this.updatedAt = new Date();
  }

  public cancel(): void {
    if (this.status === "DISPATCHED") {
      throw new ValidationError(
        "No se puede cancelar una lista que ya fue despachada y facturada.",
        "CANNOT_CANCEL_DISPATCHED_LIST"
      );
    }

    this.status = "CANCELLED";
    this.items = this.items.map((item) => ({ ...item, isReserved: false }));
    this.updatedAt = new Date();
  }
}
