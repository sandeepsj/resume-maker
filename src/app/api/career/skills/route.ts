import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Skill } from "@/lib/models/Skill";
import { z } from "zod";

const SkillSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["TECHNICAL", "LANGUAGE", "SOFT", "TOOL", "FRAMEWORK", "CERTIFICATION"]),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const skills = await Skill.find({ userId: session.user.id })
    .sort({ category: 1, name: 1 })
    .lean();

  return NextResponse.json(skills);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = SkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const skill = await Skill.create({
    ...parsed.data,
    userId: session.user.id,
  });

  return NextResponse.json(skill, { status: 201 });
}
