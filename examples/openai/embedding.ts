import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const response = await client.embeddings().create({
    model: "text-embedding-3-small",
    input: "Revenium provides AI usage tracking and monetization.",
  });

  console.log("Embedding dimensions:", response.data[0].embedding.length);
  console.log("Model:", response.model);
  console.log("Usage:", {
    promptTokens: response.usage.prompt_tokens,
    totalTokens: response.usage.total_tokens,
  });
}

main().catch(console.error);
