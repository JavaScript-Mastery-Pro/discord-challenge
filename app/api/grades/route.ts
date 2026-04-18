import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Grade } from '@/models/Grade'
import { z } from 'zod'

const GradeSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  subject: z.string().min(1),
  marks: z.number().min(0),
  maxMarks: z.number().min(1).optional(),
  term: z.string().optional(),
}).refine(
  (data) => !data.maxMarks || data.marks <= data.maxMarks,
  {
    message: 'marks must be less than or equal to maxMarks',
    path: ['marks'],
  }
)

function calcGrade(marks: number, max: number): string {
  const pct = (marks / max) * 100
  if (pct > 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    const subject = searchParams.get('subject')

    const query: Record<string, unknown> = { teacherId: userId }
    if (studentId) query.studentId = studentId
    if (subject) query.subject = subject

    const grades = await Grade.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json(grades)
  } catch (error) {
    console.error('GET /api/grades error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: error instanceof Error ? error.stack : 'Internal server error' }, { status: 500 })
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
    
    const parsed = GradeSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data
    const max = data.maxMarks ?? 100
    const term = data.term ?? 'Term 1'
    
    const grade = await Grade.findOneAndUpdate(
      { teacherId: userId, studentId: data.studentId, subject: data.subject, term },
      { $set: { ...data, term, teacherId: userId, grade: calcGrade(data.marks, max) } },
      { upsert: true, new: true }
    )
    return NextResponse.json(grade, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      console.error('POST /api/grades error:', error.message)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })

  }
}
