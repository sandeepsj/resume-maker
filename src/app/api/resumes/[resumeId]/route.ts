import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Comment } from "@/lib/models/Comment";
import { ResumeVersion } from "@/lib/models/ResumeVersion";

export async function GET(_: Request, { params }: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId } = await params;
  await connectDB();
  const resume = await Resume.findOne({ _id: resumeId, userId: session.user.id }).lean();
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(resume);
}

export async function PUT(req: Request, { params }: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId } = await params;
  const body = await req.json();

  await connectDB();
  const resume = await Resume.findOneAndUpdate(
    { _id: resumeId, userId: session.user.id },
    body,
    { returnDocument: 'after' }
  ).lean();

  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(resume);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resumeId } = await params;
  await connectDB();

  const resume = await Resume.findOne({ _id: resumeId, userId: session.user.id });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.all([
    Resume.deleteOne({ _id: resumeId }),
    Comment.deleteMany({ resumeId }),
    ResumeVersion.deleteMany({ resumeId }),
  ]);

  return NextResponse.json({ success: true });
}
