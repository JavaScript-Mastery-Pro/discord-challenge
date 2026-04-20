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
    teacherId: { type: String, required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    class: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v: string) => v.trim().length > 0,
        message: 'Class cannot be empty',
      },
    },
    date: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  },
  { timestamps: true }
)

AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true })

export const Attendance = models.Attendance ?? model<IAttendance>('Attendance', AttendanceSchema)
