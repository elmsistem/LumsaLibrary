import { describe, it, expect, beforeEach } from "vitest";
import { generateUUIDv7, Money } from "@/modules/core/public-api";
import { Product, ProductPresentation, CatalogRepository } from "@/modules/catalog/public-api";
import { Supplier, SupplierRepository } from "@/modules/stakeholders/public-api";
import {
  Warehouse,
  InventoryMovement,
  InventoryBalance,
  InventoryRepository,
} from "@/modules/inventory/public-api";
import { Purchase, PurchaseRepository, SupplierProductMapping, SupplierDebt } from "../../public-api";
import { ParseSupplierXmlInvoiceUseCase } from "./parse-supplier-xml-invoice.use-case";
import { ConfirmPurchaseUseCase } from "./confirm-purchase.use-case";

// --- Repositorios en Memoria ---
class InMemorySupplierRepository implements SupplierRepository {
  private suppliers: Map<string, Supplier> = new Map();

  async findById(id: string): Promise<Supplier | null> {
    return this.suppliers.get(id) || null;
  }

  async findByRuc(ruc: string): Promise<Supplier | null> {
    for (const sup of this.suppliers.values()) {
      if (sup.getRuc() === ruc) return sup;
    }
    return null;
  }

  async save(supplier: Supplier): Promise<void> {
    this.suppliers.set(supplier.getId(), supplier);
  }

  async listAll(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }
}

class InMemoryCatalogRepository implements CatalogRepository {
  private products: Map<string, Product> = new Map();

  async findProductById(id: string): Promise<Product | null> {
    return this.products.get(id) || null;
  }

  async findProductBySku(sku: string): Promise<Product | null> {
    for (const prod of this.products.values()) {
      if (prod.getSku() === sku) return prod;
    }
    return null;
  }

  async findProductByBarcode(barcode: string): Promise<Product | null> {
    for (const prod of this.products.values()) {
      for (const pres of prod.getPresentations()) {
        if (pres.getBarcode() === barcode) return prod;
      }
    }
    return null;
  }

  async saveProduct(product: Product): Promise<void> {
    this.products.set(product.getId(), product);
  }

  async searchProducts(query: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) =>
      p.getName().toLowerCase().includes(query.toLowerCase())
    );
  }
}

class InMemoryInventoryRepository implements InventoryRepository {
  private warehouses: Map<string, Warehouse> = new Map();
  private balances: Map<string, InventoryBalance> = new Map();
  public movements: InventoryMovement[] = [];

  private balanceKey(warehouseId: string, productId: string): string {
    return `${warehouseId}:${productId}`;
  }

  async findWarehouseById(id: string): Promise<Warehouse | null> {
    return this.warehouses.get(id) || null;
  }

  async findWarehouseByCode(code: string): Promise<Warehouse | null> {
    for (const w of this.warehouses.values()) {
      if (w.getCode() === code) return w;
    }
    return null;
  }

  async saveWarehouse(w: Warehouse): Promise<void> {
    this.warehouses.set(w.getId(), w);
  }

  async listWarehouses(): Promise<Warehouse[]> {
    return Array.from(this.warehouses.values());
  }

  async getBalance(warehouseId: string, productId: string): Promise<InventoryBalance | null> {
    return this.balances.get(this.balanceKey(warehouseId, productId)) || null;
  }

  async getBalanceForUpdate(warehouseId: string, productId: string): Promise<InventoryBalance | null> {
    return this.balances.get(this.balanceKey(warehouseId, productId)) || null;
  }

  async recordMovementAndUpdateBalance(
    movement: InventoryMovement,
    balance: InventoryBalance
  ): Promise<void> {
    this.movements.push(movement);
    this.balances.set(this.balanceKey(balance.getWarehouseId(), balance.getProductId()), balance);
  }

  async findMovementById(id: string): Promise<InventoryMovement | null> {
    return this.movements.find((m) => m.getId() === id) || null;
  }

