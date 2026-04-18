import mongoose, { Schema, model, models } from 'mongoose'

export interface IAssignment {
  _id: mongoose.Types.ObjectId
  teacherId: mongoose.Types.ObjectId
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
    title: { type: String, required: true, trim: true, minlength: 3 },
    description: { type: String, default: '', maxlength: 1000 },
    subject: {
      type: String,
      enum: ['Mathematics', 'Data Structures', 'Operating Systems', 'DBMS', 'Computer Networks'],
      required: true
    },
    class: {
      type: String,
      enum: ['CS-A', 'CS-B'],
      required: true
    },
    deadline: {
      type: Date,
      required: true,
      validate: {
        validator: (value: Date) => value > new Date(),
        message: 'Deadline must be in the future'
      }
    },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    kanbanStatus: { type: String, enum: ['todo', 'in_progress', 'submitted'], default: 'todo' },
    maxMarks: { type: Number, default: 100, min: 1, max: 1000 },
  },
  { timestamps: true }
)

// ✅ Correct indexes
AssignmentSchema.index({ teacherId: 1, class: 1 })
AssignmentSchema.index({ status: 1 })
AssignmentSchema.index({ deadline: 1 })

export const Assignment =
  models.Assignment ?? model<IAssignment>('Assignment', AssignmentSchema)
