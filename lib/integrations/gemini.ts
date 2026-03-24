import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

export async function generateText(
  systemPrompt: string,
  userMessage: string,
  model = "gemini-2.0-flash"
): Promise<string> {
  const client = getGeminiClient();
  const generativeModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const result = await generativeModel.generateContent(userMessage);
  return result.response.text();
}
