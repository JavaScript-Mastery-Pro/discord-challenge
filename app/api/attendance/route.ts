import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Attendance } from '@/models/Attendance'
import { Student } from '@/models/Student'
import { normalizeDateOnly } from '@/lib/date'
import { z } from 'zod'

const AttendanceSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(['present', 'absent', 'late']),
})

const BulkSchema = z.array(AttendanceSchema)

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const cls = searchParams.get("class");
    const studentId = searchParams.get("studentId");

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query: Record<string, unknown> = { teacherId: userId };

    if (date) {
      const normalized = normalizeDateOnly(date);
      if (normalized) {
        query.date = normalized;
      } else {
        return NextResponse.json(
          { error: "Invalid date format. Use YYYY-MM-DD or ISO 8601" },
          { status: 400 },
        );
      }
    } else if (startDate || endDate) {
      const dateRange: Record<string, string> = {};
      if (startDate) {
        const normalized = normalizeDateOnly(startDate);
        if (normalized) dateRange.$gte = normalized;
        else
          return NextResponse.json(
            { error: "Invalid startDate format. Use YYYY-MM-DD or ISO 8601" },
            { status: 400 },
          );
      }
      if (endDate) {
        const normalized = normalizeDateOnly(endDate);
        if (normalized) dateRange.$lte = normalized;
        else
          return NextResponse.json(
            { error: "Invalid endDate format. Use YYYY-MM-DD or ISO 8601" },
            { status: 400 },
          );
      }
      query.date = dateRange;
    }
    if (cls) query.class = cls;
    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return NextResponse.json({ error: 'Invalid studentId' }, { status: 400 })
      }
      query.studentId = studentId;
    }

    const records = await Attendance.find(query)
      .sort({ date: -1, studentName: 1 })
      .lean();
    return NextResponse.json(records);
  } catch (err) {
    console.error(
      "GET /api/attendance error:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    // Support both single and bulk
    const isBulk = Array.isArray(body)
    if (isBulk && body.length > 500) {
      return NextResponse.json(
        { error: "Bulk payload exceeds maximum of 500 records" },
        { status: 400 },
      );
    }
    const parsed = isBulk ? BulkSchema.safeParse(body) : AttendanceSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );

    const records = isBulk
      ? (parsed.data as z.infer<typeof BulkSchema>)
      : [parsed.data as z.infer<typeof AttendanceSchema>]

    const normalizedRecords = records.map((record) => {
      const normalizedDate = normalizeDateOnly(record.date)
      if (!normalizedDate) {
        return null
      }

      return {
        ...record,
        date: normalizedDate,
      }
    })

    if (normalizedRecords.some((record) => record === null)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD or ISO 8601' },
        { status: 400 },
      )
    }

    const safeRecords = normalizedRecords as (z.infer<typeof AttendanceSchema> & { date: string })[]

    const studentIds = [...new Set(safeRecords.map((record) => record.studentId))]
    if (!studentIds.every((studentId) => mongoose.Types.ObjectId.isValid(studentId))) {
      return NextResponse.json({ error: 'Invalid studentId' }, { status: 400 })
    }

    const students = await Student.find({
      _id: { $in: studentIds },
      teacherId: userId,
    })
      .select('_id name class')
      .lean()

    const studentMap = new Map(
      students.map((student) => [String(student._id), student]),
    )

    if (studentMap.size !== studentIds.length) {
      return NextResponse.json(
        { error: 'One or more students were not found for this teacher' },
        { status: 400 },
      )
    }

    if (isBulk) {
      const ops = safeRecords.map((record) => {
        const student = studentMap.get(record.studentId)!

        return {
        updateOne: {
          filter: { teacherId: userId, studentId: record.studentId, date: record.date },
          update: {
            $set: {
              teacherId: userId,
              studentId: record.studentId,
              studentName: student.name,
              class: student.class,
              date: record.date,
              status: record.status,
            },
          },
          upsert: true,
        },
      }})
      await Attendance.bulkWrite(ops)
      return NextResponse.json({ success: true, count: ops.length })
    } else {
      const recordData = safeRecords[0]
      const student = studentMap.get(recordData.studentId)!
      const record = await Attendance.findOneAndUpdate(
        { teacherId: userId, studentId: recordData.studentId, date: recordData.date },
        {
          $set: {
            teacherId: userId,
            studentId: recordData.studentId,
            studentName: student.name,
            class: student.class,
            date: recordData.date,
            status: recordData.status,
          },
        },
        { upsert: true, new: true }
      )
      return NextResponse.json(record, { status: 201 })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
