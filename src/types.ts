export interface TranslationMessage {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: 'ko' | 'en';
  targetLanguage: 'ko' | 'en';
  timestamp: number;
  isFinal?: boolean;
}

export interface WebSocketMessage {
  type: 'translation' | 'auth' | 'auth_success' | 'auth_failed' | 'subscriber_count' | 'error';
  data?: any;
  translation?: TranslationMessage;
  password?: string;
  count?: number;
  isFinal?: boolean;
}

export interface AuthenticatedConnection {
  ws: WebSocket;
  isPublisher: boolean;
  authenticatedAt: number;
}
