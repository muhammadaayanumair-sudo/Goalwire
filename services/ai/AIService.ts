import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { FantasyPlayerPool } from "../../types/fantasy";

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

type AIProvider = "gemini" | "groq" | "mistral";

interface AIMessage {
  role: "system" | "user";
  content: string;
}

interface GenerateOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  preferredProvider?: AIProvider;
}

const PROVIDER_FALLBACK_ORDER: AIProvider[] = ["groq", "gemini", "mistral"];
const DEFAULT_TIMEOUT_MS = 15000;

export class AIService {
  private clients: Partial<Record<AIProvider, AxiosInstance>> = {};

  constructor() {
    if (config.apis.groq.key) {
      this.clients.groq = axios.create({
        baseURL: "https://api.groq.com/openai/v1",
        timeout: DEFAULT_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${config.apis.groq.key}` },
      });
    }

    if (config.apis.mistral.key) {
      this.clients.mistral = axios.create({
        baseURL: "https://api.mistral.ai/v1",
        timeout: DEFAULT_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${config.apis.mistral.key}` },
      });
    }

    if (config.apis.gemini.key) {
      this.clients.gemini = axios.create({
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        timeout: DEFAULT_TIMEOUT_MS,
      });
    }
  }

  public async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const providerOrder = options.preferredProvider
      ? [options.preferredProvider, ...PROVIDER_FALLBACK_ORDER.filter((p) => p !== options.preferredProvider)]
      : PROVIDER_FALLBACK_ORDER;

    const availableProviders = providerOrder.filter((provider) => this.clients[provider]);

    if (availableProviders.length === 0) {
      throw new AIServiceError("No AI providers are configured.");
    }

    let lastError: unknown;

    for (const provider of availableProviders) {
      try {
        return await this.callProvider(provider, prompt, options);
      } catch (error) {
        lastError = error;
        logger.warn(`AI provider ${provider} failed, trying next fallback`, {
          error: (error as Error).message,
        });
      }
    }

    logger.error("All AI providers failed", { error: lastError });
    throw new AIServiceError("All configured AI providers failed to respond.");
  }

  private async callProvider(
    provider: AIProvider,
    prompt: string,
    options: GenerateOptions,
  ): Promise<string> {
    switch (provider) {
      case "groq":
        return this.callOpenAiCompatible(this.clients.groq!, "llama-3.3-70b-versatile", prompt, options, "groq");
      case "mistral":
        return this.callOpenAiCompatible(this.clients.mistral!, config.apis.mistral.model, prompt, options, "mistral");
      case "gemini":
        return this.callGemini(prompt, options);
      default:
        throw new AIServiceError(`Unknown provider: ${provider}`);
    }
  }

  private async callOpenAiCompatible(
    client: AxiosInstance,
    model: string,
    prompt: string,
    options: GenerateOptions,
    provider: string,
  ): Promise<string> {
    try {
      const messages: AIMessage[] = [];
      if (options.systemPrompt) {
        messages.push({ role: "system", content: options.systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const response = await client.post("/chat/completions", {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 500,
      });

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) throw new AIServiceError(`Empty response from ${provider}`, provider);

      return content.trim();
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new AIServiceError(
        `${provider} request failed: ${axiosError.message}`,
        provider,
      );
    }
  }

  private async callGemini(prompt: string, options: GenerateOptions): Promise<string> {
    try {
      const fullPrompt = options.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt;

      const response = await this.clients.gemini!.post(
        `/models/${config.apis.gemini.model}:generateContent`,
        {
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 500,
          },
        },
        { params: { key: config.apis.gemini.key } },
      );

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new AIServiceError("Empty response from gemini", "gemini");

      return content.trim();
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new AIServiceError(`gemini request failed: ${axiosError.message}`, "gemini");
    }
  }

  public async generateFantasyAdvice(
    team: { players: FantasyPlayerPool[] },
    context: string,
  ): Promise<string> {
    const systemPrompt =
      "You are GoalX's fantasy football scout. Give concise, actionable fantasy football advice in a confident, professional tone. Keep responses under 150 words.";

    const playerList = team.players.map((p) => `${p.name} (${p.position}, £${p.price}m)`).join(", ");
    const prompt = `Squad: ${playerList}\n\nContext: ${context}\n\nProvide fantasy advice.`;

    return this.generateText(prompt, { systemPrompt, maxTokens: 300 });
  }

  public async predictMatchOutcome(homeTeam: string, awayTeam: string, statsContext: string): Promise<string> {
    const systemPrompt =
      "You are a football analyst. Give a brief, data-informed prediction for the match outcome. Keep it under 100 words and avoid definitive guarantees.";

    const prompt = `${homeTeam} vs ${awayTeam}\n\nRecent stats: ${statsContext}\n\nPredict the likely outcome.`;

    return this.generateText(prompt, { systemPrompt, maxTokens: 200 });
  }
}

export const aiService = new AIService();
