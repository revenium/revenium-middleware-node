import 'dotenv/config';
import { Initialize, GetClient, UsageMetadata } from "@revenium/middleware/perplexity";

async function main() {
  Initialize();
  const client = GetClient();

  const metadata: UsageMetadata = {
    capturePrompts: true,
    organizationName: "acme-corp",
    productName: "ai-search",
    taskType: "qa",
  };

  const response = await client.chat().completions().create(
    {
      model: "sonar-pro",
      messages: [
        { role: "user", content: "What is the capital of France?" },
      ],
      max_tokens: 200,
    },
    metadata
  );

  console.log("Response:", response.choices[0]?.message?.content);
  console.log("\nPrompt and response captured for analysis.");
}

main().catch(console.error);
