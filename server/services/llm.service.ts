import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "../../config/env.js";

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type LlmProvider = "openai" | "anthropic";

export const llmService = {
  defaultProvider(): LlmProvider | null {
    if (env.OPENAI_API_KEY?.trim()) return "openai";
    if (env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
    return null;
  },

  async *streamChat(
    messages: ChatMessage[],
    options: {
      provider?: LlmProvider;
      model?: string;
    } = {},
  ): AsyncGenerator<string, void, undefined> {
    const provider = options.provider ?? this.defaultProvider();
    if (!provider) {
      throw new Error("No LLM API key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)");
    }
    if (provider === "openai") {
      yield* streamOpenAI(messages, options.model);
      return;
    }
    yield* streamAnthropic(messages, options.model);
  },
};

async function* streamOpenAI(
  messages: ChatMessage[],
  model = "gpt-4o-mini",
): AsyncGenerator<string, void, undefined> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const client = new OpenAI({ apiKey: key });
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });
  for await (const part of stream) {
    const t = part.choices[0]?.delta?.content;
    if (t) yield t;
  }
}

async function* streamAnthropic(
  messages: ChatMessage[],
  model = "claude-3-5-haiku-20241022",
): AsyncGenerator<string, void, undefined> {
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey: key });
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const systemText = system.map((m) => m.content).join("\n\n") || undefined;
  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemText,
    messages: rest.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  });
  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      yield ev.delta.text;
    }
  }
}
