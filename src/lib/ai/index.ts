import { db } from "@/lib/db/client";
import { aiProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/payment/encryption";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import type { AIProviderClient } from "./types";

export async function getActiveAIProvider(): Promise<AIProviderClient | null> {
  const [config] = await db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.active, true))
    .limit(1);

  if (!config) return null;

  const apiKey = decrypt(config.apiKey);

  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(apiKey, config.model);
    case "openai":
      return new OpenAIProvider(apiKey, config.model);
    default:
      return null;
  }
}

export * from "./types";
