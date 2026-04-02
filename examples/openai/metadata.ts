import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const metadata = {
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

    productName: "ai-assistant-pro",
    taskType: "doc-summary",
    agent: "customer-support",

    traceId: "session-" + Date.now(),

    responseQualityScore: 0.95,
  };

  const response = await client.chat().completions().create(
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Summarize the benefits of API monetization." },
      ],
    },
    metadata
  );

  console.log("Response:", response.choices[0].message.content);
  console.log("\nUsage:", response.usage);
}

main().catch(console.error);
