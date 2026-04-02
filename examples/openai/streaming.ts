import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const stream = await client.chat().completions().createStreaming(
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Write a short poem about technology." },
      ],
      stream: true,
    }
  );

  process.stdout.write("Response: ");
  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }

  console.log("\n\nStreaming complete! Usage data sent to Revenium.");
}

main().catch(console.error);
