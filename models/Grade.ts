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

function pickNumberFromUpdate(update: Record<string, unknown>, field: "marks" | "maxMarks"): number | undefined {
  const direct = update[field];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;

  const $set = update.$set;
  if ($set && typeof $set === "object") {
    const setValue = ($set as Record<string, unknown>)[field];
    if (typeof setValue === "number" && Number.isFinite(setValue)) return setValue;
  }

  return undefined;
}

async function validateMarksMaxMarksOnUpdate(this: mongoose.Query<unknown, IGrade>) {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (!update || typeof update !== "object") return;

  let nextMarks = pickNumberFromUpdate(update, "marks");
  let nextMaxMarks = pickNumberFromUpdate(update, "maxMarks");

  if (nextMarks === undefined && nextMaxMarks === undefined) return;

  if (nextMarks === undefined || nextMaxMarks === undefined) {
    const currentRaw = await this.model.findOne(this.getQuery()).select("marks maxMarks").lean();
    if (currentRaw && typeof currentRaw === "object") {
      const current = currentRaw as { marks?: unknown; maxMarks?: unknown };
      if (nextMarks === undefined && typeof current.marks === "number") nextMarks = current.marks;
      if (nextMaxMarks === undefined && typeof current.maxMarks === "number") nextMaxMarks = current.maxMarks;
    }

    // For upsert flows where maxMarks is omitted, schema default is 100.
    if (nextMarks !== undefined && nextMaxMarks === undefined) {
      nextMaxMarks = 100;
    }
  }

  if (
    nextMarks !== undefined &&
    nextMaxMarks !== undefined &&
    nextMarks > nextMaxMarks
  ) {
    throw new Error("marks must be less than or equal to maxMarks");
  }
}

GradeSchema.pre("findOneAndUpdate", validateMarksMaxMarksOnUpdate);
GradeSchema.pre("updateOne", validateMarksMaxMarksOnUpdate);

GradeSchema.index({ teacherId: 1, studentId: 1, subject: 1, term: 1 }, { unique: true })

export const Grade = models.Grade ?? model<IGrade>('Grade', GradeSchema)
