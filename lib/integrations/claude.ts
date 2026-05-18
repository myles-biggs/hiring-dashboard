import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

function getClaudeClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export class ClaudeValidationError extends Error {
  constructor(
    public readonly cause: unknown,
    public readonly rawOutput: string
  ) {
    super("Claude response failed schema validation");
  }
}

export async function generateStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>
): Promise<T> {
  const client = getClaudeClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: `${systemPrompt}\n\nRespond with valid JSON only. Do not include markdown code fences, commentary, or any text outside the JSON object.`,
    messages: [{ role: "user", content: userPrompt }],
  });

  const firstBlock = message.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const rawOutput = firstBlock.text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch (err) {
    throw new ClaudeValidationError(err, rawOutput);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ClaudeValidationError(result.error, rawOutput);
  }

  return result.data;
}
