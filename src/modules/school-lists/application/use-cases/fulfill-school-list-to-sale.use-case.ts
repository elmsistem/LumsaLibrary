import { SchoolListRepository } from "../../domain/repositories/school-list.repository";
import { SchoolList } from "../../domain/entities/school-list.entity";
import { CatalogRepository } from "../../../catalog/public-api";
import {
  ProcessSaleCheckoutUseCase,
  ProcessSaleCheckoutResult,
  CheckoutItemDto,
  CheckoutPaymentDto,
} from "../../../pos/public-api";
import { BuyerTaxInfo } from "../../../billing-sri/public-api";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface FulfillSchoolListDto {
  schoolListId: string;
  cashSessionId: string;
  warehouseId: string;
  customerId: string;
  buyer: BuyerTaxInfo;
  settlementPayments: CheckoutPaymentDto[]; // Pagos para liquidar el saldo pendiente
  paperWidthMm?: 80 | 58;
}

export interface FulfillSchoolListResult {
  schoolList: SchoolList;
  checkoutResult: ProcessSaleCheckoutResult;
}

export class FulfillSchoolListToSaleUseCase {
  constructor(
    private readonly schoolListRepo: SchoolListRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly processSaleCheckoutUseCase: ProcessSaleCheckoutUseCase
  ) {}

  public async execute(dto: FulfillSchoolListDto): Promise<FulfillSchoolListResult> {
    const list = await this.schoolListRepo.findSchoolListById(dto.schoolListId);
    if (!list) {
      throw new ValidationError(
        `Lista escolar con ID ${dto.schoolListId} no encontrada.`,
        "SCHOOL_LIST_NOT_FOUND"
      );
    }

    if (list.getStatus() !== "RESERVED" && list.getStatus() !== "QUOTED") {
      throw new ValidationError(
        `La lista escolar debe estar en estado QUOTED o RESERVED para ser liquidada. Estado actual: ${list.getStatus()}`,
        "INVALID_LIST_STATE_FOR_FULFILLMENT"
      );
    }

    const items = list.getItems();
    if (items.length === 0) {
      throw new ValidationError(
        "La lista escolar no contiene ningún ítem para facturar.",
        "EMPTY_SCHOOL_LIST_ITEMS"
      );
    }

    // 1. Mapear ítems de la lista escolar a ítems del checkout POS
    const checkoutItems: CheckoutItemDto[] = [];
    for (const item of items) {
      const product = await this.catalogRepo.findProductById(item.productId);
      if (!product) {
        throw new ValidationError(
          `Producto con ID ${item.productId} no encontrado.`,
          "PRODUCT_NOT_FOUND"
        );
      }

      const presentation = product.getPresentationById(item.presentationId);
      if (!presentation) {
        throw new ValidationError(
          `Presentación no encontrada en producto "${product.getName()}".`,
          "PRESENTATION_NOT_FOUND"
        );
      }

      checkoutItems.push({
        productId: item.productId,
        presentationId: item.presentationId,
        code: product.getSku(),
        description: `${product.getName()} (${presentation.getName()})`,
        quantity: item.quantity,
        conversionFactor: presentation.getConversionFactor(),
        unitPriceCents: item.unitPrice.toCents(),
        discountCents: 0,
        taxRate: product.getTaxRate(),
      });
    }

    // 2. Componer pagos: Aplicar anticipo previo acumulado + pagos de liquidación del saldo
    const checkoutPayments: CheckoutPaymentDto[] = [];

    const advanceCents = list.getAdvancePayment().toCents();
    if (advanceCents > 0) {
      checkoutPayments.push({
        paymentMethod: "CUSTOMER_ADVANCE_APPLIED",
        amountCents: advanceCents,
        referenceCode: `ANTICIPO_LISTA_${list.getId().substring(0, 8)}`,
      });
    }

    checkoutPayments.push(...dto.settlementPayments);

    // 3. Ejecutar checkout atómico POS (Módulo 05)
    const checkoutResult = await this.processSaleCheckoutUseCase.execute({
      cashSessionId: dto.cashSessionId,
      customerId: dto.customerId,
      warehouseId: dto.warehouseId,
      buyer: dto.buyer,
      items: checkoutItems,
      payments: checkoutPayments,
      paperWidthMm: dto.paperWidthMm,
    });

    // 4. Marcar lista como despachada
    list.dispatch();
    await this.schoolListRepo.saveSchoolList(list);

    return {
      schoolList: list,
      checkoutResult,
    };
  }
}
