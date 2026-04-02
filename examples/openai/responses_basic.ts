import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const response = await client.responses().create({
    model: "gpt-4o-mini",
    input: "Explain what the OpenAI Responses API is in one paragraph.",
  });

  console.log("Response:", response);
  console.log("\nUsage data sent to Revenium!");
}

main().catch(console.error);
