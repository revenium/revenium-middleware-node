import 'dotenv/config';
import { VertexAIController } from '@revenium/middleware/google/vertex';

async function main() {
  const controller = new VertexAIController();

  const response = await controller.generateImage({
    model: 'imagen-3.0-generate-002',
    prompt: 'A serene mountain landscape at sunset with a lake reflection',
    numberOfImages: 1,
    aspectRatio: '16:9',
  });

  console.log('Image generated!');
  console.log('Transaction ID:', response.transactionId);
  console.log('Model:', response.model);
  console.log('Images count:', response.response.images.length);

  if (response.response.images[0]?.bytesBase64Encoded) {
    console.log('Image data available (base64 encoded)');
  }
}

main().catch(console.error);