  async findMovementsByProduct(warehouseId: string, productId: string): Promise<InventoryMovement[]> {
    return this.movements.filter(
      (m) => m.getWarehouseId() === warehouseId && m.getProductId() === productId
    );
  }

  async findBalance(warehouseId: string, productId: string): Promise<InventoryBalance | null> {
    return this.balances.get(this.balanceKey(warehouseId, productId)) || null;
  }

  async getKardexHistory(): Promise<InventoryMovement[]> {
    return this.movements;
  }

  async countKardexHistory(): Promise<number> {
    return this.movements.length;
  }
}

class InMemoryPurchaseRepository implements PurchaseRepository {
  private purchases: Map<string, Purchase> = new Map();
  private mappings: Map<string, SupplierProductMapping> = new Map();
  private debts: Map<string, SupplierDebt> = new Map();

  private mappingKey(supplierId: string, supplierCode: string): string {
    return `${supplierId}:${supplierCode}`;
  }

  async findPurchaseById(id: string): Promise<Purchase | null> {
    return this.purchases.get(id) || null;
  }

  async findPurchaseBySupplierAndInvoice(
    supplierId: string,
    invoiceNumber: string
  ): Promise<Purchase | null> {
    for (const p of this.purchases.values()) {
      if (p.getSupplierId() === supplierId && p.getInvoiceNumber() === invoiceNumber) {
        return p;
      }
    }
    return null;
  }

  async savePurchase(purchase: Purchase): Promise<void> {
    this.purchases.set(purchase.getId(), purchase);
  }

  async findMapping(
    supplierId: string,
    supplierCode: string
  ): Promise<SupplierProductMapping | null> {
    return this.mappings.get(this.mappingKey(supplierId, supplierCode)) || null;
  }

  async findMappingsBySupplier(supplierId: string): Promise<SupplierProductMapping[]> {
    return Array.from(this.mappings.values()).filter((m) => m.getSupplierId() === supplierId);
  }

  async saveMapping(mapping: SupplierProductMapping): Promise<void> {
    this.mappings.set(this.mappingKey(mapping.getSupplierId(), mapping.getSupplierCode()), mapping);
  }

  async findDebtByPurchaseId(purchaseId: string): Promise<SupplierDebt | null> {
    for (const d of this.debts.values()) {
      if (d.getPurchaseId() === purchaseId) return d;
    }
    return null;
  }

  async saveDebt(debt: SupplierDebt): Promise<void> {
    this.debts.set(debt.getId(), debt);
  }

  async listPendingDebts(supplierId?: string): Promise<SupplierDebt[]> {
    const list = Array.from(this.debts.values()).filter((d) => !d.getIsSettled());
    return supplierId ? list.filter((d) => d.getSupplierId() === supplierId) : list;
  }
}

