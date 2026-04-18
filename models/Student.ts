import mongoose, { Schema, model, models } from 'mongoose'

export interface IStudent {
  _id: mongoose.Types.ObjectId
  teacherId: string
  name: string
  rollNo: string
  class: string
  email?: string
  phone?: string
  address?: string
  parentName?: string
  parentPhone?: string
  createdAt: Date
  updatedAt: Date
}

const StudentSchema = new Schema<IStudent>(
  {
    teacherId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true },
    class: { type: String, required: true, trime: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    parentName: { type: String, default: '' },
    parentPhone: { type: String, default: '' },
  },
  { timestamps: true }
)

StudentSchema.index({ teacherId: 1, rollNo: 1 }, { unique: true })

export const Student = models.Student ?? model<IStudent>('Student', StudentSchema)
