import { SchoolListRepository } from "../../domain/repositories/school-list.repository";
import { SchoolInstitution, SchoolRegime } from "../../domain/entities/school-institution.entity";

export interface CreateSchoolInstitutionDto {
  name: string;
  city: string;
  regime?: SchoolRegime;
}

export class CreateSchoolInstitutionUseCase {
  constructor(private readonly schoolListRepo: SchoolListRepository) {}

  public async execute(dto: CreateSchoolInstitutionDto): Promise<SchoolInstitution> {
    const institution = SchoolInstitution.create({
      name: dto.name,
      city: dto.city,
      regime: dto.regime,
    });

    await this.schoolListRepo.saveInstitution(institution);
    return institution;
  }
}
