import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Assignment } from '@/models/Assignment'
import { z } from 'zod'

const AssignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  subject: z.string().min(1),
  class: z.string().min(1),
  deadline: z.string().min(1),
  maxMarks: z.number().min(1).default(100),
  status: z.enum(['active', 'closed']).default('active'),
  kanbanStatus: z.enum(['todo', 'in_progress', 'submitted']).default('todo'),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const pageStr = searchParams.get('page') ?? '1'
    const limitStr = searchParams.get('limit') ?? '20'

    let page = parseInt(pageStr, 10)
    let limit = parseInt(limitStr, 10)

    if (!Number.isFinite(page) || page < 1) page = 1
    if (!Number.isFinite(limit) || limit < 1) limit = 20
    limit = Math.min(limit, 100)

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
    console.error('GET /api/assignments error:', error instanceof Error ? error.message : error)
    // FIX: Removed .stack leak
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const parsed = AssignmentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // FIX: Deadline validation (Prevent past dates)
    if (new Date(parsed.data.deadline) < new Date()) {
      return NextResponse.json({ error: 'Deadline cannot be in the past' }, { status: 400 });
    }

    const assignment = await Assignment.create({ ...parsed.data, teacherId: userId })
    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('POST /api/assignments error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}