import { TranslationMessage, WebSocketMessage, AuthenticatedConnection } from '../src/types';

describe('Types', () => {
  describe('TranslationMessage', () => {
    it('should create a valid TranslationMessage object', () => {
      const translation: TranslationMessage = {
        id: '123',
        originalText: 'Hello',
        translatedText: '안녕하세요',
        sourceLanguage: 'en',
        targetLanguage: 'ko',
        timestamp: Date.now()
      };

      expect(translation.id).toBe('123');
      expect(translation.originalText).toBe('Hello');
      expect(translation.translatedText).toBe('안녕하세요');
      expect(translation.sourceLanguage).toBe('en');
      expect(translation.targetLanguage).toBe('ko');
      expect(typeof translation.timestamp).toBe('number');
    });

    it('should handle Korean to English translation', () => {
      const translation: TranslationMessage = {
        id: '456',
        originalText: '안녕하세요',
        translatedText: 'Hello',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        timestamp: Date.now()
      };

      expect(translation.sourceLanguage).toBe('ko');
      expect(translation.targetLanguage).toBe('en');
    });
  });

  describe('WebSocketMessage', () => {
    it('should create authentication message', () => {
      const authMessage: WebSocketMessage = {
        type: 'auth',
        password: 'test-password'
      };

      expect(authMessage.type).toBe('auth');
      expect(authMessage.password).toBe('test-password');
    });

    it('should create translation message', () => {
      const translationMsg: WebSocketMessage = {
        type: 'translation',
        data: 'Hello world'
      };

      expect(translationMsg.type).toBe('translation');
      expect(translationMsg.data).toBe('Hello world');
    });

    it('should create translation response message', () => {
      const translation: TranslationMessage = {
        id: '789',
        originalText: 'Test',
        translatedText: '테스트',
        sourceLanguage: 'en',
        targetLanguage: 'ko',
        timestamp: Date.now()
      };

      const message: WebSocketMessage = {
        type: 'translation',
        translation: translation
      };

      expect(message.type).toBe('translation');
      expect(message.translation).toEqual(translation);
    });

    it('should create subscriber count message', () => {
      const countMessage: WebSocketMessage = {
        type: 'subscriber_count',
        count: 5
      };

      expect(countMessage.type).toBe('subscriber_count');
      expect(countMessage.count).toBe(5);
    });

    it('should create auth success message', () => {
      const successMessage: WebSocketMessage = {
        type: 'auth_success',
        data: 'Publisher mode activated'
      };

      expect(successMessage.type).toBe('auth_success');
      expect(successMessage.data).toBe('Publisher mode activated');
    });

    it('should create auth failed message', () => {
      const failedMessage: WebSocketMessage = {
        type: 'auth_failed',
        data: 'Invalid password'
      };

      expect(failedMessage.type).toBe('auth_failed');
      expect(failedMessage.data).toBe('Invalid password');
    });
  });

  describe('AuthenticatedConnection', () => {
    it('should create publisher connection', () => {
      const mockWs = {} as any; // Mock WebSocket

      const connection: AuthenticatedConnection = {
        ws: mockWs,
        isPublisher: true,
        authenticatedAt: Date.now()
      };

      expect(connection.isPublisher).toBe(true);
      expect(typeof connection.authenticatedAt).toBe('number');
    });

    it('should create subscriber connection', () => {
      const mockWs = {} as any; // Mock WebSocket

      const connection: AuthenticatedConnection = {
        ws: mockWs,
        isPublisher: false,
        authenticatedAt: Date.now()
      };

      expect(connection.isPublisher).toBe(false);
      expect(typeof connection.authenticatedAt).toBe('number');
    });
  });
});
