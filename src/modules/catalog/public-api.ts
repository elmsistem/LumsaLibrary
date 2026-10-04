// --- Domain ---
export { Product, type CreateProductProps, type TaxRate, type UnitType } from "./domain/entities/product.entity";
export {
  ProductPresentation,
  type CreatePresentationProps,
} from "./domain/entities/product-presentation.entity";
export { type CatalogRepository } from "./domain/repositories/catalog.repository";

// --- Application ---
export {
  CreateProductUseCase,
  type CreateProductDto,
} from "./application/use-cases/create-product.use-case";
export {
  AddPresentationUseCase,
  type AddPresentationDto,
} from "./application/use-cases/add-presentation.use-case";

// --- Infrastructure & Database ---
export {
  categories,
  brands,
  products,
  productPresentations,
  taxRateEnum,
  unitTypeEnum,
  type CategoryRow,
  type BrandRow,
  type ProductRow,
  type ProductPresentationRow,
} from "./infrastructure/database/schema/catalog.schema";
export { DrizzleCatalogRepository } from "./infrastructure/persistence/drizzle-catalog.repository";
