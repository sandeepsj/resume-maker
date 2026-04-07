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

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

interface StreamAIOptions {
  systemPrompt: string;
  userPrompt: string;
  accessToken: string;
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
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        temperature,
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
  onChunk?: (text: string) => void;
}): Promise<ResumeContent> {
  const fullText = await streamAI({
    ...params,
    maxTokens: 4096,
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
