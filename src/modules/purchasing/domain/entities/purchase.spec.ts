import { describe, it, expect } from "vitest";
import { generateUUIDv7, Money } from "@/modules/core/public-api";
import { Purchase } from "./purchase.entity";
import { PurchaseItem } from "./purchase-item.entity";

describe("Purchase Entity", () => {
  const supplierId = generateUUIDv7();
  const warehouseId = generateUUIDv7();

  it("debe crear una compra válida con formato oficial de factura SRI y calcular totales", () => {
    const purchaseId = generateUUIDv7();
    const item1 = PurchaseItem.create({
      id: generateUUIDv7(),
      purchaseId,
      productId: generateUUIDv7(),
      presentationId: generateUUIDv7(),
      supplierProductCode: "ART-101",
      quantityBought: 10,
      unitCost: Money.fromDollars(2.0), // $20.00
      taxRate: "IVA_15",
    });

    const item2 = PurchaseItem.create({
      id: generateUUIDv7(),
      purchaseId,
      productId: generateUUIDv7(),
      presentationId: generateUUIDv7(),
      supplierProductCode: "BOOK-202",
      quantityBought: 5,
      unitCost: Money.fromDollars(10.0), // $50.00
      taxRate: "IVA_0",
    });

    const purchase = Purchase.create({
      id: purchaseId,
      supplierId,
      warehouseId,
      invoiceNumber: "001-002-000012345",
      emissionDate: new Date(),
      items: [item1, item2],
    });

    expect(purchase.getStatus()).toBe("DRAFT");
    expect(purchase.getSubtotal15().toCents()).toBe(2000); // $20.00
    expect(purchase.getSubtotal0().toCents()).toBe(5000); // $50.00
    expect(purchase.getTotalIva().toCents()).toBe(300); // $3.00 (15% de 20.00)
    expect(purchase.getTotalAmount().toCents()).toBe(7300); // $73.00
  });

  it("debe rechazar números de factura con formato inválido", () => {
    expect(() =>
      Purchase.create({
        id: generateUUIDv7(),
        supplierId,
        warehouseId,
        invoiceNumber: "12345", // Formato incorrecto
        emissionDate: new Date(),
      })
    ).toThrowError("El número de factura debe tener el formato oficial del SRI '001-001-000000123'");
  });

  it("debe permitir confirmar la compra y evitar cancelaciones posteriores directas", () => {
    const purchaseId = generateUUIDv7();
    const item = PurchaseItem.create({
      id: generateUUIDv7(),
      purchaseId,
      productId: generateUUIDv7(),
      presentationId: generateUUIDv7(),
      quantityBought: 1,
      unitCost: Money.fromDollars(5.0),
      taxRate: "IVA_0",
    });

    const purchase = Purchase.create({
      id: purchaseId,
      supplierId,
      warehouseId,
      invoiceNumber: "001-001-000000999",
      emissionDate: new Date(),
      items: [item],
    });

    purchase.confirm();
    expect(purchase.getStatus()).toBe("CONFIRMED");

    expect(() => purchase.confirm()).toThrowError("Solo se pueden confirmar compras en estado DRAFT");
    expect(() => purchase.cancel()).toThrowError("No se puede cancelar directamente una compra ya confirmada");
  });
});
