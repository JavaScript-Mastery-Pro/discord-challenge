import mongoose, { Schema, model, models } from 'mongoose'

export interface IAcademicHistoryEntry {
  year: string
  title: string
  description?: string
}

export interface ITeacher {
  _id: mongoose.Types.ObjectId
  clerkId: string
  name: string
  email: string
  department: string
  subjects: string[]
  phone?: string
  bio?: string
  academicHistory: IAcademicHistoryEntry[]
  createdAt: Date
  updatedAt: Date
}

const TeacherSchema = new Schema<ITeacher>(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: {  type: String,
      required: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'], },
    department: { type: String, default: "", trim: true },
    subjects: { type: [String], default: [] },
    phone: { type: String, default: "" },
    bio: { type: String, default: "" },
    academicHistory: {
      type: [
        {
          year: { type: String, required: true },
          title: { type: String, required: true },
          description: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Teacher = models.Teacher ?? model<ITeacher>('Teacher', TeacherSchema)
