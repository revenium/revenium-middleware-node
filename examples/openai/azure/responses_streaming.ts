import 'dotenv/config';
import { Initialize, GetClient } from "@revenium/middleware/openai";

async function main() {
  Initialize();
  const client = GetClient();

  const stream = await client.responses().createStreaming({
    model: "my-gpt4-deployment",
    input: "Write a haiku about Azure cloud services.",
  });

  process.stdout.write("Response: ");
  for await (const event of stream) {
    if ((event as any).type === 'response.output_text.delta' && (event as any).delta) {
      process.stdout.write((event as any).delta);
    }
  }

  console.log("\n\nStreaming complete! Usage data sent to Revenium.");
}

main().catch(console.error);
