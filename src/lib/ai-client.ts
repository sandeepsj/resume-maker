/**
 * AI client that calls the centralized llm-proxy.
 *
 * Proxy URL: https://llm-proxy-smoky.vercel.app/api/proxy
 * Auth: Google access token in Authorization header
 * Streaming: Anthropic SSE format (event: content_block_delta)
 */

import type { ResumeContent } from "@/types/resume";

const LLM_PROXY_URL =
  import.meta.env.VITE_LLM_PROXY_URL || "https://llm-proxy-smoky.vercel.app";

const DEFAULT_MODEL = "claude-opus-4-8";
const APPLY_EDIT_MODEL = "claude-sonnet-4-6";

/** Models the user can pick from when generating a resume. First entry is the default. */
export const AVAILABLE_MODELS: { id: string; label: string }[] = [
  { id: "claude-opus-4-8", label: "Opus 4.8 — best quality (recommended)" },
  { id: "claude-opus-4-7", label: "Opus 4.7" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — faster" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest" },
];

export const RESUME_DEFAULT_MODEL = DEFAULT_MODEL;

/**
 * Opus 4.7/4.8 and Fable 5 removed the `temperature` sampling param — sending it
 * returns a 400. Omit it for those models; everything else keeps the default.
 */
function omitsSamplingParams(model: string): boolean {
  return /^claude-(opus-4-(7|8)|fable-5)/.test(model);
}

interface StreamAIOptions {
  systemPrompt: string;
  userPrompt: string;
  accessToken: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  onChunk?: (text: string) => void;
}

/**
 * Streams an Anthropic completion via the llm-proxy.
 * Returns the full accumulated text when the stream completes.
 */
export async function streamAI(options: StreamAIOptions): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    accessToken,
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.3,
    onChunk,
  } = options;

  const res = await fetch(`${LLM_PROXY_URL}/api/proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      provider: "anthropic",
      endpoint: "messages",
      body: {
        model,
        max_tokens: maxTokens,
        // Opus 4.7/4.8 and Fable 5 removed `temperature`; omit it for those models
        ...(omitsSamplingParams(model) ? {} : { temperature }),
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        stream: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Proxy error: ${res.status}`);
  }

  // Parse Anthropic SSE stream
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      try {
        const event = JSON.parse(raw);

        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          const text = event.delta.text;
          fullText += text;
          onChunk?.(text);
        }
      } catch {
        // partial JSON, skip
      }
    }
  }

  return fullText;
}

/**
 * Calls AI to generate a resume, streams chunks, returns parsed ResumeContent.
 */
export async function generateResume(params: {
  systemPrompt: string;
  userPrompt: string;
  accessToken: string;
  model?: string;
  onChunk?: (text: string) => void;
}): Promise<ResumeContent> {
  const fullText = await streamAI({
    ...params,
    maxTokens: 8192,
    temperature: 0.3,
  });

  return parseJsonFromAI(fullText) as unknown as ResumeContent;
}

/**
 * Calls AI to apply a comment edit or add experience, returns { updatedResume, explanation }.
 */
export async function applyAIEdit(params: {
  systemPrompt: string;
  userPrompt: string;
  accessToken: string;
  onChunk?: (text: string) => void;
}): Promise<{ updatedResume: ResumeContent; explanation: string }> {
  const fullText = await streamAI({
    ...params,
    model: APPLY_EDIT_MODEL,
    maxTokens: 4096,
    temperature: 0.1,
  });

  const parsed = parseJsonFromAI(fullText);
  return {
    updatedResume: (parsed.updatedResume ?? parsed) as unknown as ResumeContent,
    explanation: (parsed.explanation as string) ?? "Edit applied",
  };
}

function parseJsonFromAI(text: string): Record<string, unknown> {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }
}
