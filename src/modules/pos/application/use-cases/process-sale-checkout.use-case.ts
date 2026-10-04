import { PosRepository } from "../../domain/repositories/pos.repository";
import { SaleOrder, PosPaymentMethod } from "../../domain/entities/sale-order.entity";
import { EscPosReceiptBuilder } from "../../domain/services/esc-pos-receipt-builder";
import { RecordSaleExitUseCase } from "../../../inventory/application/use-cases/record-sale-exit.use-case";
import {
  CreateElectronicInvoiceUseCase,
  CreateElectronicInvoiceResult,
} from "../../../billing-sri/application/use-cases/create-electronic-invoice.use-case";
import { BuyerTaxInfo } from "../../../billing-sri/domain/services/invoice-xml-builder";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface CheckoutItemDto {
  productId: string;
  presentationId: string;
  code: string;
  description: string;
  quantity: number;
  conversionFactor: number; // Factor hacia unidad mínima de inventario
  unitPriceCents: number;
  discountCents?: number;
  taxRate: "IVA_0" | "IVA_15" | "NO_OBJETO" | "EXENTO";
}

export interface CheckoutPaymentDto {
  paymentMethod: PosPaymentMethod;
  amountCents: number;
  referenceCode?: string | null;
}

export interface ProcessSaleCheckoutDto {
  cashSessionId: string;
  customerId: string;
  warehouseId: string;
  buyer: BuyerTaxInfo;
  items: CheckoutItemDto[];
  payments: CheckoutPaymentDto[];
  paperWidthMm?: 80 | 58;
}

export interface ProcessSaleCheckoutResult {
  saleOrder: SaleOrder;
  electronicInvoiceResult: CreateElectronicInvoiceResult;
  receiptText: string;
}

export class ProcessSaleCheckoutUseCase {
  constructor(
    private readonly posRepo: PosRepository,
    private readonly recordSaleExitUseCase: RecordSaleExitUseCase,
    private readonly createElectronicInvoiceUseCase: CreateElectronicInvoiceUseCase
  ) {}

