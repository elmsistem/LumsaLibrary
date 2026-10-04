import {
  generateUUIDv7,
  Money,
  ValidationError,
} from "@/modules/core/public-api";
import { TaxRate, CatalogRepository } from "@/modules/catalog/public-api";
import { SupplierRepository } from "@/modules/stakeholders/public-api";
import {
  InventoryRepository,
  RecordPurchaseEntryUseCase,
} from "@/modules/inventory/public-api";
import { Purchase } from "../../domain/entities/purchase.entity";
import { PurchaseItem } from "../../domain/entities/purchase-item.entity";
import { SupplierProductMapping } from "../../domain/entities/supplier-product-mapping.entity";
import { SupplierDebt } from "../../domain/entities/supplier-debt.entity";
import { PurchaseRepository } from "../../domain/repositories/purchase.repository";

export interface ConfirmPurchaseItemInput {
  productId: string;
  presentationId: string;
  supplierProductCode?: string;
  quantityBought: number;
  unitCostCents: number;
  taxRate: TaxRate;
  saveMapping?: boolean;
}

export interface ConfirmPurchaseInput {
  purchaseId?: string;
  supplierId: string;
  warehouseId: string;
  invoiceNumber: string; // 001-001-000000123
  authorizationNumber?: string;
  emissionDate: Date;
  creditDays?: number;
  items: ConfirmPurchaseItemInput[];
  xmlFilePath?: string;
  userId?: string;
}

export interface ConfirmPurchaseResult {
  purchaseId: string;
  invoiceNumber: string;
  status: "CONFIRMED";
  totalAmountCents: number;
  itemsProcessed: number;
  debtCreated: boolean;
  debtDueDate?: string;
}

/**
 * Caso de Uso: Confirmar Compra de Proveedor.
 * Orquesta la creación de la factura de compra, la entrada a Kardex (PMP) y la deuda comercial.
 */
export class ConfirmPurchaseUseCase {
  private readonly recordPurchaseEntryUseCase: RecordPurchaseEntryUseCase;

  constructor(
    private readonly purchaseRepo: PurchaseRepository,
    private readonly supplierRepo: SupplierRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly inventoryRepo: InventoryRepository
  ) {
    this.recordPurchaseEntryUseCase = new RecordPurchaseEntryUseCase(this.inventoryRepo);
  }

  public async execute(input: ConfirmPurchaseInput): Promise<ConfirmPurchaseResult> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError(
        "Debe proporcionar al menos un ítem para confirmar la compra.",
        "NO_PURCHASE_ITEMS"
      );
    }

    // 1. Validar existencia del proveedor
    const supplier = await this.supplierRepo.findById(input.supplierId);
    if (!supplier) {
      throw new ValidationError(
        `Proveedor con ID ${input.supplierId} no encontrado.`,
        "SUPPLIER_NOT_FOUND"
      );
    }

    // 2. Validar existencia del almacén
    const warehouse = await this.inventoryRepo.findWarehouseById(input.warehouseId);
    if (!warehouse) {
      throw new ValidationError(
        `Almacén con ID ${input.warehouseId} no encontrado.`,
        "WAREHOUSE_NOT_FOUND"
      );
    }

    // 3. Validar duplicidad de factura del proveedor
    const existingPurchase = await this.purchaseRepo.findPurchaseBySupplierAndInvoice(
      input.supplierId,
      input.invoiceNumber
    );
    if (existingPurchase) {
      throw new ValidationError(
        `La factura ${input.invoiceNumber} del proveedor ${supplier.getLegalName()} ya fue registrada previamente en el sistema.`,
        "DUPLICATE_PURCHASE_INVOICE"
      );
    }

    const purchaseId = input.purchaseId || generateUUIDv7();
    const domainItems: PurchaseItem[] = [];

    // 4. Procesar cada ítem y alimentar el Kardex con recálculo exacto del PMP
    for (const itemInput of input.items) {
      const product = await this.catalogRepo.findProductById(itemInput.productId);
      if (!product) {
        throw new ValidationError(
          `Producto con ID ${itemInput.productId} no encontrado en catálogo.`,
          "PRODUCT_NOT_FOUND"
        );
      }

      const presentation = product
        .getPresentations()
        .find((p) => p.getId() === itemInput.presentationId);

      if (!presentation) {
        throw new ValidationError(
          `Presentación con ID ${itemInput.presentationId} no encontrada para el producto "${product.getName()}".`,
          "PRESENTATION_NOT_FOUND"
        );
      }

      const unitCost = Money.fromCents(itemInput.unitCostCents);
      const conversionFactor = presentation.getConversionFactor();

      // Convertir unidades a unidad base del Kardex
      const baseUnits = Math.round(itemInput.quantityBought * conversionFactor);

      // Calcular costo unitario en unidad base para el Kardex
      const baseCostCents = Math.round(itemInput.unitCostCents / conversionFactor);

      const purchaseItem = PurchaseItem.create({
        id: generateUUIDv7(),
        purchaseId,
        productId: itemInput.productId,
        presentationId: itemInput.presentationId,
        supplierProductCode: itemInput.supplierProductCode,
        quantityBought: itemInput.quantityBought,
        unitCost,
        taxRate: itemInput.taxRate,
      });

      domainItems.push(purchaseItem);

      // Entrada oficial e inmutable al Kardex (actualiza stock y recalcula PMP)
      await this.recordPurchaseEntryUseCase.execute({
        warehouseId: input.warehouseId,
        productId: itemInput.productId,
        quantityUnits: baseUnits,
        unitCostCents: baseCostCents,
        referenceId: purchaseId,
        referenceCode: input.invoiceNumber,
        notes: `Compra Factura ${input.invoiceNumber} - Prov: ${supplier.getLegalName()}`,
        userId: input.userId,
      });

      // Si se solicitó memorizar el mapeo de código del proveedor
      if (itemInput.saveMapping && itemInput.supplierProductCode) {
        const mapping = SupplierProductMapping.create({
          id: generateUUIDv7(),
          supplierId: input.supplierId,
          supplierCode: itemInput.supplierProductCode,
          productId: itemInput.productId,
          presentationId: itemInput.presentationId,
        });
        await this.purchaseRepo.saveMapping(mapping);
      }
    }

    // 5. Crear y confirmar la compra
    const purchase = Purchase.create({
      id: purchaseId,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      invoiceNumber: input.invoiceNumber,
      authorizationNumber: input.authorizationNumber,
      emissionDate: input.emissionDate,
      xmlFilePath: input.xmlFilePath,
      items: domainItems,
    });

    purchase.confirm();
    await this.purchaseRepo.savePurchase(purchase);

    // 6. Cuentas por Pagar (días de crédito)
    const creditDays = input.creditDays ?? supplier.getCreditDays();
    let debtCreated = false;
    let debtDueDate: string | undefined;

    if (creditDays > 0) {
      const dueDate = new Date(input.emissionDate.getTime() + creditDays * 24 * 60 * 60 * 1000);
      const debt = SupplierDebt.create({
        id: generateUUIDv7(),
        purchaseId,
        supplierId: input.supplierId,
        dueDate,
        totalDebt: purchase.getTotalAmount(),
      });
      await this.purchaseRepo.saveDebt(debt);
      debtCreated = true;
      debtDueDate = dueDate.toISOString();
    }

    return {
      purchaseId,
      invoiceNumber: input.invoiceNumber,
      status: "CONFIRMED",
      totalAmountCents: purchase.getTotalAmount().toCents(),
      itemsProcessed: domainItems.length,
      debtCreated,
      debtDueDate,
    };
  }
}
