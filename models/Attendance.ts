import mongoose, { Schema, model, models } from 'mongoose'

export interface IAttendance {
  _id: mongoose.Types.ObjectId
  teacherId: string
  studentId: mongoose.Types.ObjectId
  studentName: string
  class: string
  date: string
  status: 'present' | 'absent' | 'late'
  createdAt: Date
  updatedAt: Date
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    // revome the studentName because If student name changes → data becomes inconsistent
    // remove because  Data inconsistency
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  },
  { timestamps: true }
)

AttendanceSchema.index( { teacherId: 1, studentId: 1, date: 1 }, { unique: true })

export const Attendance = models.Attendance ?? model<IAttendance>('Attendance', AttendanceSchema)
