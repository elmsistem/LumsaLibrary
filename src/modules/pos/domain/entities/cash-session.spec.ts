import { describe, it, expect } from "vitest";
import { CashSession } from "./cash-session.entity";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { generateUUIDv7 } from "../../../core/domain/value-objects/uuid.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

describe("CashSession (POS Shift & Blind Closing)", () => {
  const userId = generateUUIDv7();

  it("debe abrir un turno de caja correctamente con fondo inicial", () => {
    const session = CashSession.open({
      userId,
      terminalCode: "POS-01",
      establishmentCode: "001",
      emissionPointCode: "001",
      initialFloat: Money.fromDollars(50.0), // $50.00
    });

    expect(session.getId()).toBeDefined();
    expect(session.isOpen()).toBe(true);
    expect(session.getStatus()).toBe("OPEN");
    expect(session.getInitialFloat().getDollars()).toBe(50.0);
    expect(session.getTerminalCode()).toBe("POS-01");
  });

  it("debe realizar el cierre ciego y calcular discrepancias de sobrante (+)", () => {
    const session = CashSession.open({
      userId,
      terminalCode: "POS-01",
      initialFloat: Money.fromDollars(50.0),
    });

    // Esperado en sistema: $150.00 (Fondo $50 + Ventas $100)
    // Cajero declara en físico: $152.50
    // Sobrante: +$2.50
    session.closeBlind(Money.fromDollars(152.5), Money.fromDollars(150.0), "Arqueo de noche");

    expect(session.isOpen()).toBe(false);
    expect(session.getStatus()).toBe("CLOSED");
    expect(session.getDeclaredCash()!.getDollars()).toBe(152.5);
    expect(session.getExpectedCash()!.getDollars()).toBe(150.0);
    expect(session.getDiscrepancy()!.getDollars()).toBe(2.5);
    expect(session.getClosingTime()).toBeDefined();
    expect(session.getClosingNotes()).toBe("Arqueo de noche");
  });

  it("debe registrar faltante (-) cuando el dinero físico declarado es menor al esperado", () => {
    const session = CashSession.open({
      userId,
      terminalCode: "POS-01",
      initialFloat: Money.fromDollars(50.0),
    });

    // Esperado: $200.00
    // Cajero declara: $195.00
    // Faltante: -$5.00
    session.closeBlind(Money.fromDollars(195.0), Money.fromDollars(200.0));

    expect(session.getDiscrepancy()!.getDollars()).toBe(-5.0);
    expect(session.getDiscrepancy()!.isNegative()).toBe(true);
  });

  it("debe rechazar cerrar una sesión que ya ha sido cerrada", () => {
    const session = CashSession.open({
      userId,
      terminalCode: "POS-01",
      initialFloat: Money.fromDollars(50.0),
    });

    session.closeBlind(Money.fromDollars(50.0), Money.fromDollars(50.0));

    expect(() =>
      session.closeBlind(Money.fromDollars(50.0), Money.fromDollars(50.0))
    ).toThrow(ValidationError);
  });
});
