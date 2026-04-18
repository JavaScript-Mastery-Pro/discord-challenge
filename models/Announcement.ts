import mongoose, { Schema, model, models } from 'mongoose'

export interface IAnnouncement {
  _id: mongoose.Types.ObjectId
  teacherId: string
  title: string
  content: string
  audience: string
  category: 'academic' | 'events' | 'admin' | 'general'
  pinned: boolean
  createdAt: Date
  updatedAt: Date
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    audience: { type: String, default: 'All' },
    category: { type: String, enum: ['academic', 'events', 'admin', 'general'], default: 'general' },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const Announcement =
  models.Announcement ?? model<IAnnouncement>('Announcement', AnnouncementSchema)
