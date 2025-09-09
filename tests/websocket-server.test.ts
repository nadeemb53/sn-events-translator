import WebSocket from 'ws';
import { TranslationService } from '../src/translation-service';
import { WebSocketMessage, TranslationMessage } from '../src/types';

// Mock the translation service
jest.mock('../src/translation-service');

describe('WebSocket Server Integration', () => {
  let server: any;
  let client: WebSocket;
  let mockTranslationService: jest.Mocked<TranslationService>;

  const PORT = 3001;
  const PUBLISHER_PASSWORD = 'test-password';

  beforeAll(async () => {
    // Set up environment variables
    process.env.PORT = PORT.toString();
    process.env.PUBLISHER_PASSWORD = PUBLISHER_PASSWORD;
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Import server after setting env vars
    const serverModule = await import('../src/server');
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock translation service
    mockTranslationService = new TranslationService('test') as jest.Mocked<TranslationService>;
    
    // Create WebSocket client
    client = new WebSocket(`ws://localhost:${PORT}`);
    
    // Wait for connection
    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });
  });

  afterEach(() => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections', () => {
      expect(client.readyState).toBe(WebSocket.OPEN);
    });

    it('should send subscriber count on connection', (done) => {
      client.on('message', (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === 'subscriber_count') {
          expect(message.count).toBeGreaterThanOrEqual(1);
          done();
        }
      });
    });
  });

  describe('Authentication', () => {
    it('should authenticate publisher with correct password', (done) => {
      client.on('message', (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === 'auth_success') {
          expect(message.data).toBe('Publisher mode activated');
          done();
        }
      });

      const authMessage: WebSocketMessage = {
        type: 'auth',
        password: PUBLISHER_PASSWORD
      };

      client.send(JSON.stringify(authMessage));
    });

    it('should reject authentication with wrong password', (done) => {
      client.on('message', (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === 'auth_failed') {
          expect(message.data).toBe('Invalid password');
          done();
        }
      });

      const authMessage: WebSocketMessage = {
        type: 'auth',
        password: 'wrong-password'
      };

      client.send(JSON.stringify(authMessage));
    });
  });

  describe('Translation Workflow', () => {
    beforeEach((done) => {
      // Authenticate as publisher first
      client.on('message', (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === 'auth_success') {
          done();
        }
      });

      const authMessage: WebSocketMessage = {
        type: 'auth',
        password: PUBLISHER_PASSWORD
      };

      client.send(JSON.stringify(authMessage));
    });

    it('should process translation requests from authenticated publisher', (done) => {
      // Mock the translation service
      mockTranslationService.translateText.mockResolvedValue({
        originalText: 'Hello',
        translatedText: '안녕하세요',
        sourceLanguage: 'en',
        targetLanguage: 'ko'
      });

      client.on('message', (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === 'translation' && message.translation) {
          expect(message.translation.originalText).toBe('Hello');
          expect(message.translation.translatedText).toBe('안녕하세요');
          expect(message.translation.sourceLanguage).toBe('en');
          expect(message.translation.targetLanguage).toBe('ko');
          done();
        }
      });

      const translationMessage: WebSocketMessage = {
        type: 'translation',
        data: 'Hello'
      };

      client.send(JSON.stringify(translationMessage));
    });

    it('should reject translation requests from non-authenticated clients', (done) => {
      // Create a new non-authenticated client
      const unauthClient = new WebSocket(`ws://localhost:${PORT}`);

      unauthClient.on('open', () => {
        unauthClient.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'error') {
            expect(message.data).toBe('Only publishers can send translations');
            unauthClient.close();
            done();
          }
        });

        const translationMessage: WebSocketMessage = {
          type: 'translation',
          data: 'Hello'
        };

        unauthClient.send(JSON.stringify(translationMessage));
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON messages gracefully', (done) => {
      client.on('message', (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        if (message.type === 'error') {
          expect(message.data).toBe('Invalid message format');
          done();
        }
      });

      client.send('invalid json');
    });

    it('should handle translation service errors', (done) => {
      // Authenticate first
      client.on('message', (data) => {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        if (message.type === 'auth_success') {
          // Mock translation service error
          mockTranslationService.translateText.mockRejectedValue(new Error('API Error'));

          client.on('message', (errorData) => {
            const errorMessage: WebSocketMessage = JSON.parse(errorData.toString());
            if (errorMessage.type === 'error') {
              expect(errorMessage.data).toBe('Translation failed');
              done();
            }
          });

          const translationMessage: WebSocketMessage = {
            type: 'translation',
            data: 'Hello'
          };

          client.send(JSON.stringify(translationMessage));
        }
      });

      const authMessage: WebSocketMessage = {
        type: 'auth',
        password: PUBLISHER_PASSWORD
      };

      client.send(JSON.stringify(authMessage));
    });
  });

  describe('Multiple Clients', () => {
    it('should broadcast translations to all connected clients', (done) => {
      let receivedCount = 0;
      const expectedTranslation = {
        originalText: 'Hello',
        translatedText: '안녕하세요',
        sourceLanguage: 'en' as const,
        targetLanguage: 'ko' as const
      };

      // Mock translation service
      mockTranslationService.translateText.mockResolvedValue(expectedTranslation);

      // Create additional subscriber clients
      const subscriber1 = new WebSocket(`ws://localhost:${PORT}`);
      const subscriber2 = new WebSocket(`ws://localhost:${PORT}`);

      const checkComplete = () => {
        receivedCount++;
        if (receivedCount === 3) { // Original client + 2 subscribers
          subscriber1.close();
          subscriber2.close();
          done();
        }
      };

      // Set up message listeners for all clients
      [client, subscriber1, subscriber2].forEach(ws => {
        ws.on('message', (data) => {
          const message: WebSocketMessage = JSON.parse(data.toString());
          if (message.type === 'translation') {
            expect(message.translation?.originalText).toBe('Hello');
            checkComplete();
          }
        });
      });

      // Wait for all connections to be established
      Promise.all([
        new Promise(resolve => subscriber1.on('open', resolve)),
        new Promise(resolve => subscriber2.on('open', resolve))
      ]).then(() => {
        // Send translation request
        const translationMessage: WebSocketMessage = {
          type: 'translation',
          data: 'Hello'
        };

        client.send(JSON.stringify(translationMessage));
      });
    });
  });
});
