import axios, { AxiosError } from 'axios';
import { OpenRouterClient } from '../../../src/infrastructure/api/OpenRouterClient';
import { LLMApiError } from '../../../src/infrastructure/api/LLMApiTypes';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'https://test.openrouter.ai/api/v1';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup axios.create mock
    const mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    } as any;

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);
    (mockedAxios.isAxiosError as any) = jest.fn();

    client = new OpenRouterClient(mockApiKey, mockBaseUrl);
  });

  describe('Construction', () => {
    it('should create client with default base URL', () => {
      const defaultClient = new OpenRouterClient(mockApiKey);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'Authorization': `Bearer ${mockApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/chess-llm-game',
          'X-Title': 'Chess LLM Game'
        }
      });
    });

    it('should create client with custom base URL', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockBaseUrl,
        headers: {
          'Authorization': `Bearer ${mockApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/chess-llm-game',
          'X-Title': 'Chess LLM Game'
        }
      });
    });
  });

  describe('sendRequest', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = (mockedAxios.create as jest.Mock).mock.results[0].value;
    });

    it('should send request successfully with minimal parameters', async () => {
      const mockResponse = {
        data: {
          id: 'test-response-id',
          model: 'test-model',
          choices: [
            {
              message: {
                content: 'e2e4'
              }
            }
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 10,
            total_tokens: 110
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'Make a chess move' }]
      };

      const result = await client.sendRequest(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Make a chess move' }],
        temperature: 0.7,
        max_tokens: 150,
        stream: false
      });

      expect(result).toEqual({
        id: 'test-response-id',
        model: 'test-model',
        content: 'e2e4',
        usage: {
          promptTokens: 100,
          completionTokens: 10,
          totalTokens: 110
        }
      });
    });

    it('should send request with custom parameters', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          model: 'custom-model',
          choices: [{ message: { content: 'move response' } }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request = {
        model: 'custom-model',
        messages: [{ role: 'user' as const, content: 'Custom prompt' }],
        temperature: 0.2,
        maxTokens: 50,
        stream: true
      };

      const result = await client.sendRequest(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'custom-model',
        messages: [{ role: 'user', content: 'Custom prompt' }],
        temperature: 0.2,
        max_tokens: 50,
        stream: true
      });

      expect(result.content).toBe('move response');
    });

    it('should handle response without usage data', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          model: 'test-model',
          choices: [{ message: { content: 'response' } }]
          // No usage field
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'test' }]
      };

      const result = await client.sendRequest(request);

      expect(result.usage).toBeUndefined();
    });

    it('should throw error when no choices in response', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          model: 'test-model',
          choices: []
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'test' }]
      };

      await expect(client.sendRequest(request)).rejects.toThrow(
        expect.objectContaining({
          message: 'No response from model'
        })
      );
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);
      });

      it('should handle 401 authentication error', async () => {
        const mockError = {
          response: {
            status: 401,
            data: { error: { message: 'Invalid API key' } }
          }
        };

        mockAxiosInstance.post.mockRejectedValue(mockError);

        const request = {
          model: 'test-model',
          messages: [{ role: 'user' as const, content: 'test' }]
        };

        await expect(client.sendRequest(request)).rejects.toThrow(
          expect.objectContaining({
            message: 'Invalid API key',
            statusCode: 401,
            code: 'AUTH_ERROR'
          })
        );
      });

      it('should handle 429 rate limit error', async () => {
        const mockError = {
          response: {
            status: 429,
            data: { error: { message: 'Rate limit exceeded' } }
          }
        };

        mockAxiosInstance.post.mockRejectedValue(mockError);

        const request = {
          model: 'test-model',
          messages: [{ role: 'user' as const, content: 'test' }]
        };

        await expect(client.sendRequest(request)).rejects.toThrow(
          expect.objectContaining({
            message: 'Rate limit exceeded',
            statusCode: 429,
            code: 'RATE_LIMIT'
          })
        );
      });

      it('should handle 400 bad request error', async () => {
        const mockError = {
          response: {
            status: 400,
            data: { error: { message: 'Invalid model' } }
          }
        };

        mockAxiosInstance.post.mockRejectedValue(mockError);

        const request = {
          model: 'invalid-model',
          messages: [{ role: 'user' as const, content: 'test' }]
        };

        await expect(client.sendRequest(request)).rejects.toThrow(
          expect.objectContaining({
            message: 'Bad request: Invalid model',
            statusCode: 400,
            code: 'BAD_REQUEST'
          })
        );
      });

      it('should handle generic API errors', async () => {
        const mockError = {
          response: {
            status: 500,
            data: { error: { message: 'Internal server error' } }
          }
        };

        mockAxiosInstance.post.mockRejectedValue(mockError);

        const request = {
          model: 'test-model',
          messages: [{ role: 'user' as const, content: 'test' }]
        };

        await expect(client.sendRequest(request)).rejects.toThrow(
          expect.objectContaining({
            message: 'API request failed: Internal server error',
            statusCode: 500
          })
        );
      });

      it('should handle non-axios errors', async () => {
        (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(false);
        const genericError = new Error('Generic error');

        mockAxiosInstance.post.mockRejectedValue(genericError);

        const request = {
          model: 'test-model',
          messages: [{ role: 'user' as const, content: 'test' }]
        };

        await expect(client.sendRequest(request)).rejects.toThrow(genericError);
      });
    });
  });

  describe('validateApiKey', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = (mockedAxios.create as jest.Mock).mock.results[0].value;
    });

    it('should return true for valid API key', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const isValid = await client.validateApiKey();

      expect(isValid).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/models');
    });

    it('should return false for invalid API key (401)', async () => {
      const mockError = {
        response: { status: 401 }
      };

      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(mockError);

      const isValid = await client.validateApiKey();

      expect(isValid).toBe(false);
    });

    it('should throw for other errors', async () => {
      const mockError = {
        response: { status: 500 }
      };

      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(client.validateApiKey()).rejects.toThrow();
    });
  });

  describe('getAvailableModels', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = (mockedAxios.create as jest.Mock).mock.results[0].value;
    });

    it('should fetch and format models correctly', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'model-1',
              name: 'Model 1',
              context_length: 4096,
              pricing: {
                prompt: 0.001,
                completion: 0.002
              }
            },
            {
              id: 'model-2',
              // No name field
              context_length: 8192,
              pricing: {
                prompt: 0.003,
                completion: 0.004
              }
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const models = await client.getAvailableModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'model-1',
        name: 'Model 1',
        contextLength: 4096,
        pricing: {
          prompt: 0.001,
          completion: 0.002
        }
      });
      expect(models[1]).toEqual({
        id: 'model-2',
        name: 'model-2', // Falls back to id when name is missing
        contextLength: 8192,
        pricing: {
          prompt: 0.003,
          completion: 0.004
        }
      });
    });

    it('should handle models without pricing', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'model-without-pricing',
              name: 'Model Without Pricing',
              context_length: 2048
              // No pricing field
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const models = await client.getAvailableModels();

      expect(models).toHaveLength(1);
      expect(models[0].pricing).toBeUndefined();
    });

    it('should handle empty models response', async () => {
      const mockResponse = {
        data: {
          data: []
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const models = await client.getAvailableModels();

      expect(models).toHaveLength(0);
    });

    it('should handle missing data field', async () => {
      const mockResponse = {
        data: {}
        // No data field
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const models = await client.getAvailableModels();

      expect(models).toHaveLength(0);
    });

    it('should handle axios errors', async () => {
      const mockError = {
        response: { status: 500 },
        message: 'Network error'
      };

      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(client.getAvailableModels()).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to fetch models: Network error',
          statusCode: 500
        })
      );
    });

    it('should handle non-axios errors', async () => {
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(false);
      const genericError = new Error('Generic error');

      mockAxiosInstance.get.mockRejectedValue(genericError);

      await expect(client.getAvailableModels()).rejects.toThrow(genericError);
    });
  });
});