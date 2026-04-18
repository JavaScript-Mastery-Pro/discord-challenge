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
    name: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, default: "" },
    subjects: { type: [String], default: [] },
    phone: { type: String, default: "" },
    bio: { type: String, default: "" },
    academicHistory: {
      type: [
        {
          year: { type: String, required: true, maxlength: 10 },
          title: { type: String, required: true, maxlength: 200 },
          description: { type: String, maxlength: 2000 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Teacher = models.Teacher ?? model<ITeacher>('Teacher', TeacherSchema)
