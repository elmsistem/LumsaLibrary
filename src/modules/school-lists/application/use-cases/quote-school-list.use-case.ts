import { SchoolListRepository } from "../../domain/repositories/school-list.repository";
import { SchoolList, SchoolListItemProps } from "../../domain/entities/school-list.entity";
import { CatalogRepository } from "../../../catalog/public-api";
import { InventoryRepository } from "../../../inventory/public-api";
import { Money } from "../../../core/domain/value-objects/money.vo";
import { ValidationError } from "../../../core/domain/errors/domain-error";

export interface QuoteItemInput {
  productId: string;
  presentationId: string;
  quantity: number;
}

export interface QuoteItemResult {
  productId: string;
  presentationId: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
  taxRate: string;
  hasStock: boolean;
  availableStock: number;
  substituteProductId?: string;
  substituteDescription?: string;
}

export interface QuoteSchoolListResult {
  schoolList: SchoolList;
  items: QuoteItemResult[];
  subtotal0: Money;
  subtotal15: Money;
  totalIva: Money;
  totalAmount: Money;
  whatsAppMessage: string;
}

export class QuoteSchoolListUseCase {
  constructor(
    private readonly schoolListRepo: SchoolListRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly inventoryRepo: InventoryRepository
  ) {}

  public async execute(
    schoolListId: string,
    warehouseId: string,
    itemsToQuote: QuoteItemInput[]
  ): Promise<QuoteSchoolListResult> {
    const list = await this.schoolListRepo.findSchoolListById(schoolListId);
    if (!list) {
      throw new ValidationError(
        `Lista escolar con ID ${schoolListId} no encontrada.`,
        "SCHOOL_LIST_NOT_FOUND"
      );
    }

    if (itemsToQuote.length === 0) {
      throw new ValidationError(
        "Debe ingresar al menos un ítem para cotizar la lista escolar.",
        "EMPTY_QUOTE_ITEMS"
      );
    }

    let subtotal0Cents = 0;
    let subtotal15Cents = 0;
    const quotedItemsResult: QuoteItemResult[] = [];
    const domainItems: SchoolListItemProps[] = [];

    for (const itemInput of itemsToQuote) {
      const product = await this.catalogRepo.findProductById(itemInput.productId);
      if (!product) {
        throw new ValidationError(
          `Producto con ID ${itemInput.productId} no encontrado en el catálogo.`,
          "PRODUCT_NOT_FOUND"
        );
      }

      const presentation = product.getPresentationById(itemInput.presentationId);
      if (!presentation) {
        throw new ValidationError(
          `Presentación con ID ${itemInput.presentationId} no encontrada en producto "${product.getName()}".`,
          "PRESENTATION_NOT_FOUND"
        );
      }

      const balance = await this.inventoryRepo.getBalance(warehouseId, itemInput.productId);
      const availableStock = balance ? balance.getCurrentStockUnits() : 0;
      const requiredUnits = itemInput.quantity * presentation.getConversionFactor();
      const hasStock = availableStock >= requiredUnits;

      const unitPrice = presentation.getRetailPrice();
      const lineTotalCents = itemInput.quantity * unitPrice.toCents();
      const lineTotal = Money.fromCents(lineTotalCents);

      if (product.getTaxRate() === "IVA_15") {
        subtotal15Cents += lineTotalCents;
      } else {
        subtotal0Cents += lineTotalCents;
      }

      quotedItemsResult.push({
        productId: itemInput.productId,
        presentationId: itemInput.presentationId,
        description: `${product.getName()} (${presentation.getName()})`,
        quantity: itemInput.quantity,
        unitPrice,
        total: lineTotal,
        taxRate: product.getTaxRate(),
        hasStock,
        availableStock,
      });

      domainItems.push({
        productId: itemInput.productId,
        presentationId: itemInput.presentationId,
        quantity: itemInput.quantity,
        unitPrice,
        isReserved: false,
        isDelivered: false,
      });
    }

    const subtotal0 = Money.fromCents(subtotal0Cents);
    const subtotal15 = Money.fromCents(subtotal15Cents);
    const totalIva = Money.fromCents(Math.round((subtotal15Cents * 15) / 100));
    const totalAmount = Money.fromCents(subtotal0Cents + subtotal15Cents + totalIva.toCents());

    list.quote(domainItems, totalAmount);
    await this.schoolListRepo.saveSchoolList(list);

    // Generar formato de proforma para WhatsApp
    const lines: string[] = [
      `📚 *COTIZACIÓN DE LISTA ESCOLAR - LUMSA LIBRARY* 📚`,
      `*Grado:* ${list.getGradeLevel()} | *Año:* ${list.getAcademicYear()}`,
    ];

    if (list.getStudentName()) {
      lines.push(`*Estudiante:* ${list.getStudentName()}`);
    }

    lines.push(`----------------------------------------`);
    for (const item of quotedItemsResult) {
      const stockBadge = item.hasStock ? "✅" : "⚠️ Stock bajo";
      lines.push(
        `• ${item.quantity}x ${item.description} - $${item.total.toDecimal().toFixed(2)} ${stockBadge}`
      );
    }

    lines.push(`----------------------------------------`);
    lines.push(`*Subtotal IVA 0%:* $${subtotal0.toDecimal().toFixed(2)}`);
    lines.push(`*Subtotal IVA 15%:* $${subtotal15.toDecimal().toFixed(2)}`);
    lines.push(`*IVA 15%:* $${totalIva.toDecimal().toFixed(2)}`);
    lines.push(`*TOTAL A PAGAR:* $${totalAmount.toDecimal().toFixed(2)} USD`);
    lines.push(`\n_Puede reservar esta lista respondiendo a este mensaje o acercándose a nuestro local._`);

    return {
      schoolList: list,
      items: quotedItemsResult,
      subtotal0,
      subtotal15,
      totalIva,
      totalAmount,
      whatsAppMessage: lines.join("\n"),
    };
  }
}
