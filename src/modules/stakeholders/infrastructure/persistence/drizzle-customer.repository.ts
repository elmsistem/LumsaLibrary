import { eq, ilike } from "drizzle-orm";
import { AppDatabase, Money } from "@/modules/core/public-api";
import { Customer } from "../../domain/entities/customer.entity";
import { CustomerRepository } from "../../domain/repositories/customer.repository";
import {
  EcuadorianIdentification,
  IdentificationType,
} from "../../domain/value-objects/ecuadorian-identification.vo";
import { customers, CustomerRow } from "../database/schema/stakeholders.schema";

export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(private readonly db: AppDatabase) {}

  public async findById(id: string): Promise<Customer | null> {
    const rows = await this.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  public async findByIdNumber(idNumber: string): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(customers.idNumber, idNumber))
      .limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  public async save(customer: Customer): Promise<void> {
    const existing = await this.findById(customer.getId());

    if (existing) {
      await this.db
        .update(customers)
        .set({
          legalName: customer.getLegalName(),
          email: customer.getEmail(),
          phone: customer.getPhone(),
          address: customer.getAddress(),
          creditLimitCents: customer.getCreditLimit().toCents(),
          currentDebtCents: customer.getCurrentDebt().toCents(),
          isActive: customer.getIsActive(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customer.getId()));
    } else {
      await this.db.insert(customers).values({
        id: customer.getId(),
        idType: customer.getIdentification().getType() as CustomerRow["idType"],
        idNumber: customer.getIdentification().getValue(),
        legalName: customer.getLegalName(),
        email: customer.getEmail(),
        phone: customer.getPhone(),
        address: customer.getAddress(),
        creditLimitCents: customer.getCreditLimit().toCents(),
        currentDebtCents: customer.getCurrentDebt().toCents(),
        isActive: customer.getIsActive(),
      });
    }
  }

  public async search(query: string, limit = 20): Promise<Customer[]> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(ilike(customers.legalName, `%${query}%`))
      .limit(limit);

    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: CustomerRow): Customer {
    const identification = EcuadorianIdentification.create(
      row.idType as IdentificationType,
      row.idNumber
    );

    return new Customer({
      id: row.id,
      identification,
      legalName: row.legalName,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      creditLimit: Money.fromCents(row.creditLimitCents),
      currentDebt: Money.fromCents(row.currentDebtCents),
      isActive: row.isActive,
    });
  }
}
