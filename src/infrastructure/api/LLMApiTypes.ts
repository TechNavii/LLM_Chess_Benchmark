export interface ILLMApiClient {
  sendRequest(request: LLMRequest): Promise<LLMResponse>;
  validateApiKey(): Promise<boolean>;
  getAvailableModels(): Promise<Model[]>;
}

export interface LLMRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Model {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

export class LLMApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'LLMApiError';
  }
}