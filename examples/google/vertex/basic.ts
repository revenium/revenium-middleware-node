import 'dotenv/config';
import { VertexAIController } from '@revenium/middleware/google/vertex';

async function main() {
  const controller = new VertexAIController();

  const response = await controller.createChat(
    ['Explain the concept of middleware in software architecture in 2-3 sentences.'],
    'gemini-2.0-flash-001'
  );

  console.log('Response:', response.responses[0].text);
  console.log('\nModel:', response.responses[0].modelVersion);
  console.log('Usage:', {
    totalTokens: response.responses[0].usageMetadata.totalTokenCount,
    promptTokens: response.responses[0].usageMetadata.promptTokenCount,
    candidatesTokens: response.responses[0].usageMetadata.candidatesTokenCount,
  });
}

main().catch(console.error);
