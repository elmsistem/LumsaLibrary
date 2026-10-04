import { describe, it, expect } from "vitest";
import { Money } from "@/modules/core/public-api";
import { Product } from "./product.entity";
import { ProductPresentation } from "./product-presentation.entity";

describe("Catalog Entities: Product & ProductPresentation", () => {
  it("debe crear un producto y calcular unidades fraccionadas exactamente", () => {
    const product = new Product({
      id: "prod-1",
      sku: "PAP-001",
      name: "Esfero Bic Cristal Azul",
      categoryId: "cat-1",
      minUnit: "UNIDAD",
    });

    const unidad = new ProductPresentation({
      id: "pres-1",
      productId: "prod-1",
      name: "Unidad",
      conversionFactor: 1.0,
      retailPrice: Money.fromDecimal(0.5),
      wholesalePrice: Money.fromDecimal(0.4),
      minWholesaleQuantity: 12,
      isDefault: true,
    });

    const caja = new ProductPresentation({
      id: "pres-2",
      productId: "prod-1",
      name: "Caja x 50",
      conversionFactor: 50.0,
      retailPrice: Money.fromDecimal(20.0),
      wholesalePrice: Money.fromDecimal(18.0),
    });

    product.addPresentation(unidad);
    product.addPresentation(caja);

    // Vender 3 cajas debe equivaler a 150 unidades de inventario
    expect(product.calculateUnits("pres-2", 3)).toBe(150);

    // Vender 5 unidades debe equivaler a 5 unidades de inventario
    expect(product.calculateUnits("pres-1", 5)).toBe(5);
  });

  it("debe aplicar precio mayorista solo cuando se alcanza la cantidad mínima", () => {
    const pres = new ProductPresentation({
      id: "pres-1",
      productId: "prod-1",
      name: "Docena",
      conversionFactor: 12.0,
      retailPrice: Money.fromDecimal(6.0),
      wholesalePrice: Money.fromDecimal(5.0),
      minWholesaleQuantity: 3,
    });

    // 1 docena aplica precio minorista ($6.00)
    expect(pres.getPriceForQuantity(1).toDecimal()).toBe(6.0);

    // 3 docenas aplica precio mayorista ($5.00)
    expect(pres.getPriceForQuantity(3).toDecimal()).toBe(5.0);
  });

  it("debe rechazar presentaciones donde el precio mayorista sea superior al minorista", () => {
    expect(
      () =>
        new ProductPresentation({
          id: "pres-err",
          productId: "prod-1",
          name: "Error",
          conversionFactor: 1.0,
          retailPrice: Money.fromDecimal(2.0),
          wholesalePrice: Money.fromDecimal(2.5), // Inválido: mayor que retail
        })
    ).toThrow(/El precio mayorista/);
  });

  it("debe rechazar factores de conversión menores a 1.0", () => {
    expect(
      () =>
        new ProductPresentation({
          id: "pres-err",
          productId: "prod-1",
          name: "Error Factor",
          conversionFactor: 0.5, // Menor que 1.0
          retailPrice: Money.fromDecimal(1.0),
          wholesalePrice: Money.fromDecimal(1.0),
        })
    ).toThrow(/El factor de conversión debe ser mayor o igual a 1.0/);
  });
});
