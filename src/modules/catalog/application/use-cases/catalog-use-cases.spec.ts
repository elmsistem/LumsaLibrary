import { describe, it, expect, beforeEach } from "vitest";
import { CreateProductUseCase } from "./create-product.use-case";
import { AddPresentationUseCase } from "./add-presentation.use-case";
import { Product } from "../../domain/entities/product.entity";
import { CatalogRepository } from "../../domain/repositories/catalog.repository";

class InMemoryCatalogRepository implements CatalogRepository {
  private products: Product[] = [];

  async findProductById(id: string): Promise<Product | null> {
    return this.products.find((p) => p.getId() === id) || null;
  }

  async findProductBySku(sku: string): Promise<Product | null> {
    return this.products.find((p) => p.getSku() === sku) || null;
  }

  async findProductByBarcode(barcode: string): Promise<Product | null> {
    return this.products.find((p) => p.getBarcode() === barcode) || null;
  }

  async saveProduct(product: Product): Promise<void> {
    const idx = this.products.findIndex((p) => p.getId() === product.getId());
    if (idx >= 0) {
      this.products[idx] = product;
    } else {
      this.products.push(product);
    }
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.products.filter((p) => p.getName().toLowerCase().includes(query.toLowerCase()));
  }
}

describe("Catalog Application Use Cases", () => {
  let repo: InMemoryCatalogRepository;
  let createProductUseCase: CreateProductUseCase;
  let addPresentationUseCase: AddPresentationUseCase;

  beforeEach(() => {
    repo = new InMemoryCatalogRepository();
    createProductUseCase = new CreateProductUseCase(repo);
    addPresentationUseCase = new AddPresentationUseCase(repo);
  });

  it("debe crear un producto nuevo con su presentación 'Unidad' base por defecto", async () => {
    const product = await createProductUseCase.execute({
      sku: "PAP-001",
      name: "Cuaderno Universitario Norma 100h Líneas",
      categoryId: "cat-cuadernos",
      initialRetailPriceDollars: 2.75,
      initialWholesalePriceDollars: 2.5,
      taxRate: "IVA_0", // Libros y cuadernos exentos en Ecuador
    });

    expect(product.getId()).toBeDefined();
    expect(product.getSku()).toBe("PAP-001");
    expect(product.getTaxRate()).toBe("IVA_0");

    const defaultPres = product.getDefaultPresentation();
    expect(defaultPres.getName()).toBe("Unidad");
    expect(defaultPres.getConversionFactor()).toBe(1.0);
    expect(defaultPres.getRetailPrice().toDecimal()).toBe(2.75);
    expect(defaultPres.getWholesalePrice().toDecimal()).toBe(2.5);
  });

  it("debe rechazar productos con SKU duplicado", async () => {
    await createProductUseCase.execute({
      sku: "PAP-DUP",
      name: "Producto A",
      categoryId: "cat-1",
      initialRetailPriceDollars: 1.0,
    });

    await expect(
      createProductUseCase.execute({
        sku: "PAP-DUP",
        name: "Producto B",
        categoryId: "cat-1",
        initialRetailPriceDollars: 1.5,
      })
    ).rejects.toThrow(/Ya existe un producto con el SKU/);
  });

  it("debe permitir añadir presentaciones fraccionadas adicionales (ej: Paquete x 10)", async () => {
    const product = await createProductUseCase.execute({
      sku: "PAP-100",
      name: "Carpeta Manila A4",
      categoryId: "cat-carpetas",
      initialRetailPriceDollars: 0.25,
    });

    const paquete = await addPresentationUseCase.execute({
      productId: product.getId(),
      name: "Paquete x 50",
      conversionFactor: 50.0,
      retailPriceDollars: 10.0,
      wholesalePriceDollars: 9.0,
    });

    expect(paquete.getName()).toBe("Paquete x 50");
    expect(paquete.getConversionFactor()).toBe(50.0);

    const updated = await repo.findProductById(product.getId());
    expect(updated?.getPresentations().length).toBe(2);
    // Vender 2 paquetes equivale a 100 carpetas
    expect(updated?.calculateUnits(paquete.getId(), 2)).toBe(100);
  });
});
