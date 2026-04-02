import 'dotenv/config';
import '@revenium/middleware/anthropic';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
  const anthropic = new Anthropic();

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Write a short poem about technology.' }
    ],
  });

  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  process.stdout.write('Response: ');
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
    if (event.type === 'message_delta' && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
    if (event.type === 'message_start' && event.message?.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
  }

  console.log('\n\nUsage:', { inputTokens, outputTokens });
}

main().catch(console.error);
