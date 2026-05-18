import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

export const CLAUDE_MODEL = "claude-sonnet-4-5";

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
  system: string,
  user: string,
  schema: ZodType<T>
): Promise<T> {
  const client = getClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const cleaned = block.text
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude response was not valid JSON: ${block.text.slice(0, 200)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Claude response failed schema validation: ${result.error.message}`);
  }

  return result.data;
}
