import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const response = await client.chat().completions().create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Explain the concept of middleware in software architecture in 2-3 sentences." },
    ],
    max_tokens: 500,
  });

  console.log("Response:", response.choices[0].message.content);
  console.log("\nModel:", response.model);
  console.log("Finish reason:", response.choices[0].finish_reason);
  console.log("Usage:", {
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
  });
}

main().catch(console.error);
