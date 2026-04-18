import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Announcement } from '@/models/Announcement'

const ALLOWED_FIELDS = ['title', 'content', 'audience', 'category', 'pinned']

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

    // Sanitize: only allow whitelisted fields (map legacy `body` → `content`)
    const sanitizedBody: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        sanitizedBody[key] = body[key]
      }
    }
    if (
      typeof body.body === 'string' &&
      sanitizedBody.content === undefined
    ) {
      sanitizedBody.content = body.body
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
