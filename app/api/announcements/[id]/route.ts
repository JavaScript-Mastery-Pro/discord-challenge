import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Announcement } from '@/models/Announcement'

const ALLOWED_FIELDS = ['title', 'content', 'body', 'audience', 'category', 'pinned', 'expiresAt']

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    await connectDB()
    
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    // Sanitize: only allow whitelisted fields
    const sanitizedBody: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        sanitizedBody[key] = body[key]
      }
    }

    const announcement = await Announcement.findOneAndUpdate(
      { _id: id, teacherId: userId },
      { $set: sanitizedBody },
      { new: true, runValidators: true, context: 'query' }
    )
    if (!announcement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(announcement)
  } catch (error) {
    if (error instanceof Error) {
      console.error('PUT /api/announcements/[id] error:', error.message)
    }
    if (error instanceof mongoose.Error.ValidationError) {
      const firstError = Object.values(error.errors)[0]
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid announcement update' },
        { status: 400 }
      )
    }
    if (error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    await connectDB()
    const deleted = await Announcement.findOneAndDelete({ _id: id, teacherId: userId })
    
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      console.error('DELETE /api/announcements/[id] error:', error.message)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
