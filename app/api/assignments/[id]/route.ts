import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Assignment } from '@/models/Assignment'

const ALLOWED_FIELDS = ['title', 'description', 'dueDate', 'deadline', 'subject', 'class', 'status', 'kanbanStatus', 'maxMarks']

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const sanitized: any = {}
    ALLOWED_FIELDS.forEach(k => { if (k in body) sanitized[k] = body[k] })
    if (Object.keys(sanitized).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

    await connectDB()
    const updated = await Assignment.findOneAndUpdate({ _id: id, teacherId: userId }, { $set: sanitized }, { new: true })
    if (!updated) return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
    return NextResponse.json(updated)
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    await connectDB()
    const deleted = await Assignment.findOneAndDelete({ _id: id, teacherId: userId })
    if (!deleted) return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}