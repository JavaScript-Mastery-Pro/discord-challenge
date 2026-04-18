import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Announcement } from "@/models/Announcement";
import { z } from "zod";

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  audience: z.enum(["all", "students", "staff"]).optional(),
  category: z.enum(["academic", "events", "admin", "general"]).optional(),
  pinned: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    // Parse and validate limit
    const limitStr = searchParams.get("limit") ?? "50";
    let limit = parseInt(limitStr, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      limit = 50;
    }
    limit = Math.min(limit, 100); // Cap at 100

    const announcements = await Announcement.find({ teacherId: userId })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(announcements);
  } catch (error) {
    console.error(
      "GET /api/announcements error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
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

    const recentCount = await Announcement.countDocuments({
      teacherId: userId,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) },
    });

    if (recentCount > 10) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = AnnouncementSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    const data = parsed.data;

    const announcement = await Announcement.create({
      title: data.title,
      content: data.content,
      audience: data.audience ?? "all",
      category: data.category ?? "general",
      pinned: data.pinned ?? false,
      teacherId: userId,
    });
    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      console.error("POST /api/announcements error:", error.message);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
