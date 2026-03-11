import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Education } from "@/lib/models/Education";
import { z } from "zod";

const EducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  gpa: z.string().optional().nullable(),
  honors: z.string().optional().nullable(),
  activities: z.array(z.string()).default([]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const educations = await Education.find({ userId: session.user.id })
    .sort({ endDate: -1 })
    .lean();

  return NextResponse.json(educations);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = EducationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const education = await Education.create({
    ...parsed.data,
    userId: session.user.id,
    startDate: new Date(parsed.data.startDate),
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
  });

  return NextResponse.json(education, { status: 201 });
}
