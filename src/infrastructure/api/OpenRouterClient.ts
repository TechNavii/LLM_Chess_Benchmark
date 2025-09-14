import axios, { AxiosInstance } from 'axios';
import { ILLMApiClient, LLMRequest, LLMResponse, Model, LLMApiError } from './LLMApiTypes';

export class OpenRouterClient implements ILLMApiClient {
  private axiosInstance: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = 'https://openrouter.ai/api/v1') {
    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/chess-llm-game',
        'X-Title': 'Chess LLM Game'
      }
    });
  }

  async sendRequest(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.axiosInstance.post('/chat/completions', {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 150,
        stream: request.stream ?? false
      });

      const data = response.data;
      console.log(`[OpenRouterClient] Response for ${request.model}:`, JSON.stringify(data, null, 2));

      if (!data.choices || data.choices.length === 0) {
        throw new LLMApiError('No response from model');
      }

      const content = data.choices[0].message?.content || '';

      if (!content || content.trim() === '') {
        console.log(`[OpenRouterClient] Empty content received from ${request.model}`);
        throw new LLMApiError(`Model ${request.model} returned empty response`);
      }

      return {
        id: data.id,
        model: data.model,
        content: content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error?.message || error.message;

        if (statusCode === 401) {
          throw new LLMApiError('Invalid API key', statusCode, 'AUTH_ERROR');
        } else if (statusCode === 429) {
          throw new LLMApiError('Rate limit exceeded', statusCode, 'RATE_LIMIT');
        } else if (statusCode === 400) {
          throw new LLMApiError(`Bad request: ${errorMessage}`, statusCode, 'BAD_REQUEST');
        } else {
          throw new LLMApiError(`API request failed: ${errorMessage}`, statusCode);
        }
      }
      throw error;
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.axiosInstance.get('/models');
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return false;
      }
      throw error;
    }
  }

  async getAvailableModels(): Promise<Model[]> {
    try {
      const response = await this.axiosInstance.get('/models');
      const models = response.data.data || [];

      return models.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        contextLength: model.context_length,
        pricing: model.pricing ? {
          prompt: model.pricing.prompt,
          completion: model.pricing.completion
        } : undefined
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new LLMApiError(`Failed to fetch models: ${error.message}`, error.response?.status);
      }
      throw error;
    }
  }
}