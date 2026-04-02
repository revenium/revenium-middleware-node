import 'dotenv/config';
import '@revenium/middleware/anthropic';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Explain the concept of middleware in software architecture in 2-3 sentences.'
      }
    ],
  });

  console.log('Response:', response.content[0]?.text);
  console.log('\nModel:', response.model);
  console.log('Stop reason:', response.stop_reason);
  console.log('Usage:', {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });
}

main().catch(console.error);
