import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Student } from '@/models/Student'
import { z } from 'zod'

const StudentSchema = z.object({
  name: z.string().min(1),
  rollNo: z.string().min(1),
  class: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
})

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") ?? "").replace(/\s+/g, ' ');
    const classFilter = searchParams.get("class") ?? "";

    // Parse and validate pagination
    const pageStr = searchParams.get("page") ?? "1";
    const limitStr = searchParams.get("limit") ?? "20";

    let page = parseInt(pageStr, 10);
    let limit = parseInt(limitStr, 10);

    if (Number.isNaN(page) || page < 1) page = 1;
    if (Number.isNaN(limit) || limit < 1) limit = 20;
    limit = Math.min(limit, 100); // Cap at 100

    const query: Record<string, unknown> = { teacherId: userId };
    if (search) {
      // Escape regex special characters to prevent ReDoS
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { rollNo: { $regex: escapedSearch, $options: "i" } },
        { class: { $regex: escapedSearch, $options: "i" } },
      ];
    }
    // Add class filter if provided and not 'all'
    if (classFilter && classFilter !== "all") {
      query.class = classFilter;
    }

    const [students, total] = await Promise.all([
      Student.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(query),
    ]);

    return NextResponse.json({
      students,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('GET /api/students error:', error.message)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
    }
    
    StudentSchema.safeParse(body)

    const student = await Student.create({ ...(body as Record<string, unknown>), teacherId: userId })
    return NextResponse.json(student, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      console.error('POST /api/students error:', error.message)
    }
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'A student with this roll number already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
//new changes

