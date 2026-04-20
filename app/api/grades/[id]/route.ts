import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Grade } from '@/models/Grade'

const ALLOWED_UPDATE_FIELDS = ['marks', 'maxMarks', 'grade']

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const sanitizedBody: Record<string, unknown> = {}
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in body) {
        sanitizedBody[key] = body[key]
      }
    }

    await connectDB()

    // 1. Find first to ensure ownership
    const existingGrade = await Grade.findOne({ _id: id, teacherId: userId })
    if (!existingGrade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 2. Apply whitelisted updates
    Object.assign(existingGrade, sanitizedBody)

    // 3. Recalculate grade string if marks changed
    if (existingGrade.marks != null && existingGrade.maxMarks != null) {
      const percentage = (existingGrade.marks / existingGrade.maxMarks) * 100
      if (percentage >= 90) existingGrade.grade = 'A+'
      else if (percentage >= 80) existingGrade.grade = 'A'
      else if (percentage >= 70) existingGrade.grade = 'B'
      else existingGrade.grade = 'F'
    }

    // 4. Save the document
    await existingGrade.save()
    return NextResponse.json(existingGrade)

  } catch (error) {
    if (error instanceof Error) {
      console.error('PUT /api/grades/[id] error:', error.message)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Only teachers can delete their own grades
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