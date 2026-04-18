import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Grade } from '@/models/Grade'
import { calculateLetterGrade } from '@/lib/grading'

const ALLOWED_UPDATE_FIELDS = ['studentId', 'studentName', 'subject', 'term', 'marks', 'maxMarks']

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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const payload = body as Record<string, unknown>
    const unknownFields = Object.keys(payload).filter((key) => !ALLOWED_UPDATE_FIELDS.includes(key))
    if (unknownFields.length > 0) {
      return NextResponse.json({ error: `Unknown field(s): ${unknownFields.join(', ')}` }, { status: 400 })
    }

    // Sanitize: only allow whitelisted fields
    const sanitizedBody: Record<string, unknown> = {}
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        sanitizedBody[key] = payload[key]
      }
    }

    if (Object.keys(sanitizedBody).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    if ('studentId' in sanitizedBody) {
      const studentId = sanitizedBody.studentId
      if (typeof studentId !== 'string' || !mongoose.Types.ObjectId.isValid(studentId)) {
        return NextResponse.json({ error: 'studentId must be a valid id' }, { status: 400 })
      }
    }

    if ('studentName' in sanitizedBody && typeof sanitizedBody.studentName !== 'string') {
      return NextResponse.json({ error: 'studentName must be a string' }, { status: 400 })
    }
    if ('subject' in sanitizedBody && typeof sanitizedBody.subject !== 'string') {
      return NextResponse.json({ error: 'subject must be a string' }, { status: 400 })
    }
    if ('term' in sanitizedBody && typeof sanitizedBody.term !== 'string') {
      return NextResponse.json({ error: 'term must be a string' }, { status: 400 })
    }

    if ('marks' in sanitizedBody) {
      const marks = sanitizedBody.marks
      if (typeof marks !== 'number' || Number.isNaN(marks) || marks < 0) {
        return NextResponse.json({ error: 'marks must be a number >= 0' }, { status: 400 })
      }
    }
    if ('maxMarks' in sanitizedBody) {
      const maxMarks = sanitizedBody.maxMarks
      if (typeof maxMarks !== 'number' || Number.isNaN(maxMarks) || maxMarks < 1) {
        return NextResponse.json({ error: 'maxMarks must be a number >= 1' }, { status: 400 })
      }
    }

    await connectDB()

    const existingGrade = await Grade.findOne({ _id: id, teacherId: userId })
    if (!existingGrade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nextMarks = typeof sanitizedBody.marks === 'number' ? sanitizedBody.marks : existingGrade.marks
    const nextMaxMarks = typeof sanitizedBody.maxMarks === 'number' ? sanitizedBody.maxMarks : (existingGrade.maxMarks ?? 100)

    if (nextMarks > nextMaxMarks) {
      return NextResponse.json({ error: 'marks must be less than or equal to maxMarks' }, { status: 400 })
    }

    const grade = await Grade.findOneAndUpdate(
      { _id: id, teacherId: userId },
      {
        ...sanitizedBody,
        maxMarks: nextMaxMarks,
        grade: calculateLetterGrade(nextMarks, nextMaxMarks),
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