describe("Purchasing Module Use Cases", () => {
  let supplierRepo: InMemorySupplierRepository;
  let catalogRepo: InMemoryCatalogRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let purchaseRepo: InMemoryPurchaseRepository;

  let parseXmlUseCase: ParseSupplierXmlInvoiceUseCase;
  let confirmPurchaseUseCase: ConfirmPurchaseUseCase;

  let supplier: Supplier;
  let warehouse: Warehouse;
  let productCuaderno: Product;
  let presUnidad: ProductPresentation;
  let presCaja12: ProductPresentation;

  const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>FABER CASTELL ECUADOR S.A.</razonSocial>
    <nombreComercial>FABER CASTELL</nombreComercial>
    <ruc>1790016927001</ruc>
    <claveAcceso>0110202601179001122300120010010000004561234567812</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000000456</secuencial>
    <dirMatriz>Av. de los Granados 500</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>01/10/2026</fechaEmision>
    <dirEstablecimiento>Av. de los Granados 500</dirEstablecimiento>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>LUMSA LIBRARY CIA. LTDA.</razonSocialComprador>
    <identificacionComprador>1792003004001</identificacionComprador>
    <totalSinImpuestos>120.00</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>120.00</baseImponible>
        <valor>18.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <importeTotal>138.00</importeTotal>
  </infoFactura>
  <detalles>
    <detalle>
      <codigoPrincipal>7861001234567</codigoPrincipal>
      <descripcion>CUADERNO GRAPA 100H NORMA</descripcion>
      <cantidad>10.00</cantidad>
      <precioUnitario>12.00</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>120.00</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>15.00</tarifa>
          <baseImponible>120.00</baseImponible>
          <valor>18.00</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>
</factura>`;

  beforeEach(async () => {
    supplierRepo = new InMemorySupplierRepository();
    catalogRepo = new InMemoryCatalogRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    purchaseRepo = new InMemoryPurchaseRepository();

    parseXmlUseCase = new ParseSupplierXmlInvoiceUseCase(
      supplierRepo,
      catalogRepo,
      purchaseRepo
    );

    confirmPurchaseUseCase = new ConfirmPurchaseUseCase(
      purchaseRepo,
      supplierRepo,
      catalogRepo,
      inventoryRepo
    );

    // 1. Proveedor
    supplier = Supplier.create({
      id: generateUUIDv7(),
      ruc: "1790016927001",
      legalName: "FABER CASTELL ECUADOR S.A.",
      commercialName: "FABER CASTELL",
      creditDays: 30, // 30 días de crédito
    });
    await supplierRepo.save(supplier);

    // 2. Almacén
    warehouse = Warehouse.create({
      id: generateUUIDv7(),
      code: "BOD-CENTRAL",
      name: "Bodega Matriz",
    });
    await inventoryRepo.saveWarehouse(warehouse);

    // 3. Catálogo: Cuaderno con presentación Unidad y Caja x 12
    const prodId = generateUUIDv7();
    productCuaderno = Product.create({
      id: prodId,
      sku: "CUA-GRAPA-100",
      name: "Cuaderno Grapa 100 Hojas",
      categoryId: generateUUIDv7(),
      taxRate: "IVA_15",
      minUnit: "UNIDAD",
    });

    presUnidad = ProductPresentation.create({
      id: generateUUIDv7(),
      productId: prodId,
      name: "Unidad",
      conversionFactor: 1,
      barcode: "7861001234567", // Coincide con el código del XML
      retailPrice: Money.fromDollars(1.5),
      wholesalePrice: Money.fromDollars(1.2),
      isDefault: true,
    });

    presCaja12 = ProductPresentation.create({
      id: generateUUIDv7(),
      productId: prodId,
      name: "Caja x 12",
      conversionFactor: 12,
      barcode: "7861009999999",
      retailPrice: Money.fromDollars(15.0),
      wholesalePrice: Money.fromDollars(13.0),
      isDefault: false,
    });

    productCuaderno.addPresentation(presUnidad);
    productCuaderno.addPresentation(presCaja12);
    await catalogRepo.saveProduct(productCuaderno);
  });

  it("ParseSupplierXmlInvoiceUseCase debe leer la factura y vincular el producto por código de barras", async () => {
    const result = await parseXmlUseCase.execute({ xmlContent: validXml });

    expect(result.supplier.existsInSystem).toBe(true);
    expect(result.supplier.existingSupplierId).toBe(supplier.getId());
    expect(result.supplier.creditDays).toBe(30);
    expect(result.invoice.invoiceNumber).toBe("001-001-000000456");
    expect(result.alreadyRegistered).toBe(false);

    expect(result.items).toHaveLength(1);
    const [item] = result.items;
    expect(item?.isMatched).toBe(true);
    expect(item?.matchedProductId).toBe(productCuaderno.getId());
    expect(item?.matchedPresentationId).toBe(presUnidad.getId());
    expect(item?.conversionFactor).toBe(1);
    expect(item?.unitPriceCents).toBe(1200); // $12.00
  });

  it("ConfirmPurchaseUseCase debe registrar la compra, actualizar el Kardex (PMP) y generar la cuenta por pagar", async () => {
    const confirmResult = await confirmPurchaseUseCase.execute({
      supplierId: supplier.getId(),
      warehouseId: warehouse.getId(),
      invoiceNumber: "001-001-000000456",
      emissionDate: new Date("2026-10-01"),
      creditDays: 30,
      items: [
        {
          productId: productCuaderno.getId(),
          presentationId: presCaja12.getId(), // Compramos 10 cajas de 12 unidades ($12.00 por caja)
          supplierProductCode: "7861001234567",
          quantityBought: 10,
          unitCostCents: 1200, // $12.00 por caja
          taxRate: "IVA_15",
          saveMapping: true,
        },
      ],
    });

    expect(confirmResult.status).toBe("CONFIRMED");
    expect(confirmResult.debtCreated).toBe(true);
    expect(confirmResult.itemsProcessed).toBe(1);

    // 1. Verificar Kardex: 10 cajas x factor 12 = 120 unidades ingresadas
    // Costo base por unidad = 1200 centavos / 12 = 100 centavos ($1.00 por unidad)
    expect(inventoryRepo.movements).toHaveLength(1);
    const [mov] = inventoryRepo.movements;
    expect(mov?.getMovementType()).toBe("PURCHASE_ENTRY");
    expect(mov?.getQuantityUnits()).toBe(120);
    expect(mov?.getUnitCost().toCents()).toBe(100);
    expect(mov?.getBalanceUnits()).toBe(120);
    expect(mov?.getAverageCost().toCents()).toBe(100);

    // 2. Verificar Balance Almacén
    const balance = await inventoryRepo.findBalance(warehouse.getId(), productCuaderno.getId());
    expect(balance).not.toBeNull();
    expect(balance!.getCurrentStockUnits()).toBe(120);
    expect(balance!.getCurrentPmp().toCents()).toBe(100);

    // 3. Verificar Compra en BD
    const savedPurchase = await purchaseRepo.findPurchaseById(confirmResult.purchaseId);
    expect(savedPurchase).not.toBeNull();
    expect(savedPurchase!.getStatus()).toBe("CONFIRMED");

    // 4. Verificar Deuda a Proveedor
    const debt = await purchaseRepo.findDebtByPurchaseId(confirmResult.purchaseId);
    expect(debt).not.toBeNull();
    expect(debt!.getTotalDebt().toCents()).toBe(savedPurchase!.getTotalAmount().toCents());
    expect(debt!.getIsSettled()).toBe(false);

    // 5. Verificar Mapeo Memorizado
    const mapping = await purchaseRepo.findMapping(supplier.getId(), "7861001234567");
    expect(mapping).not.toBeNull();
    expect(mapping!.getProductId()).toBe(productCuaderno.getId());
  });

  it("ConfirmPurchaseUseCase debe impedir compras duplicadas con la misma factura del proveedor", async () => {
    await confirmPurchaseUseCase.execute({
      supplierId: supplier.getId(),
      warehouseId: warehouse.getId(),
      invoiceNumber: "001-001-000000456",
      emissionDate: new Date("2026-10-01"),
      items: [
        {
          productId: productCuaderno.getId(),
          presentationId: presUnidad.getId(),
          quantityBought: 5,
          unitCostCents: 100,
          taxRate: "IVA_15",
        },
      ],
    });

    // Intentar registrar la misma factura de nuevo
    await expect(
      confirmPurchaseUseCase.execute({
        supplierId: supplier.getId(),
        warehouseId: warehouse.getId(),
        invoiceNumber: "001-001-000000456",
        emissionDate: new Date("2026-10-01"),
        items: [
          {
            productId: productCuaderno.getId(),
            presentationId: presUnidad.getId(),
            quantityBought: 5,
            unitCostCents: 100,
            taxRate: "IVA_15",
          },
        ],
      })
    ).rejects.toThrowError("ya fue registrada previamente en el sistema");
  });
});
