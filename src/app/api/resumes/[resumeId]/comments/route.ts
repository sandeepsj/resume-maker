import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Comment } from "@/lib/models/Comment";
import { z } from "zod";

const CommentSchema = z.object({
  sectionKey: z.string().min(1),
  selectedText: z.string().min(1),
  anchorOffset: z.number(),
  focusOffset: z.number(),
  body: z.string().min(1),
});

export async function GET(_: Request, { params }: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId } = await params;
  await connectDB();

  const resume = await Resume.findOne({ _id: resumeId, userId: session.user.id });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await Comment.find({ resumeId }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(comments);
}

export async function POST(req: Request, { params }: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId } = await params;
  const body = await req.json();
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const resume = await Resume.findOne({ _id: resumeId, userId: session.user.id });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await Comment.create({ ...parsed.data, resumeId });
  return NextResponse.json(comment, { status: 201 });
}
