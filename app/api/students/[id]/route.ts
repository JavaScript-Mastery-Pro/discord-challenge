import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Student } from '@/models/Student'

const ALLOWED_UPDATE_FIELDS = ['name', 'email', 'grade', 'rollNo', 'class', 'phone', 'address', 'parentName', 'parentPhone']

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const sanitizedBody: any = {}
    ALLOWED_UPDATE_FIELDS.forEach(k => { if (k in body) sanitizedBody[k] = body[k] })
    if (Object.keys(sanitizedBody).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    await connectDB()
    const student = await Student.findOneAndUpdate({ _id: id, teacherId: userId }, { $set: sanitizedBody }, { new: true })
    if (!student) return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
    return NextResponse.json(student)
  } catch { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    await connectDB()
    const deleted = await Student.findOneAndDelete({ _id: id, teacherId: userId })
    if (!deleted) return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }) }
}