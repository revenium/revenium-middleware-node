import 'dotenv/config';
import '@revenium/middleware/anthropic';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],

    usageMetadata: {
      capturePrompts: true,
      organizationName: 'acme-corp',
      productName: 'ai-assistant',
      taskType: 'qa',
    }
  });

  console.log('Response:', response.content[0]?.text);
  console.log('\nPrompt and response captured for analysis.');
}

main().catch(console.error);
