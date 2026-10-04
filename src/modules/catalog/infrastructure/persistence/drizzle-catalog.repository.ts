import { eq, ilike } from "drizzle-orm";
import { AppDatabase, Money } from "@/modules/core/public-api";
import { Product, TaxRate, UnitType } from "../../domain/entities/product.entity";
import { ProductPresentation } from "../../domain/entities/product-presentation.entity";
import { CatalogRepository } from "../../domain/repositories/catalog.repository";
import {
  products,
  productPresentations,
  ProductRow,
  ProductPresentationRow,
} from "../database/schema/catalog.schema";

export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(private readonly db: AppDatabase) {}

  public async findProductById(id: string): Promise<Product | null> {
    const pRows = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    const pRow = pRows[0];
    if (!pRow) return null;

    const presRows = await this.db
      .select()
      .from(productPresentations)
      .where(eq(productPresentations.productId, id));

    return this.toDomain(pRow, presRows);
  }

  public async findProductBySku(sku: string): Promise<Product | null> {
    const pRows = await this.db.select().from(products).where(eq(products.sku, sku)).limit(1);
    const pRow = pRows[0];
    if (!pRow) return null;

    const presRows = await this.db
      .select()
      .from(productPresentations)
      .where(eq(productPresentations.productId, pRow.id));

    return this.toDomain(pRow, presRows);
  }

  public async findProductByBarcode(barcode: string): Promise<Product | null> {
    // 1. Buscar coincidencia en producto base
    const pRows = await this.db
      .select()
      .from(products)
      .where(eq(products.barcode, barcode))
      .limit(1);

    if (pRows[0]) {
      const presRows = await this.db
        .select()
        .from(productPresentations)
        .where(eq(productPresentations.productId, pRows[0].id));
      return this.toDomain(pRows[0], presRows);
    }

    // 2. Buscar coincidencia en código de barras de alguna presentación (cajas, paquetes)
    const presMatch = await this.db
      .select()
      .from(productPresentations)
      .where(eq(productPresentations.barcode, barcode))
      .limit(1);

    if (presMatch[0]) {
      return this.findProductById(presMatch[0].productId);
    }

    return null;
  }

  public async saveProduct(product: Product): Promise<void> {
    const existing = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, product.getId()))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(products)
        .set({
          sku: product.getSku(),
          name: product.getName(),
          categoryId: product.getCategoryId(),
          brandId: product.getBrandId(),
          barcode: product.getBarcode(),
          description: product.getDescription(),
          taxRate: product.getTaxRate() as ProductRow["taxRate"],
          minUnit: product.getMinUnit() as ProductRow["minUnit"],
          isService: product.getIsService(),
          minStockAlert: product.getMinStockAlert().toString(),
          isActive: product.getIsActive(),
          updatedAt: new Date(),
        })
        .where(eq(products.id, product.getId()));
    } else {
      await this.db.insert(products).values({
        id: product.getId(),
        sku: product.getSku(),
        name: product.getName(),
        categoryId: product.getCategoryId(),
        brandId: product.getBrandId(),
        barcode: product.getBarcode(),
        description: product.getDescription(),
        taxRate: product.getTaxRate() as ProductRow["taxRate"],
        minUnit: product.getMinUnit() as ProductRow["minUnit"],
        isService: product.getIsService(),
        minStockAlert: product.getMinStockAlert().toString(),
        isActive: product.getIsActive(),
      });
    }

    // Guardar / actualizar presentaciones
    for (const pres of product.getPresentations()) {
      const presExists = await this.db
        .select({ id: productPresentations.id })
        .from(productPresentations)
        .where(eq(productPresentations.id, pres.getId()))
        .limit(1);

      if (presExists.length > 0) {
        await this.db
          .update(productPresentations)
          .set({
            name: pres.getName(),
            conversionFactor: pres.getConversionFactor().toString(),
            barcode: pres.getBarcode(),
            retailPriceCents: pres.getRetailPrice().toCents(),
            wholesalePriceCents: pres.getWholesalePrice().toCents(),
            minWholesaleQuantity: pres.getMinWholesaleQuantity(),
            isDefault: pres.getIsDefault(),
            isActive: pres.getIsActive(),
          })
          .where(eq(productPresentations.id, pres.getId()));
      } else {
        await this.db.insert(productPresentations).values({
          id: pres.getId(),
          productId: product.getId(),
          name: pres.getName(),
          conversionFactor: pres.getConversionFactor().toString(),
          barcode: pres.getBarcode(),
          retailPriceCents: pres.getRetailPrice().toCents(),
          wholesalePriceCents: pres.getWholesalePrice().toCents(),
          minWholesaleQuantity: pres.getMinWholesaleQuantity(),
          isDefault: pres.getIsDefault(),
          isActive: pres.getIsActive(),
        });
      }
    }
  }

  public async searchProducts(query: string, limit = 20): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(products)
      .where(ilike(products.name, `%${query}%`))
      .limit(limit);

    const result: Product[] = [];
    for (const r of rows) {
      const presRows = await this.db
        .select()
        .from(productPresentations)
        .where(eq(productPresentations.productId, r.id));
      result.push(this.toDomain(r, presRows));
    }
    return result;
  }

  private toDomain(pRow: ProductRow, presRows: ProductPresentationRow[]): Product {
    const presentations = presRows.map(
      (pr) =>
        new ProductPresentation({
          id: pr.id,
          productId: pr.productId,
          name: pr.name,
          conversionFactor: parseFloat(pr.conversionFactor),
          barcode: pr.barcode ?? undefined,
          retailPrice: Money.fromCents(pr.retailPriceCents),
          wholesalePrice: Money.fromCents(pr.wholesalePriceCents),
          minWholesaleQuantity: pr.minWholesaleQuantity,
          isDefault: pr.isDefault,
          isActive: pr.isActive,
        })
    );

    return new Product({
      id: pRow.id,
      sku: pRow.sku,
      name: pRow.name,
      categoryId: pRow.categoryId,
      brandId: pRow.brandId ?? undefined,
      barcode: pRow.barcode ?? undefined,
      description: pRow.description ?? undefined,
      taxRate: pRow.taxRate as TaxRate,
      minUnit: pRow.minUnit as UnitType,
      isService: pRow.isService,
      minStockAlert: parseFloat(pRow.minStockAlert),
      isActive: pRow.isActive,
      presentations,
    });
  }
}
