import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Student } from '@/models/Student'
import { Attendance } from '@/models/Attendance'
import { Grade } from '@/models/Grade'

const ALLOWED_UPDATE_FIELDS = ['name', 'email', 'rollNo', 'class', 'phone', 'address', 'parentName', 'parentPhone']

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    // Sanitize: only allow whitelisted fields
    const sanitizedBody: Record<string, unknown> = {}
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in body) {
        sanitizedBody[key] = body[key]
      }
    }

    if (Object.keys(sanitizedBody).length === 0) {
      return NextResponse.json({ error: 'No valid student fields provided' }, { status: 400 })
    }

    await connectDB()
    const student = await Student.findOneAndUpdate(
      { _id: id, teacherId: userId },
      sanitizedBody,
      { new: true, runValidators: true, context: 'query' }
    )
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(student)
  } catch (error) {
    if (error instanceof Error) {
      console.error('PUT /api/students/[id] error:', error.message)
    }
    if (error instanceof mongoose.Error.ValidationError) {
      const firstError = Object.values(error.errors)[0]
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid student update' },
        { status: 400 }
      )
    }
    if (error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'A student with this roll number already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    await connectDB()
    const deleted = await Student.findOneAndDelete({ _id: id, teacherId: userId })
    
    if (!deleted) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    await Promise.all([
      Attendance.deleteMany({ teacherId: userId, studentId: id }),
      Grade.deleteMany({ teacherId: userId, studentId: id }),
    ])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      console.error('DELETE /api/students/[id] error:', error.message)
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
