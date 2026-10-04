import { eq, and } from "drizzle-orm";
import { AppDatabase, Money } from "@/modules/core/public-api";
import { TaxRate } from "@/modules/catalog/public-api";
import { Purchase, PurchaseStatus } from "../../domain/entities/purchase.entity";
import { PurchaseItem } from "../../domain/entities/purchase-item.entity";
import { SupplierProductMapping } from "../../domain/entities/supplier-product-mapping.entity";
import { SupplierDebt } from "../../domain/entities/supplier-debt.entity";
import { PurchaseRepository } from "../../domain/repositories/purchase.repository";
import {
  purchases,
  purchaseItems,
  supplierProductMappings,
  supplierDebts,
  PurchaseRow,
  PurchaseItemRow,
  SupplierProductMappingRow,
  SupplierDebtRow,
} from "../database/schema/purchasing.schema";

export class DrizzlePurchaseRepository implements PurchaseRepository {
  constructor(private readonly db: AppDatabase) {}

  public async findPurchaseById(id: string): Promise<Purchase | null> {
    const rows = await this.db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;

    const itemRows = await this.db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseId, id));

    return this.toPurchaseDomain(row, itemRows);
  }

  public async findPurchaseBySupplierAndInvoice(
    supplierId: string,
    invoiceNumber: string
  ): Promise<Purchase | null> {
    const rows = await this.db
      .select()
      .from(purchases)
      .where(and(eq(purchases.supplierId, supplierId), eq(purchases.invoiceNumber, invoiceNumber)))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const itemRows = await this.db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseId, row.id));

    return this.toPurchaseDomain(row, itemRows);
  }

  public async savePurchase(purchase: Purchase): Promise<void> {
    const existing = await this.db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchase.getId()))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(purchases)
        .set({
          supplierId: purchase.getSupplierId(),
          warehouseId: purchase.getWarehouseId(),
          invoiceNumber: purchase.getInvoiceNumber(),
          authorizationNumber: purchase.getAuthorizationNumber(),
          emissionDate: purchase.getEmissionDate(),
          subtotal0Cents: purchase.getSubtotal0().toCents(),
          subtotal15Cents: purchase.getSubtotal15().toCents(),
          totalDiscountCents: purchase.getTotalDiscount().toCents(),
          totalIvaCents: purchase.getTotalIva().toCents(),
          totalAmountCents: purchase.getTotalAmount().toCents(),
          status: purchase.getStatus() as PurchaseRow["status"],
          xmlFilePath: purchase.getXmlFilePath(),
          updatedAt: purchase.getUpdatedAt(),
        })
        .where(eq(purchases.id, purchase.getId()));
    } else {
      await this.db.insert(purchases).values({
        id: purchase.getId(),
        supplierId: purchase.getSupplierId(),
        warehouseId: purchase.getWarehouseId(),
        invoiceNumber: purchase.getInvoiceNumber(),
        authorizationNumber: purchase.getAuthorizationNumber(),
        emissionDate: purchase.getEmissionDate(),
        subtotal0Cents: purchase.getSubtotal0().toCents(),
        subtotal15Cents: purchase.getSubtotal15().toCents(),
        totalDiscountCents: purchase.getTotalDiscount().toCents(),
        totalIvaCents: purchase.getTotalIva().toCents(),
        totalAmountCents: purchase.getTotalAmount().toCents(),
        status: purchase.getStatus() as PurchaseRow["status"],
        xmlFilePath: purchase.getXmlFilePath(),
        createdAt: purchase.getCreatedAt(),
        updatedAt: purchase.getUpdatedAt(),
      });
    }

    // Guardar / Reemplazar ítems
    await this.db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, purchase.getId()));

    for (const item of purchase.getItems()) {
      await this.db.insert(purchaseItems).values({
        id: item.getId(),
        purchaseId: purchase.getId(),
        productId: item.getProductId(),
        presentationId: item.getPresentationId(),
        supplierProductCode: item.getSupplierProductCode(),
        quantityBought: item.getQuantityBought().toString(),
        unitCostCents: item.getUnitCost().toCents(),
        taxRate: item.getTaxRate(),
        totalCents: item.getTotal().toCents(),
      });
    }
  }

  public async findMapping(
    supplierId: string,
    supplierCode: string
  ): Promise<SupplierProductMapping | null> {
    const rows = await this.db
      .select()
      .from(supplierProductMappings)
      .where(
        and(
          eq(supplierProductMappings.supplierId, supplierId),
          eq(supplierProductMappings.supplierCode, supplierCode)
        )
      )
      .limit(1);

    const row = rows[0];
    return row ? this.toMappingDomain(row) : null;
  }

  public async findMappingsBySupplier(supplierId: string): Promise<SupplierProductMapping[]> {
    const rows = await this.db
      .select()
      .from(supplierProductMappings)
      .where(eq(supplierProductMappings.supplierId, supplierId));

    return rows.map((r) => this.toMappingDomain(r));
  }

  public async saveMapping(mapping: SupplierProductMapping): Promise<void> {
    const existing = await this.findMapping(mapping.getSupplierId(), mapping.getSupplierCode());
    if (existing) {
      await this.db
        .update(supplierProductMappings)
        .set({
          productId: mapping.getProductId(),
          presentationId: mapping.getPresentationId(),
        })
        .where(
          and(
            eq(supplierProductMappings.supplierId, mapping.getSupplierId()),
            eq(supplierProductMappings.supplierCode, mapping.getSupplierCode())
          )
        );
    } else {
      await this.db.insert(supplierProductMappings).values({
        id: mapping.getId(),
        supplierId: mapping.getSupplierId(),
        supplierCode: mapping.getSupplierCode(),
        productId: mapping.getProductId(),
        presentationId: mapping.getPresentationId(),
        createdAt: mapping.getCreatedAt(),
      });
    }
  }

  public async findDebtByPurchaseId(purchaseId: string): Promise<SupplierDebt | null> {
    const rows = await this.db
      .select()
      .from(supplierDebts)
      .where(eq(supplierDebts.purchaseId, purchaseId))
      .limit(1);

    const row = rows[0];
    return row ? this.toDebtDomain(row) : null;
  }

  public async saveDebt(debt: SupplierDebt): Promise<void> {
    const existing = await this.db
      .select()
      .from(supplierDebts)
      .where(eq(supplierDebts.id, debt.getId()))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(supplierDebts)
        .set({
          dueDate: debt.getDueDate(),
          totalDebtCents: debt.getTotalDebt().toCents(),
          paidAmountCents: debt.getPaidAmount().toCents(),
          isSettled: debt.getIsSettled(),
          updatedAt: debt.getUpdatedAt(),
        })
        .where(eq(supplierDebts.id, debt.getId()));
    } else {
      await this.db.insert(supplierDebts).values({
        id: debt.getId(),
        purchaseId: debt.getPurchaseId(),
        supplierId: debt.getSupplierId(),
        dueDate: debt.getDueDate(),
        totalDebtCents: debt.getTotalDebt().toCents(),
        paidAmountCents: debt.getPaidAmount().toCents(),
        isSettled: debt.getIsSettled(),
        createdAt: debt.getCreatedAt(),
        updatedAt: debt.getUpdatedAt(),
      });
    }
  }

  public async listPendingDebts(supplierId?: string): Promise<SupplierDebt[]> {
    const query = this.db.select().from(supplierDebts).where(eq(supplierDebts.isSettled, false));

    const rows = supplierId
      ? await this.db
          .select()
          .from(supplierDebts)
          .where(and(eq(supplierDebts.isSettled, false), eq(supplierDebts.supplierId, supplierId)))
      : await query;

    return rows.map((r) => this.toDebtDomain(r));
  }

  private toPurchaseDomain(row: PurchaseRow, itemRows: PurchaseItemRow[]): Purchase {
    const items = itemRows.map(
      (ir) =>
        new PurchaseItem({
          id: ir.id,
          purchaseId: ir.purchaseId,
          productId: ir.productId,
          presentationId: ir.presentationId,
          supplierProductCode: ir.supplierProductCode ?? undefined,
          quantityBought: parseFloat(ir.quantityBought),
          unitCost: Money.fromCents(ir.unitCostCents),
          taxRate: ir.taxRate as TaxRate,
          total: Money.fromCents(ir.totalCents),
        })
    );

    return new Purchase({
      id: row.id,
      supplierId: row.supplierId,
      warehouseId: row.warehouseId,
      invoiceNumber: row.invoiceNumber,
      authorizationNumber: row.authorizationNumber ?? undefined,
      emissionDate: row.emissionDate,
      subtotal0: Money.fromCents(row.subtotal0Cents),
      subtotal15: Money.fromCents(row.subtotal15Cents),
      totalDiscount: Money.fromCents(row.totalDiscountCents),
      totalIva: Money.fromCents(row.totalIvaCents),
      totalAmount: Money.fromCents(row.totalAmountCents),
      status: row.status as PurchaseStatus,
      xmlFilePath: row.xmlFilePath ?? undefined,
      items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toMappingDomain(row: SupplierProductMappingRow): SupplierProductMapping {
    return new SupplierProductMapping({
      id: row.id,
      supplierId: row.supplierId,
      supplierCode: row.supplierCode,
      productId: row.productId,
      presentationId: row.presentationId,
      createdAt: row.createdAt,
    });
  }

  private toDebtDomain(row: SupplierDebtRow): SupplierDebt {
    return new SupplierDebt({
      id: row.id,
      purchaseId: row.purchaseId,
      supplierId: row.supplierId,
      dueDate: row.dueDate,
      totalDebt: Money.fromCents(row.totalDebtCents),
      paidAmount: Money.fromCents(row.paidAmountCents),
      isSettled: row.isSettled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
