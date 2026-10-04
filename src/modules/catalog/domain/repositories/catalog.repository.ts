import { Product } from "../entities/product.entity";

export interface CatalogRepository {
  findProductById(id: string): Promise<Product | null>;
  findProductBySku(sku: string): Promise<Product | null>;
  findProductByBarcode(barcode: string): Promise<Product | null>;
  saveProduct(product: Product): Promise<void>;
  searchProducts(query: string, limit?: number): Promise<Product[]>;
}
