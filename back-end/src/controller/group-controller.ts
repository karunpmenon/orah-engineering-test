import { getRepository, MoreThan } from "typeorm"
import { NextFunction, Request, Response } from "express"
import { Group } from "../entity/group.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface";
import { CreateGroupStudentInput, UpdateGroupStudentInput } from "../interface/group-student.interface";
import { GroupStudent } from "../entity/group-student.entity"
import { Roll } from "../entity/roll.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"

export class GroupController {

  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private rollRepository = getRepository(Roll)
  private studentRollStateRepository = getRepository(StudentRollState)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1: 

    // Return the list of all groups
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 

    // Add a Group
    const { body: params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt
    }
    const newgroup = new Group()
    newgroup.prepareToCreate(createGroupInput)
    return this.groupRepository.save(newgroup)

  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 

    // Update a Group

    const { body: params } = request
    if (!params.id) {
      return {
        "success": false,
        "message": "Missing id"
      }
    }
    return this.groupRepository.findOne(params.id).then((groupDetails) => {
      const updatedgroup: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt,
        run_at: params.run_at,
        student_count: params.student_count
      }

      groupDetails.prepareToUpdate(updatedgroup)
      return this.groupRepository.save(groupDetails)
    })


  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 

    // Delete a Group
    if (!request.body.id) {
      return {
        "success": false,
        "message": "missing id"
      }
    }
    let groupToRemove = await this.groupRepository.findOne(request.body.id)
    return await this.groupRepository.remove(groupToRemove)
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1: 

    // Return the list of Students that are in a Group

    return this.groupStudentRepository.find()
    // return this.groupStudentRepository.find({ group_id: request.query.group_id })
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:  
    let success = true
    let msg = "run group filter completed"
    //finding group details
    try {


      let groupdata = await this.groupRepository.find({ id: request.query.group_id })
      groupdata.map(async elmt => {
        //for each group details

        let group_id = elmt["id"]
        console.log(elmt, "\nprocessing for group_id ", group_id)
        let numberofweeks = elmt["number_of_weeks"]
        let roll_states = elmt["roll_states"]
        let ltmt = elmt["ltmt"]
        let incidents = elmt["incidents"]


        if (["<", ">"].indexOf(ltmt) == -1) {
          console.log("invalid ltmt ", ltmt)
          return {
            "success": false,
            "message": "invalid limit"
          }
        }

        //find the group to be removed
        let groupToRemove = await this.groupStudentRepository.find({ group_id: group_id })
        if (groupToRemove) {
          // 1. Clear out the groups (delete all the students from the groups)
          console.log("\n step 1 => removing from group-student table, group_id ", group_id)
          await this.groupStudentRepository.remove(groupToRemove)
        }


        // 2. For each group, query the student rolls to see which students match the filter for the group

        //find the date based on numberofweeks to be calculated
        let date = new Date();
        date.setDate(date.getDate() - (7 * numberofweeks));

        //based on the date filter find the daily rolls that needs to be checkd
        let rollsTobeConsideredForFilter = await this.rollRepository.find({
          where: {
            completed_at: MoreThan(date)
          }
        })
        console.log(rollsTobeConsideredForFilter)

        let where_filter = []
        let student_count = 0
        let run_at = new Date()
        for (let index in rollsTobeConsideredForFilter) {
          let eachRolls = rollsTobeConsideredForFilter[index]
          console.log(eachRolls)

          //based in the rollID (inorder to stay with in the date range and rollaction)
          // find the student rolls which matches the filter
          roll_states.split("|").map(eachstate => {
            where_filter.push({ "state": eachstate, "roll_id": eachRolls["id"] })
          })
          let filteredStudents = await this.studentRollStateRepository.find({
            where: where_filter
          })
          console.log(filteredStudents, filteredStudents.length)

          //to find total number of times students falls the condition across the dates
          //in case of unique count we need to use the length of keys of dict bellow
          student_count += filteredStudents.length ? filteredStudents.length : 0


          // inorder to find incident_count per student
          let student_incident_count_dict = {}
          for (let i in filteredStudents) {
            let eachStudent = filteredStudents[i]
            if (!student_incident_count_dict[eachStudent["student_id"]]) {
              student_incident_count_dict[eachStudent["student_id"]] = 0
            }
            student_incident_count_dict[eachStudent["student_id"]] += 1
          }

          //storing details per student
          console.log(student_incident_count_dict)

          for (let studentid in student_incident_count_dict) {
            let proceed = false
            if (ltmt == "<") {
              if (Number(student_incident_count_dict[studentid]) < incidents) {
                proceed = true
              }
            }
            else {
              if (Number(student_incident_count_dict[studentid]) > incidents) {
                proceed = true
              }
            }

            if (proceed) {
              // 3. Add the list of students that match the filter to the group
              const createGroupStudentInput: CreateGroupStudentInput = {
                student_id: Number(studentid),
                group_id: Number(group_id),
                incident_count: Number(student_incident_count_dict[studentid])
              }
              await this.groupStudentRepository.save(createGroupStudentInput)
            }
          }

        }

        //stroring run_at and number of times students falls under incident based in filter condition
        elmt["run_at"] = run_at
        elmt["student_count"] = student_count
        return this.groupRepository.save(elmt)

      })


    }
    catch (e) {
      success = false
      msg = e
    }

    return {
      "success": success,
      "message": msg
    }

  }
}
