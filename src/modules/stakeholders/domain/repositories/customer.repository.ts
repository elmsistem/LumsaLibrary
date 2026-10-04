import { Customer } from "../entities/customer.entity";

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByIdNumber(idNumber: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
  search(query: string, limit?: number): Promise<Customer[]>;
}
