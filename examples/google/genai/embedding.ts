import 'dotenv/config';
import { GoogleGenAIController } from '@revenium/middleware/google/genai';

async function main() {
  const controller = new GoogleGenAIController();

  const response = await controller.createEmbedding(
    'Revenium provides AI usage tracking and monetization.',
    'text-embedding-004'
  );

  const embedding = Array.isArray(response.embedding)
    ? response.embedding
    : response.embedding.embedding;

  console.log('Embedding dimensions:', embedding.length);
  console.log('First 5 values:', embedding.slice(0, 5));
  console.log('\nEmbedding generated! Usage data sent to Revenium.');
}

main().catch(console.error);
