import { describe, it, expect, beforeEach } from "vitest";
import { RegisterCustomerUseCase } from "./register-customer.use-case";
import { Customer } from "../../domain/entities/customer.entity";
import { CustomerRepository } from "../../domain/repositories/customer.repository";

class InMemoryCustomerRepository implements CustomerRepository {
  private customers: Customer[] = [];

  async findById(id: string): Promise<Customer | null> {
    return this.customers.find((c) => c.getId() === id) || null;
  }

  async findByIdNumber(idNumber: string): Promise<Customer | null> {
    return this.customers.find((c) => c.getIdentification().getValue() === idNumber) || null;
  }

  async save(customer: Customer): Promise<void> {
    const index = this.customers.findIndex((c) => c.getId() === customer.getId());
    if (index >= 0) {
      this.customers[index] = customer;
    } else {
      this.customers.push(customer);
    }
  }

  async search(query: string): Promise<Customer[]> {
    return this.customers.filter((c) =>
      c.getLegalName().toLowerCase().includes(query.toLowerCase())
    );
  }
}

describe("RegisterCustomerUseCase", () => {
  let repo: InMemoryCustomerRepository;
  let useCase: RegisterCustomerUseCase;

  beforeEach(() => {
    repo = new InMemoryCustomerRepository();
    useCase = new RegisterCustomerUseCase(repo);
  });

  it("debe registrar un cliente nuevo con cédula válida exitosamente", async () => {
    const customer = await useCase.execute({
      idType: "CEDULA",
      idNumber: "1710034065",
      legalName: "Juan Pérez",
      email: "juan@correo.com",
      creditLimitDollars: 100,
    });

    expect(customer.getId()).toBeDefined();
    expect(customer.getLegalName()).toBe("Juan Pérez");
    expect(customer.getCreditLimit().toDecimal()).toBe(100);
    expect(customer.getIdentification().getValue()).toBe("1710034065");

    const saved = await repo.findByIdNumber("1710034065");
    expect(saved).not.toBeNull();
  });

  it("debe rechazar registro si la cédula es inválida según el Módulo 10", async () => {
    await expect(
      useCase.execute({
        idType: "CEDULA",
        idNumber: "1710034066", // Dígito verificador erróneo
        legalName: "Cliente Inválido",
      })
    ).rejects.toThrow(/Dígito verificador de cédula no coincide/);
  });

  it("debe retornar el cliente existente si ya estaba registrado sin duplicar", async () => {
    const first = await useCase.execute({
      idType: "CEDULA",
      idNumber: "1710034065",
      legalName: "Juan Pérez",
    });

    const second = await useCase.execute({
      idType: "CEDULA",
      idNumber: "1710034065",
      legalName: "Juan Pérez Modificado",
    });

    expect(first.getId()).toBe(second.getId());
  });
});
