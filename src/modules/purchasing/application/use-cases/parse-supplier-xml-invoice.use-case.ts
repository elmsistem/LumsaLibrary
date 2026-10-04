import { TaxRate, CatalogRepository } from "@/modules/catalog/public-api";
import { SupplierRepository } from "@/modules/stakeholders/public-api";
import { PurchaseRepository } from "../../domain/repositories/purchase.repository";
import {
  SriXmlInvoiceParserService,
  ParsedSupplierInvoice,
} from "../../domain/services/sri-xml-invoice-parser.service";

export interface ParseSupplierXmlInvoiceInput {
  xmlContent: string;
}

export interface MatchedInvoiceItemDto {
  supplierCode: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  totalPriceCents: number;
  taxRate: TaxRate;
  isMatched: boolean;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedPresentationId?: string;
  matchedPresentationName?: string;
  conversionFactor?: number;
}

export interface ParseSupplierXmlInvoiceResult {
  supplier: {
    ruc: string;
    legalName: string;
    commercialName?: string;
    address?: string;
    existsInSystem: boolean;
    existingSupplierId?: string;
    creditDays: number;
  };
  invoice: {
    invoiceNumber: string;
    accessKey: string;
    authorizationNumber: string;
    emissionDate: string; // ISO date string
    subtotal0Cents: number;
    subtotal15Cents: number;
    totalDiscountCents: number;
    totalIvaCents: number;
    totalAmountCents: number;
  };
  items: MatchedInvoiceItemDto[];
  alreadyRegistered: boolean;
}

/**
 * Caso de Uso: Parsear Factura Electrónica XML del Proveedor y Conciliar Productos.
 */
export class ParseSupplierXmlInvoiceUseCase {
  private readonly parserService: SriXmlInvoiceParserService;

  constructor(
    private readonly supplierRepo: SupplierRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly purchaseRepo: PurchaseRepository
  ) {
    this.parserService = new SriXmlInvoiceParserService();
  }

  public async execute(input: ParseSupplierXmlInvoiceInput): Promise<ParseSupplierXmlInvoiceResult> {
    const parsed: ParsedSupplierInvoice = this.parserService.parse(input.xmlContent);

    // 1. Verificar proveedor en el sistema
    const existingSupplier = await this.supplierRepo.findByRuc(parsed.supplierRuc);
    const supplierId = existingSupplier ? existingSupplier.getId() : undefined;

    // 2. Verificar si la factura ya fue importada previamente
    let alreadyRegistered = false;
    if (supplierId) {
      const existingPurchase = await this.purchaseRepo.findPurchaseBySupplierAndInvoice(
        supplierId,
        parsed.invoiceNumber
      );
      if (existingPurchase) {
        alreadyRegistered = true;
      }
    }

    // 3. Mapeo y conciliación inteligente de ítems
    const matchedItems: MatchedInvoiceItemDto[] = [];

    for (const item of parsed.items) {
      let matchedProductId: string | undefined;
      let matchedProductName: string | undefined;
      let matchedPresentationId: string | undefined;
      let matchedPresentationName: string | undefined;
      let conversionFactor: number | undefined;

      // Paso 3.1: Buscar en memoria histórica de mapeos por código de proveedor
      if (supplierId) {
        const mapping = await this.purchaseRepo.findMapping(supplierId, item.supplierCode);
        if (mapping) {
          const product = await this.catalogRepo.findProductById(mapping.getProductId());
          if (product) {
            const pres = product
              .getPresentations()
              .find((p) => p.getId() === mapping.getPresentationId());
            if (pres) {
              matchedProductId = product.getId();
              matchedProductName = product.getName();
              matchedPresentationId = pres.getId();
              matchedPresentationName = pres.getName();
              conversionFactor = pres.getConversionFactor();
            }
          }
        }
      }

      // Paso 3.2: Si no hubo mapeo, intentar coincidencia por código de barra en catálogo
      if (!matchedProductId) {
        const productByBarcode = await this.catalogRepo.findProductByBarcode(item.supplierCode);
        if (productByBarcode) {
          const pres = productByBarcode
            .getPresentations()
            .find((p) => p.getBarcode() === item.supplierCode) ||
            productByBarcode.getDefaultPresentation();

          if (pres) {
            matchedProductId = productByBarcode.getId();
            matchedProductName = productByBarcode.getName();
            matchedPresentationId = pres.getId();
            matchedPresentationName = pres.getName();
            conversionFactor = pres.getConversionFactor();
          }
        }
      }

      // Paso 3.3: Si aún no se encuentra, intentar coincidencia por SKU idéntico
      if (!matchedProductId) {
        const productBySku = await this.catalogRepo.findProductBySku(item.supplierCode);
        if (productBySku) {
          const pres = productBySku.getDefaultPresentation();
          if (pres) {
            matchedProductId = productBySku.getId();
            matchedProductName = productBySku.getName();
            matchedPresentationId = pres.getId();
            matchedPresentationName = pres.getName();
            conversionFactor = pres.getConversionFactor();
          }
        }
      }

      matchedItems.push({
        supplierCode: item.supplierCode,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPrice.toCents(),
        discountCents: item.discount.toCents(),
        totalPriceCents: item.totalPrice.toCents(),
        taxRate: item.taxRate,
        isMatched: !!matchedProductId,
        matchedProductId,
        matchedProductName,
        matchedPresentationId,
        matchedPresentationName,
        conversionFactor,
      });
    }

    return {
      supplier: {
        ruc: parsed.supplierRuc,
        legalName: parsed.supplierLegalName,
        commercialName: parsed.supplierCommercialName,
        address: parsed.supplierAddress,
        existsInSystem: !!existingSupplier,
        existingSupplierId: supplierId,
        creditDays: existingSupplier ? existingSupplier.getCreditDays() : 0,
      },
      invoice: {
        invoiceNumber: parsed.invoiceNumber,
        accessKey: parsed.accessKey,
        authorizationNumber: parsed.authorizationNumber,
        emissionDate: parsed.emissionDate.toISOString(),
        subtotal0Cents: parsed.subtotal0.toCents(),
        subtotal15Cents: parsed.subtotal15.toCents(),
        totalDiscountCents: parsed.totalDiscount.toCents(),
        totalIvaCents: parsed.totalIva.toCents(),
        totalAmountCents: parsed.totalAmount.toCents(),
      },
      items: matchedItems,
      alreadyRegistered,
    };
  }
}
