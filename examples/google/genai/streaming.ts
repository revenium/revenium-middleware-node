import 'dotenv/config';
import { GoogleGenAIController } from '@revenium/middleware/google/genai';

async function main() {
  const controller = new GoogleGenAIController();

  const response = await controller.createStreaming(
    ['Write a short poem about technology.'],
    'gemini-2.0-flash-001'
  );

  console.log('Streaming response:');
  for await (const chunk of response.stream) {
    const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      process.stdout.write(text);
    }
  }

  console.log('\n\nStreaming complete! Usage data sent to Revenium.');
}

main().catch(console.error);
