import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();

  const client = GetClient();

  const metadata = {
    organizationName: "org-getting-started-demo",
    productName: "prod-getting-started",
    // agenticJobId: "job-abc123",
    // agenticJobName: "Process Loan Application",
    // agenticJobType: "loan-processing",
    // agenticJobVersion: "1.0.0",
  };

  const params = {
    model: "gpt-4",
    messages: [
      {
        role: "user" as const,
        content: "Hello! Introduce yourself in one sentence.",
      },
    ],
  };

  const response = await client.chat().completions().create(params, metadata);

  console.log(response.choices[0].message.content);
  console.log("\nUsage data sent to Revenium!");
}

main().catch(console.error);
