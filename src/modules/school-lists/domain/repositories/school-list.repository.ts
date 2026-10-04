import { SchoolInstitution } from "../entities/school-institution.entity";
import { SchoolList } from "../entities/school-list.entity";
import { Money } from "../../../core/domain/value-objects/money.vo";

export interface SchoolListAdvanceData {
  id: string;
  schoolListId: string;
  cashSessionId: string;
  amount: Money;
  paymentMethod: string;
  receiptCode: string;
  createdAt: Date;
}

export interface SchoolListRepository {
  // --- Instituciones Educativas ---
  saveInstitution(institution: SchoolInstitution): Promise<void>;
  findInstitutionById(id: string): Promise<SchoolInstitution | null>;
  listInstitutions(): Promise<SchoolInstitution[]>;

  // --- Listas de Útiles ---
  saveSchoolList(list: SchoolList): Promise<void>;
  findSchoolListById(id: string): Promise<SchoolList | null>;
  listSchoolLists(filters?: {
    institutionId?: string;
    academicYear?: string;
    status?: string;
  }): Promise<SchoolList[]>;

  // --- Anticipos y Abonos ---
  getNextAdvanceSequential(): Promise<string>;
  saveAdvance(advance: SchoolListAdvanceData): Promise<void>;
}
