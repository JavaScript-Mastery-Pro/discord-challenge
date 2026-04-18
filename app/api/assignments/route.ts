import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Assignment } from '@/models/Assignment'
import { z } from 'zod'

const SUBJECTS = ['Mathematics', 'Data Structures', 'Operating Systems', 'DBMS', 'Computer Networks'] as const;
const CLASSES = ['CS-A', 'CS-B'] as const;

const AssignmentSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().max(1000).optional(),
  subject: z.enum(SUBJECTS),
  class: z.enum(CLASSES),
  deadline: z.string().refine((value) => new Date(value) > new Date(), 'Deadline must be in the future'),
  maxMarks: z.number().min(1).max(1000).optional(),
  status: z.enum(['active', 'closed']).optional(),
  kanbanStatus: z.enum(['todo', 'in_progress', 'submitted']).optional(),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    
    // Parse and validate pagination
    const pageStr = searchParams.get('page') ?? '1'
    const limitStr = searchParams.get('limit') ?? '20'
    
    let page = parseInt(pageStr, 10)
    let limit = parseInt(limitStr, 10)
    
    if (!Number.isFinite(page) || page < 1) page = 1
    if (!Number.isFinite(limit) || limit < 1) limit = 20
    limit = Math.min(limit, 100) // Cap at 100

    const query: Record<string, unknown> = { teacherId: userId }
    if (status) query.status = status

    const skip = (page - 1) * limit
    const assignments = await Assignment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    
    const total = await Assignment.countDocuments(query)

    return NextResponse.json({ assignments, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    if (error instanceof Error) {
      console.error('GET /api/assignments error:', error.message)
    }
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
    
    const parsed = AssignmentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    try {
      const assignment = await Assignment.create({ ...parsed.data, teacherId: userId })
      return NextResponse.json(assignment, { status: 201 })
    } catch (dbError) {
      if (dbError instanceof Error) {
        console.error('Assignment.create error:', dbError.message)
      }
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('POST /api/assignments error:', error.message)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
