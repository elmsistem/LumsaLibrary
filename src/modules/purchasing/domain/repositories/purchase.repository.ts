import { Purchase } from "../entities/purchase.entity";
import { SupplierProductMapping } from "../entities/supplier-product-mapping.entity";
import { SupplierDebt } from "../entities/supplier-debt.entity";

export interface PurchaseRepository {
  findPurchaseById(id: string): Promise<Purchase | null>;
  findPurchaseBySupplierAndInvoice(supplierId: string, invoiceNumber: string): Promise<Purchase | null>;
  savePurchase(purchase: Purchase): Promise<void>;
  
  findMapping(supplierId: string, supplierCode: string): Promise<SupplierProductMapping | null>;
  findMappingsBySupplier(supplierId: string): Promise<SupplierProductMapping[]>;
  saveMapping(mapping: SupplierProductMapping): Promise<void>;

  findDebtByPurchaseId(purchaseId: string): Promise<SupplierDebt | null>;
  saveDebt(debt: SupplierDebt): Promise<void>;
  listPendingDebts(supplierId?: string): Promise<SupplierDebt[]>;
}
