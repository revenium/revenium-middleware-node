import { GoogleGenAI, Chat } from "@google/genai";
import { getLogger } from "../../_core/config/manager.js";
import {
  GoogleUsageMetadata,
  IGoogleResponse,
  IGoogleResponseChat,
  IGoogleStreamingResponse,
  IGoogleEmbeddingResponse,
  IGoogleImageResponse,
  IGoogleVideoResponse,
  IImageGenerationRequest,
  IImageEditRequest,
  IImageUpscaleRequest,
  IVideoGenerationRequest,
  IVideoExtendRequest,
  IVideoUpscaleRequest,
} from "../types.js";
import { trackGoogleUsageAsync, generateTransactionId } from "../utils.js";

export class GoogleGenAIService {
  private client: GoogleGenAI;
  private model: string = "gemini-2.0-flash-001";

  constructor(model: string) {
    this.model = model ?? this.model;
    this.client = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY ?? "",
    });
  }

  private buildResponseObject(response: any): IGoogleResponse {
    return {
      text: response.text ?? "",
      modelVersion: response.modelVersion ?? "",
      responseId: response.responseId ?? "",
      usageMetadata: {
        totalTokenCount: response.usageMetadata?.totalTokenCount ?? 0,
        promptTokenCount: response.usageMetadata?.promptTokenCount ?? 0,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount ?? 0,
        promptTokensDetails: response.usageMetadata?.promptTokensDetails ?? [],
        thoughtsTokenCount: response.usageMetadata?.thoughtsTokenCount ?? 0,
      },
    };
  }

  private extractHistories(chat: Chat): string[] {
    const histories: string[] = [];
    const history = chat.getHistory();
    for (const item of history) {
      histories.push(item?.parts?.[0]?.text ?? "");
    }
    return histories;
  }

  public createChat = async (
    prompts: string[],
    usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleResponseChat> => {
    const logger = getLogger();
    const chat = this.client.chats.create({ model: this.model });
    const result: IGoogleResponse[] = [];

    for (const prompt of prompts) {
      const startTime = new Date();
      const transactionId = generateTransactionId();
      const response = await chat.sendMessage({ message: prompt });
      const endTime = new Date();

      result.push(this.buildResponseObject(response));

      void trackGoogleUsageAsync({
        transactionId,
        model: this.model,
        startTime,
        endTime,
        response,
        operationType: "CHAT",
        isStreaming: false,
        modelSource: "GOOGLE",
        usageMetadata,
        prompts: [prompt],
      }).catch((error) =>
        logger.warn("Metering send failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    const histories = this.extractHistories(chat);
    return { histories, responses: result };
  };

  public createStreaming = async (
    prompts: string[],
    usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleStreamingResponse> => {
    const logger = getLogger();
    const startTime = new Date();
    const transactionId = generateTransactionId();

    const originalStream = await this.client.models.generateContentStream({
      model: this.model,
      contents: prompts.join("\n"),
    });

    const model = this.model;

    const wrappedStream: AsyncIterable<any> = {
      [Symbol.asyncIterator]: async function* () {
        let firstTokenTime: Date | undefined;
        let lastResponse: any = null;

        try {
          for await (const chunk of originalStream) {
            if (!firstTokenTime) {
              firstTokenTime = new Date();
            }
            lastResponse = chunk;
            yield chunk;
          }
        } finally {
          const timeToFirstToken = firstTokenTime
            ? firstTokenTime.getTime() - startTime.getTime()
            : undefined;

          void trackGoogleUsageAsync({
            transactionId,
            model,
            startTime,
            endTime: new Date(),
            response: lastResponse,
            operationType: "CHAT",
            isStreaming: true,
            modelSource: "GOOGLE",
            usageMetadata,
            prompts,
            timeToFirstToken,
          }).catch((error) =>
            logger.warn("Streaming metering failed", {
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      },
    };

    return {
      stream: wrappedStream,
      length: prompts.length,
      isStreaming: true,
    };
  };

  public createEmbedding = async (
    prompt: string,
    usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleEmbeddingResponse> => {
    const logger = getLogger();
    const startTime = new Date();
    const transactionId = generateTransactionId();

    const response = await this.client.models.embedContent({
      model: this.model,
      contents: prompt,
    });

    const endTime = new Date();

    void trackGoogleUsageAsync({
      transactionId,
      model: this.model,
      startTime,
      endTime,
      response,
      operationType: "EMBED",
      isStreaming: false,
      modelSource: "GOOGLE",
      usageMetadata,
      prompts: [prompt],
    }).catch((error) =>
      logger.warn("Embedding metering failed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    const extendedResponse = response as typeof response & {
      modelVersion?: string;
      usageMetadata?: { totalTokenCount?: number; promptTokenCount?: number };
    };
    return {
      embedding: {
        embedding: response.embeddings?.[0]?.values ?? [],
        modelVersion: extendedResponse.modelVersion ?? "",
        usageMetadata: {
          totalTokenCount: extendedResponse.usageMetadata?.totalTokenCount ?? 0,
          promptTokenCount: extendedResponse.usageMetadata?.promptTokenCount ?? 0,
        },
      },
    };
  };

  public generateImage = async (
    _request: IImageGenerationRequest,
    _usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleImageResponse> => {
    throw new Error(
      "Imagen (image generation) is only available through Vertex AI, not Google AI Studio. " +
        "Please use the google/vertex subpath instead.",
    );
  };

  public editImage = async (
    _request: IImageEditRequest,
    _usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleImageResponse> => {
    throw new Error(
      "Imagen (image editing) is only available through Vertex AI, not Google AI Studio. " +
        "Please use the google/vertex subpath instead.",
    );
  };

  public upscaleImage = async (
    _request: IImageUpscaleRequest,
    _usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleImageResponse> => {
    throw new Error(
      "Imagen (image upscaling) is only available through Vertex AI, not Google AI Studio. " +
        "Please use the google/vertex subpath instead.",
    );
  };

  public generateVideo = async (
    _request: IVideoGenerationRequest,
    _usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleVideoResponse> => {
    throw new Error(
      "Veo (video generation) is only available through Vertex AI, not Google AI Studio. " +
        "Please use the google/vertex subpath instead.",
    );
  };

  public extendVideo = async (
    _request: IVideoExtendRequest,
    _usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleVideoResponse> => {
    throw new Error(
      "Veo (video extension) is only available through Vertex AI, not Google AI Studio. " +
        "Please use the google/vertex subpath instead.",
    );
  };

  public upscaleVideo = async (
    _request: IVideoUpscaleRequest,
    _usageMetadata?: GoogleUsageMetadata,
  ): Promise<IGoogleVideoResponse> => {
    throw new Error(
      "Veo (video upscaling) is only available through Vertex AI, not Google AI Studio. " +
        "Please use the google/vertex subpath instead.",
    );
  };
}
