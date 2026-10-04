import { generateUUIDv7, Money, ValidationError } from "@/modules/core/public-api";
import { Product, TaxRate, UnitType } from "../../domain/entities/product.entity";
import { ProductPresentation } from "../../domain/entities/product-presentation.entity";
import { CatalogRepository } from "../../domain/repositories/catalog.repository";

export interface CreateProductDto {
  sku: string;
  name: string;
  categoryId: string;
  brandId?: string;
  barcode?: string;
  description?: string;
  taxRate?: TaxRate;
  minUnit?: UnitType;
  isService?: boolean;
  minStockAlert?: number;
  initialRetailPriceDollars: number;
  initialWholesalePriceDollars?: number;
}

export class CreateProductUseCase {
  constructor(private readonly catalogRepo: CatalogRepository) {}

  public async execute(dto: CreateProductDto): Promise<Product> {
    // 1. Validar unicidad de SKU
    const existingSku = await this.catalogRepo.findProductBySku(dto.sku);
    if (existingSku) {
      throw new ValidationError(`Ya existe un producto con el SKU "${dto.sku}".`, "DUPLICATE_SKU");
    }

    // 2. Validar unicidad de código de barras si fue provisto
    if (dto.barcode) {
      const existingBarcode = await this.catalogRepo.findProductByBarcode(dto.barcode);
      if (existingBarcode) {
        throw new ValidationError(`Ya existe un producto con el código de barras "${dto.barcode}".`, "DUPLICATE_BARCODE");
      }
    }

    const productId = generateUUIDv7();
    const presentationId = generateUUIDv7();

    const retailPrice = Money.fromDecimal(dto.initialRetailPriceDollars);
    const wholesalePrice = dto.initialWholesalePriceDollars !== undefined
      ? Money.fromDecimal(dto.initialWholesalePriceDollars)
      : retailPrice;

    // 3. Crear presentación base por defecto ("Unidad", factor 1.0)
    const basePresentation = new ProductPresentation({
      id: presentationId,
      productId,
      name: "Unidad",
      conversionFactor: 1.0,
      barcode: dto.barcode,
      retailPrice,
      wholesalePrice,
      isDefault: true,
    });

    // 4. Crear producto y asociar presentación base
    const product = new Product({
      id: productId,
      sku: dto.sku,
      name: dto.name,
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      barcode: dto.barcode,
      description: dto.description,
      taxRate: dto.taxRate,
      minUnit: dto.minUnit,
      isService: dto.isService,
      minStockAlert: dto.minStockAlert,
      presentations: [basePresentation],
    });

    // 5. Persistir
    await this.catalogRepo.saveProduct(product);
    return product;
  }
}
