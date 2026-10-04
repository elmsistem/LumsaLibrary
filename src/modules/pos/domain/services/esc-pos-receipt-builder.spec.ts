import { describe, it, expect } from "vitest";
import { EscPosReceiptBuilder } from "./esc-pos-receipt-builder";

describe("EscPosReceiptBuilder (Thermal POS Printer Formatting)", () => {
  it("debe generar un ticket térmico de 80mm con encabezado, productos, totales y clave de acceso", () => {
    const text = EscPosReceiptBuilder.buildReceiptText({
      store: {
        legalName: "LUMSA LIBRARY CIA. LTDA.",
        tradeName: "LUMSA LIBRARY",
        ruc: "1790011223001",
        address: "Av. Amazonas y Colón, Quito",
        phone: "02-2554321",
        rimpeLegend: "CONTRIBUYENTE RÉGIMEN RIMPE",
      },
      customer: {
        name: "CARLOS ANDRADE",
        idNumber: "1712345678",
        idType: "05",
      },
      orderNumber: "VTA-2026-0000001",
      date: new Date(2026, 9, 3, 14, 30),
      items: [
        {
          quantity: 2,
          description: "Cuaderno espiral 100h",
          unitPriceDecimal: 2.5,
          totalDecimal: 5.0,
        },
        {
          quantity: 1,
          description: "Resma de papel bond A4",
          unitPriceDecimal: 4.5,
          totalDecimal: 4.5,
        },
      ],
      subtotal0Decimal: 0.0,
      subtotal15Decimal: 9.5,
      discountDecimal: 0.0,
      ivaDecimal: 1.43,
      totalDecimal: 10.93,
      changeDecimal: 4.07,
      payments: [
        {
          methodName: "EFECTIVO",
          amountDecimal: 15.0,
        },
      ],
      accessKey: "0310202601179001122300110010010000000011234567818",
      paperWidthMm: 80,
    });

    expect(text).toContain("LUMSA LIBRARY");
    expect(text).toContain("1790011223001");
    expect(text).toContain("CONTRIBUYENTE RÉGIMEN RIMPE");
    expect(text).toContain("VTA-2026-0000001");
    expect(text).toContain("CARLOS ANDRADE");
    expect(text).toContain("Cuaderno espiral 100h");
    expect(text).toContain("$10.93");
    expect(text).toContain("CAMBIO / VUELTO:");
    expect(text).toContain("$4.07");
    expect(text).toContain("0310202601179001122300110010010000000011234567818");
  });

  it("debe adaptarse a formato compacto de 58mm (32 columnas)", () => {
    const text = EscPosReceiptBuilder.buildReceiptText({
      store: {
        legalName: "LUMSA LIBRARY",
        tradeName: "LUMSA LIBRARY",
        ruc: "1790011223001",
        address: "Quito, Ecuador",
      },
      customer: {
        name: "CONSUMIDOR FINAL",
        idNumber: "9999999999999",
        idType: "07",
      },
      orderNumber: "VTA-001",
      date: new Date(2026, 9, 3),
      items: [
        {
          quantity: 1,
          description: "Borrador de queso",
          unitPriceDecimal: 0.35,
          totalDecimal: 0.35,
        },
      ],
      subtotal0Decimal: 0.0,
      subtotal15Decimal: 0.35,
      discountDecimal: 0.0,
      ivaDecimal: 0.05,
      totalDecimal: 0.4,
      changeDecimal: 0.6,
      payments: [{ methodName: "EFECTIVO", amountDecimal: 1.0 }],
      paperWidthMm: 58,
    });

    expect(text).toContain("VTA-001");
    expect(text).toContain("Borrador de queso");
    expect(text).toContain("$0.40");
  });
});
