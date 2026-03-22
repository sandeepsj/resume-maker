import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Experience } from "@/lib/models/Experience";
import { ResumeVersion } from "@/lib/models/ResumeVersion";
import { streamAI } from "@/lib/ai-provider";
import { ADD_EXPERIENCE_SYSTEM_PROMPT, buildAddExperiencePrompt } from "@/prompts/add-experience";
import { z } from "zod";
import type { ResumeContent } from "@/types/resume";
import { formatDate } from "@/lib/utils";

const RequestSchema = z.object({
  resumeId: z.string().min(1),
  experienceId: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { resumeId, experienceId, notes } = parsed.data;

  await connectDB();

  const [resume, experience] = await Promise.all([
    Resume.findOne({ _id: resumeId, userId: session.user.id }),
    Experience.findOne({ _id: experienceId, userId: session.user.id }),
  ]);

  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  if (!experience) return NextResponse.json({ error: "Experience not found" }, { status: 404 });
  if (!resume.content) return NextResponse.json({ error: "Resume has no content" }, { status: 400 });

  const userPrompt = buildAddExperiencePrompt({
    resumeContent: resume.content as ResumeContent,
    experience: {
      id: experience._id.toString(),
      company: experience.company,
      title: experience.title,
      location: experience.location,
      startDate: formatDate(experience.startDate),
      endDate: experience.endDate ? formatDate(experience.endDate) : undefined,
      isCurrent: experience.isCurrent,
      description: experience.description,
      highlights: experience.highlights,
    },
    notes,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let accumulated = "";

      try {
        for await (const text of streamAI(ADD_EXPERIENCE_SYSTEM_PROMPT, userPrompt, { maxTokens: 4096, temperature: 0.1 })) {
          accumulated += text;
          const data = JSON.stringify({ type: "chunk", text });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        try {
          const raw = accumulated.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
          const result = JSON.parse(raw) as {
            updatedResume: ResumeContent;
            explanation: string;
          };

          await ResumeVersion.create({
            resumeId,
            content: resume.content,
            changeLog: `Before adding experience: "${experience.title}" at ${experience.company}`,
          });

          await Resume.updateOne({ _id: resumeId }, { content: result.updatedResume });

          const doneData = JSON.stringify({ type: "done", explanation: result.explanation });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
        } catch {
          const errData = JSON.stringify({ type: "error", error: "Failed to parse AI response" });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        }
      } catch (err) {
        const errData = JSON.stringify({ type: "error", error: String(err) });
        controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
