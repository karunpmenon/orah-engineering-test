import { Entity, PrimaryGeneratedColumn, Column, Generated } from "typeorm"
import { CreateGroupStudentInput, UpdateGroupStudentInput } from "../interface/group-student.interface";

@Entity()
export class GroupStudent {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  student_id: number

  @Column()
  group_id: number

  // @Generated('increment')
  @Column()
  incident_count: number


  public prepareToCreate(input: CreateGroupStudentInput) {
    this.student_id = input.student_id
    this.group_id = input.group_id ? input.group_id : null
    this.incident_count = input.incident_count ? input.incident_count : null
  }

  public prepareToUpdate(input: UpdateGroupStudentInput) {
    if (input.student_id !== undefined) this.student_id = input.student_id
    if (input.group_id !== undefined) this.group_id = input.group_id
    if (input.incident_count !== undefined) this.incident_count = input.incident_count
  }

}
