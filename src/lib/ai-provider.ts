/**
 * Unified AI provider abstraction.
 *
 * Set AI_PROVIDER in your .env to switch between providers:
 *   anthropic | gemini | openai | deepseek | ollama
 *
 * Set AI_MODEL to override the default model for the active provider.
 */

export type AIProvider = "anthropic" | "gemini" | "openai" | "deepseek" | "ollama";

export const ACTIVE_PROVIDER = (process.env.AI_PROVIDER ?? "anthropic") as AIProvider;

/** Default model per provider — override with AI_MODEL env var */
const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  gemini:    "gemini-2.0-flash",
  openai:    "gpt-4o",
  deepseek:  "deepseek-chat",
  ollama:    "llama3.2",
};

export const AI_MODEL = process.env.AI_MODEL ?? DEFAULT_MODELS[ACTIVE_PROVIDER];

interface StreamOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Streams text chunks from the configured AI provider.
 * Returns an async generator — iterate with `for await (const chunk of streamAI(...))`.
 */
export async function* streamAI(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  const { maxTokens = 4096, temperature = 0.3 } = options;

  switch (ACTIVE_PROVIDER) {
    case "anthropic":
      yield* streamAnthropic(systemPrompt, userPrompt, maxTokens, temperature);
      break;
    case "gemini":
      yield* streamGemini(systemPrompt, userPrompt, maxTokens, temperature);
      break;
    case "openai":
      yield* streamOpenAICompatible(
        systemPrompt, userPrompt, maxTokens, temperature,
        process.env.OPENAI_API_KEY!,
        "https://api.openai.com/v1",
      );
      break;
    case "deepseek":
      yield* streamOpenAICompatible(
        systemPrompt, userPrompt, maxTokens, temperature,
        process.env.DEEPSEEK_API_KEY!,
        "https://api.deepseek.com",
      );
      break;
    case "ollama":
      yield* streamOpenAICompatible(
        systemPrompt, userPrompt, maxTokens, temperature,
        "ollama",
        process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
      );
      break;
    default:
      throw new Error(
        `Unknown AI_PROVIDER: "${ACTIVE_PROVIDER}". ` +
        `Valid values: anthropic, gemini, openai, deepseek, ollama`,
      );
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function* streamAnthropic(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
): AsyncGenerator<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text;
    }
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

async function* streamGemini(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
): AsyncGenerator<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const result = await ai.models.generateContentStream({
    model: AI_MODEL,
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: { systemInstruction: system, maxOutputTokens: maxTokens, temperature },
  });

  for await (const chunk of result) {
    yield chunk.text ?? "";
  }
}

// ─── OpenAI-compatible (OpenAI, DeepSeek, Ollama) ────────────────────────────

async function* streamOpenAICompatible(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  apiKey: string,
  baseURL: string,
): AsyncGenerator<string> {
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, baseURL });

  const stream = await client.chat.completions.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    yield chunk.choices[0]?.delta?.content ?? "";
  }
}
