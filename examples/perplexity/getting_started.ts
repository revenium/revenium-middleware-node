import 'dotenv/config';
import { Initialize, GetClient, UsageMetadata } from "@revenium/middleware/perplexity";

async function main() {
  Initialize();

  // Get client
  const client = GetClient();
  const metadata: UsageMetadata = {
    organizationName: "org-getting-started",
    productName: "prod-perplexity-getting-started",
    // agenticJobId: "job-abc123",
    // agenticJobName: "Process Loan Application",
    // agenticJobType: "loan-processing",
    // agenticJobVersion: "1.0.0",
  };

  // Create a simple chat completion
  const response = await client
    .chat()
    .completions()
    .create(
      {
        model: "sonar-pro",
        messages: [
          {
            role: "user",
            content: "What is artificial intelligence?",
          },
        ],
        max_tokens: 500,
      },
      metadata
    );

  console.log("Assistant:", response.choices[0]?.message?.content);
  console.log("\nUsage:", response.usage);
}

main().catch(console.error);
