import mongoose, { Schema, model, models } from "mongoose";

export interface IAnnouncement {
  _id: mongoose.Types.ObjectId;
  teacherId: string;
  title: string;
  content: string;
  audience: string;
  category: "academic" | "events" | "admin" | "general";
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    teacherId: {
      type: String,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, minlength: 3 },
    content: { type: String, required: true, trim: true, minlength: 5 },
    audience: { type: String, enum: ["All", "CS-A", "CS-B"], default: "All" },
    category: {
      type: String,
      enum: ["academic", "events", "admin", "general"],
      default: "general",
    },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AnnouncementSchema.index({ teacherId: 1, pinned: 1 });

AnnouncementSchema.index({ teacherId: 1, createdAt: -1 });

export const Announcement =
  models.Announcement ??
  model<IAnnouncement>("Announcement", AnnouncementSchema);