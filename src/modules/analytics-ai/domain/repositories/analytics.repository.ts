export interface FinancialSummaryData {
  totalSalesCents: number;
  totalCogsCents: number; // Cost of goods sold (Costo de ventas PMP)
  grossProfitCents: number;
  profitMarginPercent: number; // Margen de ganancia bruto %
  salesCount: number;
  paymentMethodsBreakdown: Array<{
    method: string;
    totalCents: number;
    count: number;
  }>;
}

export interface SlowMovingItemData {
  productId: string;
  sku: string;
  productName: string;
  categoryName?: string;
  currentStockUnits: number;
  currentPmpCents: number;
  tiedCapitalCents: number;
  lastMovementDate: Date | null;
  daysInactive: number;
}

export interface ProductProfitabilityData {
  productId: string;
  sku: string;
  productName: string;
  categoryName?: string;
  unitsSold: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPercent: number;
}

export interface FilterDateParams {
  fromDate?: Date;
  toDate?: Date;
  warehouseId?: string;
}

export interface ProductStockInfoForAi {
  sku: string;
  name: string;
  category?: string;
  stockUnits: number;
  retailPriceCents: number;
  minUnit: string;
}

export interface AnalyticsRepository {
  getFinancialSummary(filters: FilterDateParams): Promise<FinancialSummaryData>;
  getSlowMovingInventory(
    minDaysInactive?: number,
    warehouseId?: string,
    limit?: number
  ): Promise<SlowMovingItemData[]>;
  getProductProfitability(
    filters: FilterDateParams,
    limit?: number,
    offset?: number
  ): Promise<ProductProfitabilityData[]>;
  getProductsInStockForAi(
    warehouseId?: string,
    limit?: number
  ): Promise<ProductStockInfoForAi[]>;
}
