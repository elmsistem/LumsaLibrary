import { eq, and, gte, lte, sql } from "drizzle-orm";
import { AppDatabase } from "@/modules/core/public-api";
import {
  saleOrders,
  saleOrderItems,
  salePayments,
} from "@/modules/pos/public-api";
import {
  inventoryMovements,
  inventoryBalances,
} from "@/modules/inventory/public-api";
import {
  products,
  categories,
  productPresentations,
} from "@/modules/catalog/public-api";
import {
  AnalyticsRepository,
  FinancialSummaryData,
  SlowMovingItemData,
  ProductProfitabilityData,
  FilterDateParams,
  ProductStockInfoForAi,
} from "../../domain/repositories/analytics.repository";

export class DrizzleAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: AppDatabase) {}

  public async getFinancialSummary(filters: FilterDateParams): Promise<FinancialSummaryData> {
    const orderConditions = [];
    if (filters.fromDate) {
      orderConditions.push(gte(saleOrders.createdAt, filters.fromDate));
    }
    if (filters.toDate) {
      orderConditions.push(lte(saleOrders.createdAt, filters.toDate));
    }
    if (filters.warehouseId) {
      orderConditions.push(eq(saleOrders.warehouseId, filters.warehouseId));
    }

    const orderWhere = orderConditions.length > 0 ? and(...orderConditions) : undefined;

    // 1. Total ventas
    const salesAgg = await this.db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${saleOrders.totalAmountCents}), 0)`,
        count: sql<number>`COUNT(${saleOrders.id})`,
      })
      .from(saleOrders)
      .where(orderWhere);

    const totalSalesCents = Number(salesAgg[0]?.totalSales ?? 0);
    const salesCount = Number(salesAgg[0]?.count ?? 0);

    // 2. Costo de mercancía vendida (COGS) desde movimientos inmutables de Kardex
    const movementConditions = [eq(inventoryMovements.movementType, "SALE_EXIT")];
    if (filters.fromDate) {
      movementConditions.push(gte(inventoryMovements.createdAt, filters.fromDate));
    }
    if (filters.toDate) {
      movementConditions.push(lte(inventoryMovements.createdAt, filters.toDate));
    }
    if (filters.warehouseId) {
      movementConditions.push(eq(inventoryMovements.warehouseId, filters.warehouseId));
    }

    const cogsAgg = await this.db
      .select({
        totalCogs: sql<number>`COALESCE(SUM(${inventoryMovements.quantityUnits} * ${inventoryMovements.unitCostCents}), 0)`,
      })
      .from(inventoryMovements)
      .where(and(...movementConditions));

    const totalCogsCents = Number(cogsAgg[0]?.totalCogs ?? 0);
    const grossProfitCents = totalSalesCents - totalCogsCents;
    const profitMarginPercent =
      totalSalesCents > 0
        ? Number(((grossProfitCents / totalSalesCents) * 100).toFixed(2))
        : 0;

    // 3. Desglose de pagos por método
    const paymentsBreakdown = await this.db
      .select({
        method: salePayments.paymentMethod,
        totalCents: sql<number>`COALESCE(SUM(${salePayments.amountCents}), 0)`,
        count: sql<number>`COUNT(${salePayments.id})`,
      })
      .from(salePayments)
      .innerJoin(saleOrders, eq(salePayments.saleOrderId, saleOrders.id))
      .where(orderWhere)
      .groupBy(salePayments.paymentMethod);

    return {
      totalSalesCents,
      totalCogsCents,
      grossProfitCents,
      profitMarginPercent,
      salesCount,
      paymentMethodsBreakdown: paymentsBreakdown.map((p) => ({
        method: p.method,
        totalCents: Number(p.totalCents),
        count: Number(p.count),
      })),
    };
  }

  public async getSlowMovingInventory(
    minDaysInactive = 90,
    warehouseId?: string,
    limit = 50
  ): Promise<SlowMovingItemData[]> {
    const conditions = [
      sql`${inventoryBalances.currentStockUnits} > 0`,
      eq(products.isService, false),
    ];

    if (warehouseId) {
      conditions.push(eq(inventoryBalances.warehouseId, warehouseId));
    }

    const rows = await this.db
      .select({
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        categoryName: categories.name,
        currentStockUnits: inventoryBalances.currentStockUnits,
        currentPmpCents: inventoryBalances.currentPmpCents,
        tiedCapitalCents: sql<number>`${inventoryBalances.currentStockUnits} * ${inventoryBalances.currentPmpCents}`,
        lastMovementDate: sql<string>`MAX(${inventoryMovements.createdAt})`,
        daysInactive: sql<number>`EXTRACT(DAY FROM (NOW() - COALESCE(MAX(${inventoryMovements.createdAt}), ${products.createdAt})))`,
      })
      .from(products)
      .innerJoin(inventoryBalances, eq(products.id, inventoryBalances.productId))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(inventoryMovements, eq(products.id, inventoryMovements.productId))
      .where(and(...conditions))
      .groupBy(
        products.id,
        products.sku,
        products.name,
        categories.name,
        inventoryBalances.currentStockUnits,
        inventoryBalances.currentPmpCents,
        products.createdAt
      )
      .having(
        sql`EXTRACT(DAY FROM (NOW() - COALESCE(MAX(${inventoryMovements.createdAt}), ${products.createdAt}))) >= ${minDaysInactive}`
      )
      .orderBy(sql`${inventoryBalances.currentStockUnits} * ${inventoryBalances.currentPmpCents} DESC`)
      .limit(limit);

    return rows.map((r) => ({
      productId: r.productId,
      sku: r.sku,
      productName: r.productName,
      categoryName: r.categoryName ?? undefined,
      currentStockUnits: Number(r.currentStockUnits),
      currentPmpCents: Number(r.currentPmpCents),
      tiedCapitalCents: Number(r.tiedCapitalCents),
      lastMovementDate: r.lastMovementDate ? new Date(r.lastMovementDate) : null,
      daysInactive: Math.max(0, Math.floor(Number(r.daysInactive) || 0)),
    }));
  }

  public async getProductProfitability(
    filters: FilterDateParams,
    limit = 50,
    offset = 0
  ): Promise<ProductProfitabilityData[]> {
    const orderConditions = [];
    if (filters.fromDate) {
      orderConditions.push(gte(saleOrders.createdAt, filters.fromDate));
    }
    if (filters.toDate) {
      orderConditions.push(lte(saleOrders.createdAt, filters.toDate));
    }
    if (filters.warehouseId) {
      orderConditions.push(eq(saleOrders.warehouseId, filters.warehouseId));
    }

    const orderWhere = orderConditions.length > 0 ? and(...orderConditions) : undefined;

    const rows = await this.db
      .select({
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        categoryName: categories.name,
        unitsSold: sql<number>`COALESCE(SUM(${saleOrderItems.quantity}), 0)`,
        revenueCents: sql<number>`COALESCE(SUM(${saleOrderItems.totalCents}), 0)`,
      })
      .from(saleOrderItems)
      .innerJoin(products, eq(saleOrderItems.productId, products.id))
      .innerJoin(saleOrders, eq(saleOrderItems.saleOrderId, saleOrders.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(orderWhere)
      .groupBy(products.id, products.sku, products.name, categories.name)
      .orderBy(sql`SUM(${saleOrderItems.totalCents}) DESC`)
      .limit(limit)
      .offset(offset);

    // Obtener costo de ventas por producto
    const result: ProductProfitabilityData[] = [];
    for (const r of rows) {
      const cogsRow = await this.db
        .select({
          totalCost: sql<number>`COALESCE(SUM(${inventoryMovements.quantityUnits} * ${inventoryMovements.unitCostCents}), 0)`,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.productId, r.productId),
            eq(inventoryMovements.movementType, "SALE_EXIT"),
            filters.fromDate ? gte(inventoryMovements.createdAt, filters.fromDate) : undefined,
            filters.toDate ? lte(inventoryMovements.createdAt, filters.toDate) : undefined
          )
        );

      const costCents = Number(cogsRow[0]?.totalCost ?? 0);
      const revenueCents = Number(r.revenueCents);
      const profitCents = revenueCents - costCents;
      const marginPercent =
        revenueCents > 0
          ? Number(((profitCents / revenueCents) * 100).toFixed(2))
          : 0;

      result.push({
        productId: r.productId,
        sku: r.sku,
        productName: r.productName,
        categoryName: r.categoryName ?? undefined,
        unitsSold: Number(r.unitsSold),
        revenueCents,
        costCents,
        profitCents,
        marginPercent,
      });
    }

    return result;
  }

  public async getProductsInStockForAi(
    warehouseId?: string,
    limit = 100
  ): Promise<ProductStockInfoForAi[]> {
    const conditions = [
      sql`${inventoryBalances.currentStockUnits} > 0`,
      eq(products.isActive, true),
    ];

    if (warehouseId) {
      conditions.push(eq(inventoryBalances.warehouseId, warehouseId));
    }

    const rows = await this.db
      .select({
        sku: products.sku,
        name: products.name,
        category: categories.name,
        stockUnits: inventoryBalances.currentStockUnits,
        retailPriceCents: productPresentations.retailPriceCents,
        minUnit: products.minUnit,
      })
      .from(products)
      .innerJoin(inventoryBalances, eq(products.id, inventoryBalances.productId))
      .innerJoin(productPresentations, eq(products.id, productPresentations.productId))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions, eq(productPresentations.isDefault, true)))
      .limit(limit);

    return rows.map((r) => ({
      sku: r.sku,
      name: r.name,
      category: r.category ?? undefined,
      stockUnits: Number(r.stockUnits),
      retailPriceCents: Number(r.retailPriceCents),
      minUnit: r.minUnit,
    }));
  }
}
