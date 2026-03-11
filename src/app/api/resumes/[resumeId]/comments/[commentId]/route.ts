import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Comment } from "@/lib/models/Comment";
import { z } from "zod";

const UpdateSchema = z.object({
  status: z.enum(["DISMISSED"]).optional(),
});

async function verifyResumeOwner(resumeId: string, userId: string) {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  return resume;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ resumeId: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId, commentId } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();

  const resume = await verifyResumeOwner(resumeId, session.user.id as string);
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, resumeId },
    { ...parsed.data },
    { new: true }
  ).lean();

  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  return NextResponse.json(comment);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ resumeId: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId, commentId } = await params;
  await connectDB();

  const resume = await verifyResumeOwner(resumeId, session.user.id as string);
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  const result = await Comment.deleteOne({ _id: commentId, resumeId });
  if (result.deletedCount === 0) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
