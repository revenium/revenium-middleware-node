import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const response = await client.chat().completions().create({
    model: "my-gpt4-deployment",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What are the benefits of using Azure OpenAI Service?" },
    ],
    max_tokens: 500,
  });

  console.log("Response:", response.choices[0].message.content);
  console.log("\nModel:", response.model);
  console.log("Usage:", response.usage);
}

main().catch(console.error);
