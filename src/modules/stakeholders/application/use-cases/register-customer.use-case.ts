import { generateUUIDv7, Money } from "@/modules/core/public-api";
import { Customer } from "../../domain/entities/customer.entity";
import { CustomerRepository } from "../../domain/repositories/customer.repository";
import {
  EcuadorianIdentification,
  IdentificationType,
} from "../../domain/value-objects/ecuadorian-identification.vo";

export interface RegisterCustomerDto {
  idType: IdentificationType;
  idNumber: string;
  legalName: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimitDollars?: number;
}

export class RegisterCustomerUseCase {
  constructor(private readonly customerRepo: CustomerRepository) {}

  public async execute(dto: RegisterCustomerDto): Promise<Customer> {
    // 1. Validar identificación ecuatoriana con reglas del SRI
    const identification = EcuadorianIdentification.create(dto.idType, dto.idNumber);

    // 2. Verificar si ya existe registrado
    const existing = await this.customerRepo.findByIdNumber(identification.getValue());
    if (existing) {
      return existing;
    }

    // 3. Crear nueva entidad de dominio
    const customer = new Customer({
      id: generateUUIDv7(),
      identification,
      legalName: dto.legalName,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      creditLimit: dto.creditLimitDollars ? Money.fromDecimal(dto.creditLimitDollars) : Money.zero(),
    });

    // 4. Persistir
    await this.customerRepo.save(customer);
    return customer;
  }
}
