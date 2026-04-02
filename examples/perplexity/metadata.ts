import 'dotenv/config';
import { Initialize, GetClient, UsageMetadata } from "@revenium/middleware/perplexity";

async function main() {
  Initialize();
  const client = GetClient();

  const metadata: UsageMetadata = {
    subscriber: {
      id: "user-123",
      email: "user@example.com",
      credential: {
        name: "api-key-prod",
        value: "key-abc-123",
      },
    },

    organizationName: "acme-corp",
    subscriptionId: "plan-enterprise-2024",

    productName: "ai-search-pro",
    taskType: "research",
    agent: "research-assistant",

    traceId: "session-" + Date.now(),

    responseQualityScore: 0.9,
  };

  const response = await client.chat().completions().create(
    {
      model: "sonar-pro",
      messages: [
        { role: "user", content: "What are the latest developments in quantum computing?" },
      ],
      max_tokens: 500,
    },
    metadata
  );

  console.log("Response:", response.choices[0]?.message?.content);
  console.log("\nUsage:", response.usage);
}

main().catch(console.error);
