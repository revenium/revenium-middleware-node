import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const metadata = {
    capturePrompts: true,
    organizationName: "acme-corp",
    productName: "ai-assistant",
    taskType: "qa",
  };

  const response = await client.chat().completions().create(
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "What is the capital of France?" },
      ],
    },
    metadata
  );

  console.log("Response:", response.choices[0].message.content);
  console.log("\nPrompt and response captured for analysis.");
}

main().catch(console.error);
