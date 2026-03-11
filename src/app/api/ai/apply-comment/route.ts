import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Comment } from "@/lib/models/Comment";
import { ResumeVersion } from "@/lib/models/ResumeVersion";
import { anthropic, AI_MODEL } from "@/lib/anthropic";
import { APPLY_COMMENT_SYSTEM_PROMPT, buildApplyCommentPrompt } from "@/prompts/apply-comment";
import { z } from "zod";
import type { ResumeContent } from "@/types/resume";

const RequestSchema = z.object({
  resumeId: z.string().min(1),
  commentId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { resumeId, commentId } = parsed.data;

  await connectDB();

  const [resume, comment] = await Promise.all([
    Resume.findOne({ _id: resumeId, userId: session.user.id }),
    Comment.findOne({ _id: commentId, resumeId }),
  ]);

  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  if (!resume.content) return NextResponse.json({ error: "Resume has no content" }, { status: 400 });

  await Comment.updateOne({ _id: commentId }, { status: "PROCESSING" });

  const userPrompt = buildApplyCommentPrompt({
    resumeContent: resume.content as ResumeContent,
    sectionKey: comment.sectionKey,
    selectedText: comment.selectedText,
    commentBody: comment.body,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let accumulated = "";

      try {
        const aiStream = await anthropic.messages.stream({
          model: AI_MODEL,
          max_tokens: 4096,
          temperature: 0.1,
          system: APPLY_COMMENT_SYSTEM_PROMPT,
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

        // Parse and apply
        try {
          const parsed = JSON.parse(accumulated) as {
            updatedResume: ResumeContent;
            explanation: string;
          };

          // Snapshot before edit
          await ResumeVersion.create({
            resumeId,
            content: resume.content,
            changeLog: `Before applying comment: "${comment.body}"`,
          });

          await Promise.all([
            Resume.updateOne({ _id: resumeId }, { content: parsed.updatedResume }),
            Comment.updateOne(
              { _id: commentId },
              { status: "APPLIED", aiResponse: parsed.explanation, resolvedAt: new Date() }
            ),
          ]);

          const doneData = JSON.stringify({
            type: "done",
            explanation: parsed.explanation,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
        } catch {
          await Comment.updateOne({ _id: commentId }, { status: "PENDING" });
          const errData = JSON.stringify({ type: "error", error: "Failed to parse AI response" });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        }
      } catch (err) {
        await Comment.updateOne({ _id: commentId }, { status: "PENDING" });
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
