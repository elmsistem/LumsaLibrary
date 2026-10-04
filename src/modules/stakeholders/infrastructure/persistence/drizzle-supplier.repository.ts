import { eq } from "drizzle-orm";
import { AppDatabase } from "@/modules/core/public-api";
import { Supplier } from "../../domain/entities/supplier.entity";
import { SupplierRepository } from "../../domain/repositories/supplier.repository";
import { suppliers, SupplierRow } from "../database/schema/stakeholders.schema";

export class DrizzleSupplierRepository implements SupplierRepository {
  constructor(private readonly db: AppDatabase) {}

  public async findById(id: string): Promise<Supplier | null> {
    const rows = await this.db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  public async findByRuc(ruc: string): Promise<Supplier | null> {
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.ruc, ruc))
      .limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  public async save(supplier: Supplier): Promise<void> {
    const existing = await this.findById(supplier.getId());

    if (existing) {
      await this.db
        .update(suppliers)
        .set({
          ruc: supplier.getRuc(),
          legalName: supplier.getLegalName(),
          commercialName: supplier.getCommercialName(),
          email: supplier.getEmail(),
          phone: supplier.getPhone(),
          address: supplier.getAddress(),
          contactPerson: supplier.getContactPerson(),
          creditDays: supplier.getCreditDays(),
          isActive: supplier.getIsActive(),
          updatedAt: supplier.getUpdatedAt(),
        })
        .where(eq(suppliers.id, supplier.getId()));
    } else {
      await this.db.insert(suppliers).values({
        id: supplier.getId(),
        ruc: supplier.getRuc(),
        legalName: supplier.getLegalName(),
        commercialName: supplier.getCommercialName(),
        email: supplier.getEmail(),
        phone: supplier.getPhone(),
        address: supplier.getAddress(),
        contactPerson: supplier.getContactPerson(),
        creditDays: supplier.getCreditDays(),
        isActive: supplier.getIsActive(),
        createdAt: supplier.getCreatedAt(),
        updatedAt: supplier.getUpdatedAt(),
      });
    }
  }

  public async listAll(limit = 100, offset = 0): Promise<Supplier[]> {
    const rows = await this.db.select().from(suppliers).limit(limit).offset(offset);
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: SupplierRow): Supplier {
    return new Supplier({
      id: row.id,
      ruc: row.ruc,
      legalName: row.legalName,
      commercialName: row.commercialName ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      contactPerson: row.contactPerson ?? undefined,
      creditDays: row.creditDays,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
