import { generateUUIDv7, Money, ValidationError } from "@/modules/core/public-api";
import { ProductPresentation } from "../../domain/entities/product-presentation.entity";
import { CatalogRepository } from "../../domain/repositories/catalog.repository";

export interface AddPresentationDto {
  productId: string;
  name: string;
  conversionFactor: number;
  barcode?: string;
  retailPriceDollars: number;
  wholesalePriceDollars?: number;
  minWholesaleQuantity?: number;
  isDefault?: boolean;
}

export class AddPresentationUseCase {
  constructor(private readonly catalogRepo: CatalogRepository) {}

  public async execute(dto: AddPresentationDto): Promise<ProductPresentation> {
    const product = await this.catalogRepo.findProductById(dto.productId);
    if (!product) {
      throw new ValidationError(`Producto con ID ${dto.productId} no encontrado.`, "PRODUCT_NOT_FOUND");
    }

    if (dto.barcode) {
      const existingBarcode = await this.catalogRepo.findProductByBarcode(dto.barcode);
      if (existingBarcode) {
        throw new ValidationError(
          `Ya existe un artículo o presentación con el código de barras "${dto.barcode}".`,
          "DUPLICATE_BARCODE"
        );
      }
    }

    const retailPrice = Money.fromDecimal(dto.retailPriceDollars);
    const wholesalePrice = dto.wholesalePriceDollars !== undefined
      ? Money.fromDecimal(dto.wholesalePriceDollars)
      : retailPrice;

    const presentation = new ProductPresentation({
      id: generateUUIDv7(),
      productId: product.getId(),
      name: dto.name,
      conversionFactor: dto.conversionFactor,
      barcode: dto.barcode,
      retailPrice,
      wholesalePrice,
      minWholesaleQuantity: dto.minWholesaleQuantity,
      isDefault: dto.isDefault,
    });

    product.addPresentation(presentation);
    await this.catalogRepo.saveProduct(product);

    return presentation;
  }
}
