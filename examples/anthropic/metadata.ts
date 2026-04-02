import 'dotenv/config';
import '@revenium/middleware/anthropic';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Summarize the benefits of API monetization.' }
    ],

    usageMetadata: {
      subscriber: {
        id: 'user-123',
        email: 'user@example.com',
        credential: {
          name: 'api-key-prod',
          value: 'key-abc-123'
        }
      },

      organizationName: 'acme-corp',
      subscriptionId: 'plan-enterprise-2024',

      productName: 'ai-assistant-pro',
      taskType: 'doc-summary',
      agent: 'customer-support',

      traceId: 'session-' + Date.now(),

      responseQualityScore: 0.95
    }
  });

  console.log('Response:', response.content[0]?.text);
  console.log('\nUsage:', {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });
}

main().catch(console.error);
