import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const response = await client.responses().create({
    model: "my-gpt4-deployment",
    input: "Explain Azure OpenAI Responses API in one paragraph.",
  });

  console.log("Response:", response);
  console.log("\nUsage data sent to Revenium!");
}

main().catch(console.error);
