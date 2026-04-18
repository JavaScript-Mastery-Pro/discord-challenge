import mongoose, { Schema, model, models } from 'mongoose'

export interface IGrade {
  _id: mongoose.Types.ObjectId
  teacherId: string
  studentId: mongoose.Types.ObjectId
  studentName: string
  subject: string
  marks: number
  maxMarks: number
  grade?: string
  term: string
  createdAt: Date
  updatedAt: Date
}

const GradeSchema = new Schema<IGrade>(
  {
    teacherId: { type: String, required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentName: { type: String, required: true },
    subject: { type: String, required: true },
    marks: {
      type: Number,
      required: true,
      min: 0,
    },
    maxMarks: { type: Number, default: 100, min: 1 },
    grade: { type: String, default: "" },
    term: { type: String, default: "Term 1" },
  },
  { timestamps: true },
);

GradeSchema.pre("save", function () {
  if (this.maxMarks != null && this.marks > this.maxMarks) {
    throw new Error("marks must be less than or equal to maxMarks");
  }
});

GradeSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate() as Record<string, unknown>;
  if (update && typeof update === "object") {
    const set = update.$set as Record<string, unknown> | undefined;
    const marks = typeof update.marks === "number" ? update.marks : set?.marks;
    const maxMarks =
      typeof update.maxMarks === "number" ? update.maxMarks : set?.maxMarks;
    if (
      marks !== undefined && typeof marks === "number" &&
      maxMarks !== undefined && typeof maxMarks === "number" &&
      marks > maxMarks
    ) {
      throw new Error("marks must be less than or equal to maxMarks");
    }
  }
});

GradeSchema.pre("updateOne", function () {
  const update = this.getUpdate() as Record<string, unknown>;
  if (update && typeof update === "object") {
    const set = update.$set as Record<string, unknown> | undefined;
    const marks = typeof update.marks === "number" ? update.marks : set?.marks;
    const maxMarks =
      typeof update.maxMarks === "number" ? update.maxMarks : set?.maxMarks;
    if (
      marks !== undefined && typeof marks === "number" &&
      maxMarks !== undefined && typeof maxMarks === "number" &&
      marks > maxMarks
    ) {
      throw new Error("marks must be less than or equal to maxMarks");
    }
  }
});

GradeSchema.index({ teacherId: 1, studentId: 1, subject: 1, term: 1 }, { unique: true })

export const Grade = models.Grade ?? model<IGrade>('Grade', GradeSchema)
