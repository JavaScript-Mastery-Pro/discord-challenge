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
    teacherId: { type: String, required: true, index: true, minlength: 1 },
    name: { type: String, required: true, trim: true, minlength: 1 },
    rollNo: { type: String, required: true, trim: true,  uppercase: true,minlength: 1 },
    class: { type: String, required: true, trime: true,minlength: 1 },
    email: {  type: String,
      default: '',
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'], },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    parentName: { type: String, default: '', trim: true },
    parentPhone: { type: String, default: '', trim: true },
  },
  { timestamps: true }
)

StudentSchema.index({ teacherId: 1, class: 1 }, { unique: true });

export const Student = models.Student ?? model<IStudent>('Student', StudentSchema)
