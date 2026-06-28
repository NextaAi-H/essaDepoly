import type { AiProvider } from "./provider.ts";
import { MockProvider } from "./mock.ts";
import { OpenAiProvider } from "./openai.ts";

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  const key = process.env.OPENAI_API_KEY?.trim();

  if (provider === "openai" && key) {
    cached = new OpenAiProvider(key, process.env.OPENAI_MODEL ?? "gpt-4o");
  } else {
    if (provider === "openai" && !key) {
      console.warn("[ai] AI_PROVIDER=openai but OPENAI_API_KEY is empty — falling back to mock provider.");
    }
    cached = new MockProvider();
  }

  console.log(`[ai] using provider: ${cached.name}`);
  return cached;
}
