import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Grade } from '@/models/Grade'
import { z } from 'zod'

const StudentIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: 'Invalid studentId',
})

const GradeUpdateSchema = z.object({
  studentId: StudentIdSchema.optional(),
  studentName: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  marks: z.number().min(0).optional(),
  maxMarks: z.number().min(1).optional(),
  term: z.string().min(1).optional(),
})

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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const parsed = GradeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await connectDB()
    const existing = await Grade.findOne({ _id: id, teacherId: userId })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const marks = parsed.data.marks ?? existing.marks
    const maxMarks = parsed.data.maxMarks ?? existing.maxMarks
    if (marks > maxMarks) {
      return NextResponse.json(
        { error: { fieldErrors: { marks: ['marks must be less than or equal to maxMarks'] } } },
        { status: 400 },
      )
    }

    const grade = await Grade.findOneAndUpdate(
      { _id: id, teacherId: userId },
      {
        $set: {
          ...parsed.data,
          grade: calcGrade(marks, maxMarks),
        },
      },
      { new: true, runValidators: true, context: 'query' }
    )
    if (!grade) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(grade)
  } catch (error) {
    if (error instanceof Error) {
      console.error('PUT /api/grades/[id] error:', error.message)
    }
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'A grade for this student, subject, and term already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    await connectDB()
    const deleted = await Grade.findOneAndDelete({ _id: id, teacherId: userId })
    
    if (!deleted) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      console.error('DELETE /api/grades/[id] error:', error.message)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