  public async execute(dto: ProcessSaleCheckoutDto): Promise<ProcessSaleCheckoutResult> {
    // 1. Validar que la sesión de caja exista y esté abierta
    const session = await this.posRepo.findSessionById(dto.cashSessionId);
    if (!session) {
      throw new ValidationError(
        `Sesión de caja con ID ${dto.cashSessionId} no encontrada.`,
        "CASH_SESSION_NOT_FOUND"
      );
    }

    if (!session.isOpen()) {
      throw new ValidationError(
        "No se puede facturar en una sesión de caja cerrada.",
        "CASH_SESSION_NOT_OPEN"
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new ValidationError(
        "El carrito de compras de la venta no puede estar vacío.",
        "EMPTY_CART"
      );
    }

    // 2. Calcular subtotales e impuestos en centavos enteros (Money)
    let subtotal0Cents = 0;
    let subtotal15Cents = 0;
    let totalDiscountCents = 0;

    const domainItems = dto.items.map((item) => {
      const discountCents = item.discountCents ?? 0;
      const lineTotalCents = Math.round(item.quantity * item.unitPriceCents - discountCents);

      totalDiscountCents += discountCents;
      if (item.taxRate === "IVA_15") {
        subtotal15Cents += lineTotalCents;
      } else {
        subtotal0Cents += lineTotalCents;
      }

      return {
        productId: item.productId,
        presentationId: item.presentationId,
        quantity: item.quantity,
        unitPrice: Money.fromCents(item.unitPriceCents),
        discount: Money.fromCents(discountCents),
        taxRate: item.taxRate,
        total: Money.fromCents(lineTotalCents),
      };
    });

    const subtotal0 = Money.fromCents(subtotal0Cents);
    const subtotal15 = Money.fromCents(subtotal15Cents);
    const discount = Money.fromCents(totalDiscountCents);
    const iva = Money.fromCents(Math.round((subtotal15Cents * 15) / 100));
    const totalAmount = Money.fromCents(subtotal0Cents + subtotal15Cents + iva.toCents());

    // 3. Generar código correlativo de venta
    const sequentialCode = await this.posRepo.getNextSaleSequential();

    // 4. Instanciar orden de venta y validar suficiencia de pagos
    const domainPayments = dto.payments.map((p) => ({
      paymentMethod: p.paymentMethod,
      amount: Money.fromCents(p.amountCents),
      referenceCode: p.referenceCode,
    }));

    const saleOrder = SaleOrder.create({
      sequentialCode,
      cashSessionId: session.getId(),
      customerId: dto.customerId,
      warehouseId: dto.warehouseId,
      subtotal0,
      subtotal15,
      discount,
      iva,
      totalAmount,
      items: domainItems,
      payments: domainPayments,
    });

    // 5. Descontar stock en Kardex (Módulo 03) para cada producto
    // Si algún producto no tiene stock, recordSaleExit lanzará InsufficientStockError
    for (const item of dto.items) {
      const minUnitsToDeduct = Math.round(item.quantity * (item.conversionFactor || 1) * 10000) / 10000;
      await this.recordSaleExitUseCase.execute({
        warehouseId: dto.warehouseId,
        productId: item.productId,
        quantityUnits: minUnitsToDeduct,
        referenceCode: sequentialCode,
        userId: session.getUserId(),
      });
    }

    // 6. Persistir orden de venta y pagos
    await this.posRepo.saveSaleOrder(saleOrder);

    // 7. Emitir comprobante electrónico legal y encolar en Outbox SRI (Módulo 04)
    const sriPayments = dto.payments.map((p) => ({
      paymentMethodCode: this.mapToSriPaymentCode(p.paymentMethod),
      total: Money.fromCents(p.amountCents),
    }));

    const sriInvoiceItems = dto.items.map((item) => ({
      code: item.code,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Money.fromCents(item.unitPriceCents),
      discount: Money.fromCents(item.discountCents ?? 0),
      taxRate: item.taxRate,
    }));

    const electronicInvoiceResult = await this.createElectronicInvoiceUseCase.execute({
      documentTypeCode: "01",
      establishmentCode: session.getEstablishmentCode(),
      emissionPointCode: session.getEmissionPointCode(),
      customerId: dto.customerId,
      saleOrderId: saleOrder.getId(),
      buyer: dto.buyer,
      items: sriInvoiceItems,
      payments: sriPayments,
    });

    // 8. Generar ticket térmico ESC/POS
    const receiptText = EscPosReceiptBuilder.buildReceiptText({
      store: {
        legalName: "LUMSA LIBRARY CIA. LTDA.",
        tradeName: "LUMSA LIBRARY",
        ruc: "1790011223001",
        address: "Av. 10 de Agosto y Colón, Quito",
        phone: "02-2554321",
        rimpeLegend: "CONTRIBUYENTE RÉGIMEN RIMPE",
      },
      customer: {
        name: dto.buyer.legalName,
        idNumber: dto.buyer.idNumber,
        idType: dto.buyer.idType,
      },
      orderNumber: sequentialCode,
      date: saleOrder.getCreatedAt(),
      items: dto.items.map((i) => ({
        quantity: i.quantity,
        description: i.description,
        unitPriceDecimal: i.unitPriceCents / 100,
        totalDecimal: (i.quantity * i.unitPriceCents - (i.discountCents ?? 0)) / 100,
      })),
      subtotal0Decimal: subtotal0.toDecimal(),
      subtotal15Decimal: subtotal15.toDecimal(),
      discountDecimal: discount.toDecimal(),
      ivaDecimal: iva.toDecimal(),
      totalDecimal: totalAmount.toDecimal(),
      changeDecimal: saleOrder.getChange().toDecimal(),
      payments: dto.payments.map((p) => ({
        methodName: p.paymentMethod,
        amountDecimal: p.amountCents / 100,
      })),
      accessKey: electronicInvoiceResult.invoice.getAccessKey().getValue(),
      paperWidthMm: dto.paperWidthMm || 80,
    });

    return {
      saleOrder,
      electronicInvoiceResult,
      receiptText,
    };
  }

  private mapToSriPaymentCode(method: PosPaymentMethod): string {
    switch (method) {
      case "CASH":
        return "01"; // Sin utilización del sistema financiero
      case "DEBIT_CARD":
        return "16";
      case "CREDIT_CARD":
        return "19";
      case "BANK_TRANSFER_DEUNA":
      case "STORE_CREDIT":
      case "TAX_WITHHOLDING_RECEIVED":
      case "CUSTOMER_ADVANCE_APPLIED":
      default:
        return "20"; // Otros con utilización del sistema financiero
    }
  }
}
