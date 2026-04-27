import 'dotenv/config';
import '@revenium/middleware/anthropic';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
  // Create Anthropic client
  const anthropic = new Anthropic();

  // Chat completion with metadata
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    messages: [
      { role: 'user', content: 'Please verify you are ready to assist me.' }
    ],

    /* Optional metadata for advanced reporting, lineage tracking, and cost allocation
    usageMetadata: {
      // User identification
      subscriber: {
        id: 'user-123',
        email: 'user@example.com',
        credential: {
          name: 'api-key-prod',
          value: 'key-abc-123'
        }
      },

      // Organization & billing
      organizationName: 'my-customers-name',
      subscriptionId: 'plan-enterprise-2024',

      // Product & task tracking
      productName: 'my-product',
      taskType: 'doc-summary',
      agent: 'customer-support',

      // Session tracking
      traceId: 'session-' + Date.now(),

      // Quality metrics
      responseQualityScore: 0.95,

      // Agentic job tracking
      agenticJobId: 'job-abc123',
      agenticJobName: 'Process Loan Application',
      agenticJobType: 'loan-processing',
      agenticJobVersion: '1.0.0'
    }
    */
  });

  console.log('Response:', response.content[0]?.text);
}

main().catch(console.error);
