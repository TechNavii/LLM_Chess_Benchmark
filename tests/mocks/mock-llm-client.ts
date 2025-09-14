import { ILLMApiClient, LLMRequest, LLMResponse, Model, LLMApiError } from '../../src/infrastructure/api/LLMApiTypes';

/**
 * Mock LLM API Client for testing
 */
export class MockLLMApiClient implements ILLMApiClient {
  private responses: Map<string, LLMResponse> = new Map();
  private shouldError: boolean = false;
  private errorType: string = 'GENERIC';
  private callHistory: LLMRequest[] = [];

  constructor() {
    this.setupDefaultResponses();
  }

  /**
   * Sets up default chess move responses
   */
  private setupDefaultResponses(): void {
    // Default opening moves
    this.setResponse('e4', {
      id: 'test-1',
      model: 'test/model',
      content: 'e2e4',
      usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 }
    });

    this.setResponse('e5', {
      id: 'test-2',
      model: 'test/model',
      content: 'e7e5',
      usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 }
    });

    this.setResponse('Nf3', {
      id: 'test-3',
      model: 'test/model',
      content: 'g1f3',
      usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 }
    });

    this.setResponse('Nc6', {
      id: 'test-4',
      model: 'test/model',
      content: 'b8c6',
      usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 }
    });
  }

  async sendRequest(request: LLMRequest): Promise<LLMResponse> {
    this.callHistory.push(request);

    if (this.shouldError) {
      switch (this.errorType) {
        case 'AUTH_ERROR':
          throw new LLMApiError('Invalid API key', 401, 'AUTH_ERROR');
        case 'RATE_LIMIT':
          throw new LLMApiError('Rate limit exceeded', 429, 'RATE_LIMIT');
        case 'BAD_REQUEST':
          throw new LLMApiError('Bad request', 400, 'BAD_REQUEST');
        case 'TIMEOUT':
          throw new LLMApiError('Request timeout', 408, 'TIMEOUT');
        default:
          throw new LLMApiError('Generic error', 500);
      }
    }

    // Try to find a specific response based on the request content
    const messageContent = request.messages?.[0]?.content || '';
    for (const [key, response] of this.responses.entries()) {
      if (messageContent.includes(key)) {
        return response;
      }
    }

    // Default response with a random valid move
    const defaultMoves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'd7d5'];
    const randomMove = defaultMoves[Math.floor(Math.random() * defaultMoves.length)];

    return {
      id: `test-${Date.now()}`,
      model: request.model,
      content: randomMove,
      usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 }
    };
  }

  async validateApiKey(): Promise<boolean> {
    if (this.shouldError && this.errorType === 'AUTH_ERROR') {
      return false;
    }
    return true;
  }

  async getAvailableModels(): Promise<Model[]> {
    if (this.shouldError) {
      throw new LLMApiError('Failed to fetch models', 500);
    }

    return [
      {
        id: 'test/model-1',
        name: 'Test Model 1',
        contextLength: 4096,
        pricing: { prompt: 0.001, completion: 0.002 }
      },
      {
        id: 'test/model-2',
        name: 'Test Model 2',
        contextLength: 8192,
        pricing: { prompt: 0.002, completion: 0.004 }
      }
    ];
  }

  // Testing helper methods
  setResponse(key: string, response: LLMResponse): void {
    this.responses.set(key, response);
  }

  setError(shouldError: boolean, errorType: string = 'GENERIC'): void {
    this.shouldError = shouldError;
    this.errorType = errorType;
  }

  getCallHistory(): LLMRequest[] {
    return [...this.callHistory];
  }

  clearCallHistory(): void {
    this.callHistory = [];
  }

  getLastRequest(): LLMRequest | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }

  getCallCount(): number {
    return this.callHistory.length;
  }

  reset(): void {
    this.clearCallHistory();
    this.setError(false);
    this.setupDefaultResponses();
  }
}