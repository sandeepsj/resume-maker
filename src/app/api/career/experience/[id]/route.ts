import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Experience } from "@/lib/models/Experience";
import { z } from "zod";

const UpdateSchema = z.object({
  company: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  isCurrent: z.boolean().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const experience = await Experience.findOne({ _id: id, userId: session.user.id }).lean();
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(experience);
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

  const experience = await Experience.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    update,
    { returnDocument: 'after' }
  ).lean();

  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(experience);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const result = await Experience.deleteOne({ _id: id, userId: session.user.id });
  if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
