import { Supplier } from "../entities/supplier.entity";

export interface SupplierRepository {
  findById(id: string): Promise<Supplier | null>;
  findByRuc(ruc: string): Promise<Supplier | null>;
  save(supplier: Supplier): Promise<void>;
  listAll(limit?: number, offset?: number): Promise<Supplier[]>;
}
