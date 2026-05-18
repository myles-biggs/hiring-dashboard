import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

const CLAUDE_MODEL = "claude-sonnet-4-5";
export { CLAUDE_MODEL };

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function generateStructured<T>(
  systemPrompt: string,
  userMessage: string,
  schema: ZodType<T>,
  model = CLAUDE_MODEL
): Promise<T> {
  const client = getClient();

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const cleaned = block.text
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as unknown;
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Claude output failed schema validation: ${result.error.message}`);
  }

  return result.data;
}
