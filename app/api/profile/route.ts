import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Teacher } from '@/models/Teacher'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const queryUserId = searchParams.get('userId')

  let userId: string | null = queryUserId
  if (!userId) {
    const session = await auth()
    userId = session.userId
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    let teacher = await Teacher.findOne({ clerkId: userId }).lean()

    if (!teacher) {
      const clerkUser = await currentUser()
      if (!clerkUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const created = await Teacher.create({
        clerkId: userId,
        name: clerkUser?.fullName ?? '',
        email: clerkUser?.emailAddresses[0]?.emailAddress ?? '',
        department: '',
        subjects: [],
      })
      teacher = created.toObject()
    }

    return NextResponse.json(teacher)
  } catch (error) {
    console.error('GET /api/profile error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
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
    
    const { name, department, subjects, phone, bio, academicHistory } = body

    // Validate input
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
    }
    if (department !== undefined && typeof department !== 'string') {
      return NextResponse.json({ error: 'department must be a string' }, { status: 400 })
    }
    if ( !Array.isArray(subjects) ||
    !subjects.every(s => typeof s === 'string' && s.trim().length > 0)) {
      return NextResponse.json({ error: 'subjects must be an array of strings' }, { status: 400 })
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone must be a string' }, { status: 400 })
    }
    if (bio !== undefined && typeof bio !== 'string') {
      return NextResponse.json({ error: 'bio must be a string' }, { status: 400 })
    }
    if (academicHistory !== undefined) {
      if (
        !Array.isArray(academicHistory) ||
        academicHistory.length > 20 ||
        !academicHistory.every(
          (entry: unknown) =>
            entry !== null &&
            typeof entry === 'object' &&
            typeof (entry as Record<string, unknown>).year === 'string' &&
            typeof (entry as Record<string, unknown>).title === 'string',
        )
      ) {
        return NextResponse.json(
          { error: 'academicHistory must be an array of objects with string year and title (max 20 items)' },
          { status: 400 },
        )
      }
    }

    const updatePayload: Record<string, unknown> = { name, subjects }
    if (department !== undefined) updatePayload.department = department
    if (phone !== undefined) updatePayload.phone = phone
    if (bio !== undefined) updatePayload.bio = bio
    if (academicHistory !== undefined) updatePayload.academicHistory = academicHistory

    const teacher = await Teacher.findOneAndUpdate(
      { clerkId: userId },
      { $set: updatePayload },
      { new: true }
    )
    
    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }

    return NextResponse.json(teacher)
  } catch (error) {
    if (error instanceof Error) {
      console.error('PUT /api/profile error:', error.message)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
