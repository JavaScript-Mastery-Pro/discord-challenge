import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Grade } from '@/models/Grade'

const ALLOWED_UPDATE_FIELDS = ['studentId', 'studentName', 'subject', 'term', 'marks', 'maxMarks']

function calcGrade(marks: number, max: number): string {
  const pct = (marks / max) * 100
  if (pct >= 90) return 'A+'
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    // Sanitize: only allow whitelisted fields
    const sanitizedBody: Record<string, unknown> = {}
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in body) {
        sanitizedBody[key] = body[key]
      }
    }

    await connectDB()

    const existingGrade = await Grade.findOne({ _id: id, teacherId: userId })
    if (!existingGrade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nextMarks =
      typeof sanitizedBody.marks === 'number' ? sanitizedBody.marks : existingGrade.marks
    const nextMaxMarks =
      typeof sanitizedBody.maxMarks === 'number' ? sanitizedBody.maxMarks : existingGrade.maxMarks

    sanitizedBody.grade = calcGrade(nextMarks, nextMaxMarks)

    const grade = await Grade.findOneAndUpdate(
      { _id: id, teacherId: userId },
      { $set: sanitizedBody },
      { new: true, runValidators: true, context: 'query' }
    )
    return NextResponse.json(grade)
  } catch (error) {
    if (error instanceof Error) {
      console.error('PUT /api/grades/[id] error:', error.message)
    }
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'A grade already exists for this student, subject, and term' }, { status: 409 })
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
