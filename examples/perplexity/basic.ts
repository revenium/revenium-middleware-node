import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/perplexity";

async function main() {
  Initialize();
  const client = GetClient();

  const response = await client.chat().completions().create({
    model: "sonar-pro",
    messages: [
      {
        role: "user",
        content: "What are the key differences between REST and GraphQL APIs?",
      },
    ],
    max_tokens: 500,
  });

  console.log("Response:", response.choices[0]?.message?.content);
  console.log("\nModel:", response.model);
  console.log("Usage:", response.usage);
}

main().catch(console.error);
