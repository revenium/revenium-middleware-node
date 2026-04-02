import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/perplexity";

async function main() {
  Initialize();
  const client = GetClient();

  const stream = await client.chat().completions().createStreaming(
    {
      model: "sonar-pro",
      messages: [
        { role: "user", content: "What are the latest trends in AI?" },
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
