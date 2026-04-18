import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { connectDB } from '@/lib/mongodb'
import { Student } from '@/models/Student'

const StudentUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  rollNo: z.string().min(1).optional(),
  class: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
})

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

    const parsed = StudentUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await connectDB()
    const student = await Student.findOneAndUpdate(
      { _id: id, teacherId: userId },
      { $set: parsed.data },
      { new: true, runValidators: true, context: 'query' }
    )
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(student)
  } catch (error) {
    if (error instanceof Error) {
      console.error('PUT /api/students/[id] error:', error.message)
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
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      console.error('DELETE /api/students/[id] error:', error.message)
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
