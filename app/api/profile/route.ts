import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Teacher } from "@/models/Teacher";
import { updateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const queryUserId = searchParams.get("userId");

  let userId: string | null = queryUserId;
  if (!userId) {
    const session = await auth();
    userId = session.userId;
  }
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    let teacher = await Teacher.findOne({ clerkId: userId }).lean();

    if (!teacher) {
      const clerkUser = await currentUser();
      const created = await Teacher.create({
        clerkId: userId,
        name: clerkUser?.fullName ?? "",
        email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
        department: "",
        subjects: [],
      });
      teacher = created.toObject();
    }

    return NextResponse.json(teacher);
  } catch (error) {
    console.error(
      "GET /api/profile error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { name, department, subjects, phone, bio, academicHistory } = body;

    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const updatePayload = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined),
    );

    const teacher = await Teacher.findOneAndUpdate(
      { clerkId: userId },
      { $set: updatePayload },
      { new: true },
    );

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    return NextResponse.json(teacher);
  } catch (error) {
    if (error instanceof Error) {
      console.error("PUT /api/profile error:", error.message);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
