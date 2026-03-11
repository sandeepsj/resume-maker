import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { z } from "zod";

const CreateResumeSchema = z.object({
  title: z.string().min(1),
  jobTitle: z.string().optional(),
  companyName: z.string().optional(),
  jobDescription: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  await connectDB();
  const [resumes, total] = await Promise.all([
    Resume.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-content -jobDescription")
      .lean(),
    Resume.countDocuments({ userId: session.user.id }),
  ]);

  return NextResponse.json({ resumes, total, page });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateResumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const resume = await Resume.create({
    ...parsed.data,
    userId: session.user.id,
    status: "DRAFT",
  });

  return NextResponse.json(resume, { status: 201 });
}
