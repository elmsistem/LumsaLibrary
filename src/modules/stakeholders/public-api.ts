// --- Domain ---
export {
  EcuadorianIdentification,
  type IdentificationType,
  type RucSubtype,
  type ValidationResult,
} from "./domain/value-objects/ecuadorian-identification.vo";
export { Customer, type CreateCustomerProps } from "./domain/entities/customer.entity";
export { Supplier, type CreateSupplierProps } from "./domain/entities/supplier.entity";
export { type CustomerRepository } from "./domain/repositories/customer.repository";
export { type SupplierRepository } from "./domain/repositories/supplier.repository";
export {
  assertConsumidorFinalAllowed,
  ConsumidorFinalRule,
  MAX_CONSUMIDOR_FINAL_CENTS,
} from "./domain/rules/consumidor-final.rule";

// --- Application ---
export {
  RegisterCustomerUseCase,
  type RegisterCustomerDto,
} from "./application/use-cases/register-customer.use-case";

// --- Infrastructure & Database ---
export {
  customers,
  suppliers,
  idTypeEnum,
  type CustomerRow,
  type NewCustomerRow,
  type SupplierRow,
  type NewSupplierRow,
} from "./infrastructure/database/schema/stakeholders.schema";
export { DrizzleCustomerRepository } from "./infrastructure/persistence/drizzle-customer.repository";
export { DrizzleSupplierRepository } from "./infrastructure/persistence/drizzle-supplier.repository";
