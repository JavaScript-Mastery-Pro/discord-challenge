import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Grade } from "@/models/Grade";

const ALLOWED_UPDATE_FIELDS = ["marks", "maxMarks", "grade"];

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await ctx.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Sanitize: only allow whitelisted fields
    const sanitizedBody: Record<string, unknown> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in body) {
        sanitizedBody[key] = body[key];
      }
    }

    await connectDB();
    const grade = await Grade.findOneAndUpdate(
      { _id: id, teacherId: userId },
      sanitizedBody,
      { new: true, runValidators: true, context: "query" },
    );
    if (!grade)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(grade);
  } catch (error) {
    if (error instanceof Error) {
      console.error("PUT /api/grades/[id] error:", error.message);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Grade.findOneAndDelete({
      _id: id,
      teacherId: userId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error("DELETE /api/grades/[id] error:", error.message);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
