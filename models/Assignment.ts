import mongoose, { Schema, model, models } from 'mongoose'

export interface IAssignment {
  _id: mongoose.Types.ObjectId
  teacherId: string
  title: string
  description: string
  subject: string
  class: string
  deadline: Date
  status: 'active' | 'closed'
  kanbanStatus: 'todo' | 'in_progress' | 'submitted'
  maxMarks: number
  createdAt: Date
  updatedAt: Date
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subject: { type: String, required: true },
    class: { type: String, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    kanbanStatus: { type: String, enum: ['todo', 'in_progress', 'submitted'], default: 'todo' },
    maxMarks: { type: Number, default: 100 },
  },
  { timestamps: true }
)

export const Assignment = models.Assignment ?? model<IAssignment>('Assignment', AssignmentSchema)
