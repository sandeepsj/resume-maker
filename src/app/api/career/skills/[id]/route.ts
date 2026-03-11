import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Skill } from "@/lib/models/Skill";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["TECHNICAL", "LANGUAGE", "SOFT", "TOOL", "FRAMEWORK", "CERTIFICATION"]).optional(),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const skill = await Skill.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    parsed.data,
    { new: true }
  ).lean();

  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(skill);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const result = await Skill.deleteOne({ _id: id, userId: session.user.id });
  if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
