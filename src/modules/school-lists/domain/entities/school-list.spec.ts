import { describe, it, expect } from "vitest";
import { SchoolList } from "./school-list.entity";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

describe("SchoolList Domain Entity (Temporadas Costa/Sierra)", () => {
  const institutionId = generateUUIDv7();

  it("debe crear una lista escolar en estado DRAFT", () => {
    const list = SchoolList.create({
      institutionId,
      gradeLevel: "5to de Básica",
      academicYear: "2026-2027",
      studentName: "Santiago Morales",
      notes: "Lista oficial aprobada por el plantel",
    });

    expect(list.getId()).toBeDefined();
    expect(list.getStatus()).toBe("DRAFT");
    expect(list.getTotalQuoted().toDecimal()).toBe(0);
    expect(list.getAdvancePayment().toDecimal()).toBe(0);
    expect(list.getPendingBalance().toDecimal()).toBe(0);
  });

  it("debe realizar la cotización y cambiar a estado QUOTED", () => {
    const list = SchoolList.create({
      gradeLevel: "1ro de Bachillerato",
      academicYear: "2026-2027",
    });

    list.quote(
      [
        {
          productId: generateUUIDv7(),
          presentationId: generateUUIDv7(),
          quantity: 3,
          unitPrice: Money.fromDollars(2.5),
          isReserved: false,
          isDelivered: false,
        },
      ],
      Money.fromDollars(7.5)
    );

    expect(list.getStatus()).toBe("QUOTED");
    expect(list.getTotalQuoted().toDecimal()).toBe(7.5);
    expect(list.getItems().length).toBe(1);
    expect(list.getPendingBalance().toDecimal()).toBe(7.5);
  });

  it("debe registrar anticipos y pasar a RESERVED con ítems reservados", () => {
    const list = SchoolList.create({
      gradeLevel: "6to de Básica",
      academicYear: "2026-2027",
    });

    list.quote(
      [
        {
          productId: generateUUIDv7(),
          presentationId: generateUUIDv7(),
          quantity: 10,
          unitPrice: Money.fromDollars(3.0),
          isReserved: false,
          isDelivered: false,
        },
      ],
      Money.fromDollars(30.0)
    );

    // Abono de $10.00
    list.reserve(Money.fromDollars(10.0));

    expect(list.getStatus()).toBe("RESERVED");
    expect(list.getAdvancePayment().toDecimal()).toBe(10.0);
    expect(list.getPendingBalance().toDecimal()).toBe(20.0);
    expect(list.getItems()[0]!.isReserved).toBe(true);
  });

  it("debe marcar como DISPATCHED y entregar los ítems", () => {
    const list = SchoolList.create({
      gradeLevel: "3ro de Básica",
      academicYear: "2026-2027",
    });

    list.quote(
      [
        {
          productId: generateUUIDv7(),
          presentationId: generateUUIDv7(),
          quantity: 1,
          unitPrice: Money.fromDollars(15.0),
          isReserved: false,
          isDelivered: false,
        },
      ],
      Money.fromDollars(15.0)
    );

    list.dispatch();

    expect(list.getStatus()).toBe("DISPATCHED");
    expect(list.getItems()[0]!.isDelivered).toBe(true);

    // No se puede cancelar una lista despachada
    expect(() => list.cancel()).toThrow(ValidationError);
  });
});
