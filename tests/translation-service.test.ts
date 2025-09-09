import { TranslationService } from '../src/translation-service';

// Mock OpenAI
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

describe('TranslationService', () => {
  let translationService: TranslationService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockCreate.mockClear();
    
    // Create service instance
    translationService = new TranslationService('test-api-key');
  });

  describe('detectLanguage', () => {
    it('should detect Korean text correctly', async () => {
      const koreanText = '안녕하세요';
      const result = await translationService.detectLanguage(koreanText);
      expect(result).toBe('ko');
    });

    it('should detect English text correctly', async () => {
      const englishText = 'Hello, world!';
      const result = await translationService.detectLanguage(englishText);
      expect(result).toBe('en');
    });

    it('should detect mixed Korean text as Korean', async () => {
      const mixedText = 'Hello 안녕하세요 world';
      const result = await translationService.detectLanguage(mixedText);
      expect(result).toBe('ko');
    });

    it('should handle empty text', async () => {
      const result = await translationService.detectLanguage('');
      expect(result).toBe('en'); // Default to English
    });

    it('should handle special characters and numbers', async () => {
      const textWithNumbers = '123 !@# $%^';
      const result = await translationService.detectLanguage(textWithNumbers);
      expect(result).toBe('en');
    });
  });

  describe('translate', () => {
    it('should translate Korean to English successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Hello'
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await translationService.translate('안녕하세요', 'ko');
      
      expect(result).toBe('Hello');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the following Korean text to English. Only respond with the translation, no explanations or additional text.',
          },
          {
            role: 'user',
            content: '안녕하세요',
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });
    });

    it('should translate English to Korean successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '안녕하세요'
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await translationService.translate('Hello', 'en');
      
      expect(result).toBe('안녕하세요');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the following English text to Korean. Only respond with the translation, no explanations or additional text.',
          },
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(translationService.translate('Hello', 'en'))
        .rejects.toThrow('Translation service unavailable');
    });

    it('should handle empty response from OpenAI', async () => {
      const mockResponse = {
        choices: []
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await translationService.translate('Hello', 'en');
      expect(result).toBe('Translation failed');
    });

    it('should handle null content in response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await translationService.translate('Hello', 'en');
      expect(result).toBe('Translation failed');
    });
  });

  describe('translateText', () => {
    it('should perform end-to-end translation for Korean text', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Hello'
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await translationService.translateText('안녕하세요');
      
      expect(result).toEqual({
        originalText: '안녕하세요',
        translatedText: 'Hello',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
      });
    });

    it('should perform end-to-end translation for English text', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '안녕하세요'
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await translationService.translateText('Hello');
      
      expect(result).toEqual({
        originalText: 'Hello',
        translatedText: '안녕하세요',
        sourceLanguage: 'en',
        targetLanguage: 'ko',
      });
    });

    it('should handle blockchain terminology correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '블록체인 기술'
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await translationService.translateText('blockchain technology');
      
      expect(result.originalText).toBe('blockchain technology');
      expect(result.translatedText).toBe('블록체인 기술');
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ko');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'));

      await expect(translationService.translateText('Hello'))
        .rejects.toThrow('Translation service unavailable');
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      mockCreate.mockRejectedValue(rateLimitError);

      await expect(translationService.translateText('Hello'))
        .rejects.toThrow('Translation service unavailable');
    });
  });
});
