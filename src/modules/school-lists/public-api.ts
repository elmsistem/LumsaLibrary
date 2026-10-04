// --- Domain ---
export {
  SchoolInstitution,
  type SchoolRegime,
  type CreateSchoolInstitutionProps,
} from "./domain/entities/school-institution.entity";
export {
  SchoolList,
  type SchoolListStatus,
  type SchoolListItemProps,
  type CreateSchoolListProps,
} from "./domain/entities/school-list.entity";
export {
  type SchoolListRepository,
  type SchoolListAdvanceData,
} from "./domain/repositories/school-list.repository";

// --- Application Use Cases ---
export {
  CreateSchoolInstitutionUseCase,
  type CreateSchoolInstitutionDto,
} from "./application/use-cases/create-school-institution.use-case";
export {
  CreateSchoolListUseCase,
  type CreateSchoolListDto,
} from "./application/use-cases/create-school-list.use-case";
export {
  QuoteSchoolListUseCase,
  type QuoteItemInput,
  type QuoteItemResult,
  type QuoteSchoolListResult,
} from "./application/use-cases/quote-school-list.use-case";
export {
  ReserveSchoolListUseCase,
  type ReserveSchoolListDto,
  type ReserveSchoolListResult,
} from "./application/use-cases/reserve-school-list.use-case";
export {
  FulfillSchoolListToSaleUseCase,
  type FulfillSchoolListDto,
  type FulfillSchoolListResult,
} from "./application/use-cases/fulfill-school-list-to-sale.use-case";

// --- Infrastructure & Database ---
export {
  schoolInstitutions,
  schoolLists,
  schoolListItems,
  schoolListAdvances,
  schoolListStatusEnum,
  type SchoolInstitutionRow,
  type SchoolListRow,
  type SchoolListItemRow,
  type SchoolListAdvanceRow,
} from "./infrastructure/database/schema/school-lists.schema";
export { DrizzleSchoolListRepository } from "./infrastructure/persistence/drizzle-school-list.repository";
