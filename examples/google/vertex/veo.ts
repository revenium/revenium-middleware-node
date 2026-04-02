import 'dotenv/config';
import { VertexAIController } from '@revenium/middleware/google/vertex';

async function main() {
  const controller = new VertexAIController();

  const response = await controller.generateVideo({
    model: 'veo-002',
    prompt: 'A timelapse of clouds moving over a mountain range at golden hour',
    duration: 5,
    aspectRatio: '16:9',
  });

  console.log('Video generated!');
  console.log('Transaction ID:', response.transactionId);
  console.log('Model:', response.model);
  console.log('Videos count:', response.response.videos.length);

  if (response.response.operationId) {
    console.log('Operation ID:', response.response.operationId);
  }
}

main().catch(console.error);
