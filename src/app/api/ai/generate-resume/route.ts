import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Experience } from "@/lib/models/Experience";
import { Education } from "@/lib/models/Education";
import { Skill } from "@/lib/models/Skill";
import { UserProfile } from "@/lib/models/UserProfile";
import { ResumeVersion } from "@/lib/models/ResumeVersion";
import { anthropic, AI_MODEL } from "@/lib/anthropic";
import {
  GENERATE_RESUME_SYSTEM_PROMPT,
  buildGenerateResumePrompt,
} from "@/prompts/generate-resume";
import { z } from "zod";
import type { ResumeContent } from "@/types/resume";
import { formatDate } from "@/lib/utils";

const RequestSchema = z.object({
  resumeId: z.string().min(1),
  jobTitle: z.string().min(1),
  companyName: z.string().min(1),
  jobDescription: z.string().min(1),
  selectedExperienceIds: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { resumeId, jobTitle, companyName, jobDescription, selectedExperienceIds } = parsed.data;

  await connectDB();

  // Verify resume ownership
  const resume = await Resume.findOne({ _id: resumeId, userId: session.user.id });
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  // Fetch career data
  const [profile, experiences, educations, skills] = await Promise.all([
    UserProfile.findOne({ userId: session.user.id }).lean(),
    Experience.find({
      userId: session.user.id,
      ...(selectedExperienceIds?.length ? { _id: { $in: selectedExperienceIds } } : {}),
    })
      .sort({ startDate: -1 })
      .lean(),
    Education.find({ userId: session.user.id }).sort({ endDate: -1 }).lean(),
    Skill.find({ userId: session.user.id }).lean(),
  ]);

  // Update resume status
  await Resume.updateOne({ _id: resumeId }, { status: "GENERATING", jobTitle, companyName, jobDescription });

  const userPrompt = buildGenerateResumePrompt({
    profile: {
      id: profile?._id?.toString() ?? "",
      headline: profile?.headline,
      summary: profile?.summary,
      phone: profile?.phone,
      location: profile?.location,
      linkedinUrl: profile?.linkedinUrl,
      githubUrl: profile?.githubUrl,
      portfolioUrl: profile?.portfolioUrl,
    },
    userEmail: session.user.email ?? "",
    userName: session.user.name ?? "",
    experiences: experiences.map((e) => ({
      id: e._id.toString(),
      company: e.company,
      title: e.title,
      location: e.location,
      startDate: formatDate(e.startDate),
      endDate: e.endDate ? formatDate(e.endDate) : undefined,
      isCurrent: e.isCurrent,
      description: e.description,
      highlights: e.highlights,
    })),
    educations: educations.map((edu) => ({
      id: edu._id.toString(),
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      startDate: formatDate(edu.startDate),
      endDate: edu.endDate ? formatDate(edu.endDate) : undefined,
      gpa: edu.gpa,
      honors: edu.honors,
      activities: edu.activities,
    })),
    skills: skills.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      category: s.category,
      level: s.level,
    })),
    jobTitle,
    companyName,
    jobDescription,
  });

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let accumulated = "";

      try {
        const aiStream = await anthropic.messages.stream({
          model: AI_MODEL,
          max_tokens: 4096,
          temperature: 0.3,
          system: GENERATE_RESUME_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        for await (const chunk of aiStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            accumulated += chunk.delta.text;
            const data = JSON.stringify({ type: "chunk", text: chunk.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        // Parse and save the result
        try {
          const content = JSON.parse(accumulated) as ResumeContent;

          // Save version snapshot if there was previous content
          if (resume.content) {
            await ResumeVersion.create({
              resumeId,
              content: resume.content,
              changeLog: "Before AI regeneration",
            });
          }

          await Resume.updateOne(
            { _id: resumeId },
            { content, status: "READY", aiModel: AI_MODEL }
          );

          const doneData = JSON.stringify({ type: "done", resumeId });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
        } catch {
          await Resume.updateOne({ _id: resumeId }, { status: "DRAFT" });
          const errData = JSON.stringify({ type: "error", error: "Failed to parse AI response" });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        }
      } catch (err) {
        await Resume.updateOne({ _id: resumeId }, { status: "DRAFT" });
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
