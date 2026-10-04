import { SchoolListRepository } from "../../domain/repositories/school-list.repository";
import { SchoolList } from "../../domain/entities/school-list.entity";

export interface CreateSchoolListDto {
  institutionId?: string | null;
  gradeLevel: string;
  academicYear: string;
  studentName?: string | null;
  customerId?: string | null;
  notes?: string | null;
}

export class CreateSchoolListUseCase {
  constructor(private readonly schoolListRepo: SchoolListRepository) {}

  public async execute(dto: CreateSchoolListDto): Promise<SchoolList> {
    const list = SchoolList.create({
      institutionId: dto.institutionId,
      gradeLevel: dto.gradeLevel,
      academicYear: dto.academicYear,
      studentName: dto.studentName,
      customerId: dto.customerId,
      notes: dto.notes,
    });

    await this.schoolListRepo.saveSchoolList(list);
    return list;
  }
}
