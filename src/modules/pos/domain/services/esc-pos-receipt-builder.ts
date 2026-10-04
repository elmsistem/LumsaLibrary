export interface StoreReceiptHeader {
  legalName: string;
  tradeName: string;
  ruc: string;
  address: string;
  phone?: string | null;
  rimpeLegend?: string | null;
}

export interface CustomerReceiptInfo {
  name: string;
  idNumber: string;
  idType: string;
}

export interface ReceiptItemLine {
  quantity: number;
  description: string;
  unitPriceDecimal: number;
  totalDecimal: number;
}

export interface ReceiptPaymentLine {
  methodName: string;
  amountDecimal: number;
}

export interface GenerateReceiptProps {
  store: StoreReceiptHeader;
  customer: CustomerReceiptInfo;
  orderNumber: string;
  date: Date;
  items: ReceiptItemLine[];
  subtotal0Decimal: number;
  subtotal15Decimal: number;
  discountDecimal: number;
  ivaDecimal: number;
  totalDecimal: number;
  changeDecimal: number;
  payments: ReceiptPaymentLine[];
  accessKey?: string | null;
  paperWidthMm?: 80 | 58;
}

export class EscPosReceiptBuilder {
  /**
   * Genera el recibo formateado en texto con comandos estándar ESC/POS para impresión térmica.
   */
  public static buildReceiptText(props: GenerateReceiptProps): string {
    const width = props.paperWidthMm === 58 ? 32 : 48;
    const separator = "-".repeat(width);
    const doubleSep = "=".repeat(width);

    const padCenter = (str: string) => {
      const trimmed = str.substring(0, width);
      const remaining = width - trimmed.length;
      const left = Math.floor(remaining / 2);
      return " ".repeat(left) + trimmed;
    };

    const padRow = (left: string, right: string) => {
      const available = width - right.length;
      const truncatedLeft = left.substring(0, Math.max(0, available - 1));
      const spaces = width - truncatedLeft.length - right.length;
      return truncatedLeft + " ".repeat(Math.max(1, spaces)) + right;
    };

    const dateStr = props.date.toLocaleString("es-EC", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const lines: string[] = [
      padCenter(props.store.tradeName.toUpperCase()),
      padCenter(props.store.legalName),
      padCenter(`RUC: ${props.store.ruc}`),
      padCenter(props.store.address),
    ];

    if (props.store.phone) {
      lines.push(padCenter(`Teléf: ${props.store.phone}`));
    }
    if (props.store.rimpeLegend) {
      lines.push(padCenter(props.store.rimpeLegend));
    }

    lines.push(doubleSep);
    lines.push(padRow(`TICKET DE VENTA:`, props.orderNumber));
    lines.push(padRow(`FECHA:`, dateStr));
    lines.push(padRow(`CLIENTE:`, props.customer.name));
    lines.push(padRow(`ID/RUC:`, props.customer.idNumber));
    lines.push(separator);

    lines.push(padRow("CANT. DESCRIPCION", "TOTAL"));
    lines.push(separator);

    for (const item of props.items) {
      const qtyDesc = `${item.quantity} x ${item.description}`;
      const totalStr = `$${item.totalDecimal.toFixed(2)}`;
      lines.push(padRow(qtyDesc, totalStr));
    }

    lines.push(separator);
    lines.push(padRow("SUBTOTAL IVA 0%:", `$${props.subtotal0Decimal.toFixed(2)}`));
    lines.push(padRow("SUBTOTAL IVA 15%:", `$${props.subtotal15Decimal.toFixed(2)}`));
    if (props.discountDecimal > 0) {
      lines.push(padRow("DESCUENTO:", `-$${props.discountDecimal.toFixed(2)}`));
    }
    lines.push(padRow("IVA 15%:", `$${props.ivaDecimal.toFixed(2)}`));
    lines.push(doubleSep);
    lines.push(padRow("TOTAL A PAGAR:", `$${props.totalDecimal.toFixed(2)}`));
    lines.push(doubleSep);

    lines.push("FORMAS DE PAGO:");
    for (const payment of props.payments) {
      lines.push(padRow(`  ${payment.methodName}:`, `$${payment.amountDecimal.toFixed(2)}`));
    }

    if (props.changeDecimal > 0) {
      lines.push(padRow("  CAMBIO / VUELTO:", `$${props.changeDecimal.toFixed(2)}`));
    }

    if (props.accessKey) {
      lines.push(separator);
      lines.push("CLAVE DE ACCESO SRI:");
      lines.push(props.accessKey);
      lines.push("Consulte su factura en: sri.gob.ec");
    }

    lines.push(separator);
    lines.push(padCenter("¡GRACIAS POR SU COMPRA!"));
    lines.push(padCenter("LumsaLibrary - Papelería y Librería"));
    lines.push("\n\n"); // Alimentación de papel

    return lines.join("\n");
  }
}
