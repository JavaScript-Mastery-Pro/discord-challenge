import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Attendance } from '@/models/Attendance'
import { z } from 'zod'

const AttendanceSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  class: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(['present', 'absent', 'late']),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const isBulk = Array.isArray(body)
    const parsed = isBulk ? z.array(AttendanceSchema).safeParse(body) : AttendanceSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const today = new Date().toISOString().split('T')[0]
    const data = parsed.data as any

    // BUG FIX: Prevent future dating
    const isFuture = (d: string) => d > today
    if (isBulk ? data.some((r: any) => isFuture(r.date)) : isFuture(data.date)) {
      return NextResponse.json({ error: "Cannot mark attendance for future dates" }, { status: 400 })
    }

    if (isBulk) {
      const ops = data.map((record: any) => ({
        updateOne: {
          filter: { teacherId: userId, studentId: record.studentId, date: record.date },
          update: { $set: { ...record, teacherId: userId } },
          upsert: true,
        },
      }))
      await Attendance.bulkWrite(ops)
      return NextResponse.json({ success: true, count: ops.length })
    } else {
      const record = await Attendance.findOneAndUpdate(
        { teacherId: userId, studentId: data.studentId, date: data.date },
        { $set: { ...data, teacherId: userId } },
        { upsert: true, new: true }
      )
      return NextResponse.json(record, { status: 201 })
    }
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}