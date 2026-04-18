import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Teacher } from "@/models/Teacher";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const clerkUser = await currentUser();
    const teacher = await Teacher.findOneAndUpdate(
      { clerkId: userId },
      {
        $setOnInsert: {
          clerkId: userId,
          name: clerkUser?.fullName ?? "",
          email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? "",
          department: "",
          subjects: [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
    );

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

    // Validate input
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name must be a non-empty string" },
        { status: 400 },
      );
    }
    if (department !== undefined && typeof department !== "string") {
      return NextResponse.json(
        { error: "department must be a string" },
        { status: 400 },
      );
    }
    if (
      !Array.isArray(subjects) ||
      !subjects.every((s) => typeof s === "string")
    ) {
      return NextResponse.json(
        { error: "subjects must be an array of strings" },
        { status: 400 },
      );
    }
    if (phone !== undefined && typeof phone !== "string") {
      return NextResponse.json(
        { error: "phone must be a string" },
        { status: 400 },
      );
    }
    if (bio !== undefined && typeof bio !== "string") {
      return NextResponse.json(
        { error: "bio must be a string" },
        { status: 400 },
      );
    }
    if (academicHistory !== undefined) {
      if (
        !Array.isArray(academicHistory) ||
        academicHistory.length > 20 ||
        !academicHistory.every((entry: unknown) => {
          if (entry === null || typeof entry !== "object") return false;
          const record = entry as Record<string, unknown>;
          if (typeof record.year !== "string" || record.year.length > 10)
            return false;
          if (typeof record.title !== "string" || record.title.length > 200)
            return false;
          if (
            record.description !== undefined &&
            (typeof record.description !== "string" ||
              record.description.length > 2000)
          ) {
            return false;
          }
          return true;
        })
      ) {
        return NextResponse.json(
          {
            error:
              "academicHistory must be an array of objects with year/title strings (year<=10, title<=200, optional description<=2000, max 20 items)",
          },
          { status: 400 },
        );
      }
    }

    const updatePayload: Record<string, unknown> = { name, subjects };
    if (department !== undefined) updatePayload.department = department;
    if (phone !== undefined) updatePayload.phone = phone;
    if (bio !== undefined) updatePayload.bio = bio;
    if (academicHistory !== undefined)
      updatePayload.academicHistory = academicHistory;

    const teacher = await Teacher.findOneAndUpdate(
      { clerkId: userId },
      { $set: updatePayload, $setOnInsert: { clerkId: userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

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
