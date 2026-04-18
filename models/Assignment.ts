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
    title: {type: String, required: true, trim: true, minlength: 3},
    description: { type: String, default: '', maxlength: 1000 },
    subject: {enum: ['Mathematics', 'Data Structures', 'Operating Systems', 'DBMS', 'Computer Networks']},
    class: { enum: ['CS-A', 'CS-B'] },
    deadline: { validate: {
      validator: (value: Date) => value > new Date(),
      message: 'Deadline must be in the future'
    } },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    kanbanStatus: { type: String, enum: ['todo', 'in_progress', 'submitted'], default: 'todo' },
    maxMarks: { type: Number, default: 100 },
  },
  { timestamps: true }
)

export const Assignment = models.Assignment ?? model<IAssignment>('Assignment', AssignmentSchema)
