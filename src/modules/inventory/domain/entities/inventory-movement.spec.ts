import { describe, it, expect } from "vitest";
import { InventoryMovement } from "./inventory-movement.entity";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

describe("InventoryMovement (Kardex Ledger Entity)", () => {
  const warehouseId = generateUUIDv7();
  const productId = generateUUIDv7();

  it("debe crear un movimiento de entrada de compra válido", () => {
    const movement = InventoryMovement.create({
      warehouseId,
      productId,
      movementType: "PURCHASE_ENTRY",
      quantityUnits: 25,
      unitCost: Money.fromDollars(1.5),
      averageCost: Money.fromDollars(1.5),
      balanceUnits: 25,
      referenceCode: "FAC-001-002-12345",
      notes: "Compra a Proveedor Papelera Nacional",
    });

    expect(movement.getId()).toBeDefined();
    expect(movement.getWarehouseId()).toBe(warehouseId);
    expect(movement.getProductId()).toBe(productId);
    expect(movement.getMovementType()).toBe("PURCHASE_ENTRY");
    expect(movement.getQuantityUnits()).toBe(25);
    expect(movement.isEntry()).toBe(true);
    expect(movement.isExit()).toBe(false);
    expect(movement.getBalanceUnits()).toBe(25);
    expect(movement.getUnitCost().getDollars()).toBe(1.5);
  });

  it("debe crear un movimiento de salida por venta con cantidad negativa", () => {
    const movement = InventoryMovement.create({
      warehouseId,
      productId,
      movementType: "SALE_EXIT",
      quantityUnits: -5,
      unitCost: Money.fromDollars(1.5),
      averageCost: Money.fromDollars(1.5),
      balanceUnits: 20,
      referenceCode: "VTA-001-001-000000010",
    });

    expect(movement.getQuantityUnits()).toBe(-5);
    expect(movement.isExit()).toBe(true);
    expect(movement.isEntry()).toBe(false);
    expect(movement.getBalanceUnits()).toBe(20);
  });

  it("debe lanzar ValidationError si la cantidad de unidades es cero", () => {
    expect(() =>
      InventoryMovement.create({
        warehouseId,
        productId,
        movementType: "PURCHASE_ENTRY",
        quantityUnits: 0,
        unitCost: Money.fromDollars(1.0),
        averageCost: Money.fromDollars(1.0),
        balanceUnits: 10,
      })
    ).toThrow(ValidationError);
  });

  it("debe rechazar saldo final negativo (invariante de no negatividad)", () => {
    expect(() =>
      InventoryMovement.create({
        warehouseId,
        productId,
        movementType: "SALE_EXIT",
        quantityUnits: -15,
        unitCost: Money.fromDollars(1.0),
        averageCost: Money.fromDollars(1.0),
        balanceUnits: -5, // Saldo negativo inválido
      })
    ).toThrow(ValidationError);
  });

  it("debe rechazar PURCHASE_ENTRY con cantidad negativa", () => {
    expect(() =>
      InventoryMovement.create({
        warehouseId,
        productId,
        movementType: "PURCHASE_ENTRY",
        quantityUnits: -10,
        unitCost: Money.fromDollars(1.0),
        averageCost: Money.fromDollars(1.0),
        balanceUnits: 10,
      })
    ).toThrow(/debe tener una cantidad positiva/);
  });

  it("debe rechazar SALE_EXIT con cantidad positiva", () => {
    expect(() =>
      InventoryMovement.create({
        warehouseId,
        productId,
        movementType: "SALE_EXIT",
        quantityUnits: 10,
        unitCost: Money.fromDollars(1.0),
        averageCost: Money.fromDollars(1.0),
        balanceUnits: 10,
      })
    ).toThrow(/debe tener una cantidad negativa/);
  });
});
