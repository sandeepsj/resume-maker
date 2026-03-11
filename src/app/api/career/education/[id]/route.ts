import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Education } from "@/lib/models/Education";
import { z } from "zod";

const UpdateSchema = z.object({
  institution: z.string().min(1).optional(),
  degree: z.string().min(1).optional(),
  field: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  gpa: z.string().optional().nullable(),
  honors: z.string().optional().nullable(),
  activities: z.array(z.string()).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const education = await Education.findOne({ _id: id, userId: session.user.id }).lean();
  if (!education) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(education);
}

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
  const update = {
    ...parsed.data,
    ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
    ...(parsed.data.endDate && { endDate: new Date(parsed.data.endDate) }),
  };

  const education = await Education.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    update,
    { new: true }
  ).lean();

  if (!education) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(education);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const result = await Education.deleteOne({ _id: id, userId: session.user.id });
  if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
