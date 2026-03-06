import type { OperationType } from "../_core/types/index.js";
import { getLogger } from "../_core/config/manager.js";

const IMAGE_PATTERNS =
  /flux|stable-diffusion|recraft|bria|imagen|nano-banana|sdxl|dreambooth|photomaker|face-swap|upscale\/image|background\/remove|nsfw|illusion|controlnet|ip-adapter|inpaint|img2img|omnigen|cat-vton|try-on/i;

const VIDEO_PATTERNS =
  /video|motion|animate|runway|luma|kling|veo|sora|ltx|minimax-video|cogvideo|hunyuan|wan|mochi|haiper/i;

const AUDIO_PATTERNS =
  /audio|speech|voice|tts|whisper|chatterbox|lava-sr|sfx|sound|music|f5-tts|dia|kokoro|mars6|parler/i;

const CHAT_PATTERNS = /openrouter|llm|text-generation/i;

export function detectFromEndpointId(endpointId: string): OperationType {
  if (AUDIO_PATTERNS.test(endpointId)) return "AUDIO";
  if (CHAT_PATTERNS.test(endpointId)) return "CHAT";
  if (VIDEO_PATTERNS.test(endpointId)) return "VIDEO";
  if (IMAGE_PATTERNS.test(endpointId)) return "IMAGE";

  const logger = getLogger();
  logger.warn("Unknown fal.ai endpoint type, defaulting to IMAGE", { endpointId });
  return "IMAGE";
}

function getPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const queryIndex = url.indexOf("?");
    return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  }
}

export function correctFromResponse(initialType: OperationType, response: unknown): OperationType {
  if (!response || typeof response !== "object") return initialType;

  const res = response as Record<string, unknown>;
  const fileUrlPath =
    typeof res.file_url === "string" ? getPathname(res.file_url).toLowerCase() : "";

  if (res.video || fileUrlPath.endsWith(".mp4")) return "VIDEO";

  if (res.audio_url || res.audio || fileUrlPath.endsWith(".mp3") || fileUrlPath.endsWith(".wav"))
    return "AUDIO";

  if (res.images && Array.isArray(res.images)) return "IMAGE";

  if (res.usage && typeof res.usage === "object") return "CHAT";

  return initialType;
}

export function detectMediaType(endpointId: string, response?: unknown): OperationType {
  const estimated = detectFromEndpointId(endpointId);
  if (!response) return estimated;
  return correctFromResponse(estimated, response);
}
