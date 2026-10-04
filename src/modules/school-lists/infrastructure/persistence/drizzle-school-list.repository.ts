import { eq, and, sql } from "drizzle-orm";
import { AppDatabase, Money, generateUUIDv7 } from "@/modules/core/public-api";
import { SchoolInstitution, SchoolRegime } from "../../domain/entities/school-institution.entity";
import {
  SchoolList,
  SchoolListStatus,
  SchoolListItemProps,
} from "../../domain/entities/school-list.entity";
import {
  SchoolListRepository,
  SchoolListAdvanceData,
} from "../../domain/repositories/school-list.repository";
import {
  schoolInstitutions,
  schoolLists,
  schoolListItems,
  schoolListAdvances,
  SchoolInstitutionRow,
  SchoolListRow,
  SchoolListItemRow,
} from "../database/schema/school-lists.schema";

export class DrizzleSchoolListRepository implements SchoolListRepository {
  constructor(private readonly db: AppDatabase) {}

  public async saveInstitution(institution: SchoolInstitution): Promise<void> {
    await this.db
      .insert(schoolInstitutions)
      .values({
        id: institution.getId(),
        name: institution.getName(),
        city: institution.getCity(),
        regime: institution.getRegime(),
        isActive: institution.getIsActive(),
        createdAt: institution.getCreatedAt(),
      })
      .onConflictDoUpdate({
        target: schoolInstitutions.id,
        set: {
          name: institution.getName(),
          city: institution.getCity(),
          regime: institution.getRegime(),
          isActive: institution.getIsActive(),
        },
      });
  }

  public async findInstitutionById(id: string): Promise<SchoolInstitution | null> {
    const rows = await this.db
      .select()
      .from(schoolInstitutions)
      .where(eq(schoolInstitutions.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toInstitutionDomain(row);
  }

  public async listInstitutions(): Promise<SchoolInstitution[]> {
    const rows = await this.db.select().from(schoolInstitutions);
    return rows.map((r) => this.toInstitutionDomain(r));
  }

  public async saveSchoolList(list: SchoolList): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Guardar o actualizar cabecera
      await tx
        .insert(schoolLists)
        .values({
          id: list.getId(),
          institutionId: list.getInstitutionId(),
          gradeLevel: list.getGradeLevel(),
          academicYear: list.getAcademicYear(),
          studentName: list.getStudentName(),
          customerId: list.getCustomerId(),
          status: list.getStatus(),
          totalQuotedCents: list.getTotalQuoted().toCents(),
          advancePaymentCents: list.getAdvancePayment().toCents(),
          notes: list.getNotes(),
          createdAt: list.getCreatedAt(),
          updatedAt: list.getUpdatedAt(),
        })
        .onConflictDoUpdate({
          target: schoolLists.id,
          set: {
            studentName: list.getStudentName(),
            customerId: list.getCustomerId(),
            status: list.getStatus(),
            totalQuotedCents: list.getTotalQuoted().toCents(),
            advancePaymentCents: list.getAdvancePayment().toCents(),
            notes: list.getNotes(),
            updatedAt: list.getUpdatedAt(),
          },
        });

      // 2. Sincronizar ítems detallados si existen
      const items = list.getItems();
      if (items.length > 0) {
        await tx.delete(schoolListItems).where(eq(schoolListItems.schoolListId, list.getId()));

        const itemRows = items.map((i) => ({
          id: i.id || generateUUIDv7(),
          schoolListId: list.getId(),
          productId: i.productId,
          presentationId: i.presentationId,
          quantity: i.quantity.toFixed(2),
          unitPriceCents: i.unitPrice.toCents(),
          isReserved: i.isReserved,
          isDelivered: i.isDelivered,
          substituteProductId: i.substituteProductId || null,
        }));

        await tx.insert(schoolListItems).values(itemRows);
      }
    });
  }

  public async findSchoolListById(id: string): Promise<SchoolList | null> {
    const listRows = await this.db.select().from(schoolLists).where(eq(schoolLists.id, id)).limit(1);
    const listRow = listRows[0];
    if (!listRow) return null;

    const itemRows = await this.db
      .select()
      .from(schoolListItems)
      .where(eq(schoolListItems.schoolListId, id));

    return this.toSchoolListDomain(listRow, itemRows);
  }

  public async listSchoolLists(filters?: {
    institutionId?: string;
    academicYear?: string;
    status?: string;
  }): Promise<SchoolList[]> {
    const conditions = [];
    if (filters?.institutionId) {
      conditions.push(eq(schoolLists.institutionId, filters.institutionId));
    }
    if (filters?.academicYear) {
      conditions.push(eq(schoolLists.academicYear, filters.academicYear));
    }
    if (filters?.status) {
      conditions.push(eq(schoolLists.status, filters.status as SchoolListStatus));
    }

    const rows = await this.db
      .select()
      .from(schoolLists)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const result: SchoolList[] = [];
    for (const row of rows) {
      const items = await this.db
        .select()
        .from(schoolListItems)
        .where(eq(schoolListItems.schoolListId, row.id));
      result.push(this.toSchoolListDomain(row, items));
    }
    return result;
  }

  public async getNextAdvanceSequential(): Promise<string> {
    const year = new Date().getFullYear();
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schoolListAdvances);

    const next = Number(countResult[0]?.count ?? 0) + 1;
    return `REC-ANT-${year}-${String(next).padStart(5, "0")}`;
  }

  public async saveAdvance(advance: SchoolListAdvanceData): Promise<void> {
    await this.db.insert(schoolListAdvances).values({
      id: advance.id,
      schoolListId: advance.schoolListId,
      cashSessionId: advance.cashSessionId,
      amountCents: advance.amount.toCents(),
      paymentMethod: advance.paymentMethod,
      receiptCode: advance.receiptCode,
      createdAt: advance.createdAt,
    });
  }

  // --- Mapeadores de Dominio ---

  private toInstitutionDomain(row: SchoolInstitutionRow): SchoolInstitution {
    return SchoolInstitution.reconstitute({
      id: row.id,
      name: row.name,
      city: row.city,
      regime: row.regime as SchoolRegime,
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  }

  private toSchoolListDomain(row: SchoolListRow, items: SchoolListItemRow[]): SchoolList {
    const domainItems: SchoolListItemProps[] = items.map((i) => ({
      id: i.id,
      productId: i.productId,
      presentationId: i.presentationId,
      quantity: parseFloat(i.quantity),
      unitPrice: Money.fromCents(i.unitPriceCents),
      isReserved: i.isReserved,
      isDelivered: i.isDelivered,
      substituteProductId: i.substituteProductId,
    }));

    return SchoolList.reconstitute({
      id: row.id,
      institutionId: row.institutionId,
      gradeLevel: row.gradeLevel,
      academicYear: row.academicYear,
      studentName: row.studentName,
      customerId: row.customerId,
      status: row.status as SchoolListStatus,
      totalQuoted: Money.fromCents(row.totalQuotedCents),
      advancePayment: Money.fromCents(row.advancePaymentCents),
      notes: row.notes,
      items: domainItems,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
