import { TranslationService } from '../src/translation-service';

// Real OpenAI integration tests (requires API key)
describe('OpenAI Integration Tests', () => {
  let translationService: TranslationService;
  const hasRealApiKey = process.env.OPENAI_API_KEY && 
                       process.env.OPENAI_API_KEY !== 'test-api-key' &&
                       process.env.OPENAI_API_KEY !== 'test-api-key-for-testing';

  beforeAll(() => {
    if (!hasRealApiKey) {
      console.log('Skipping OpenAI integration tests - no real API key provided');
    } else {
      translationService = new TranslationService(process.env.OPENAI_API_KEY!);
    }
  });

  describe('Real OpenAI API Tests', () => {
    // Skip these tests if no real API key is available
    const testIf = hasRealApiKey ? it : it.skip;

    testIf('should translate simple English to Korean', async () => {
      const result = await translationService.translateText('Hello');
      
      expect(result.originalText).toBe('Hello');
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ko');
      expect(result.translatedText).toBeTruthy();
      expect(result.translatedText.length).toBeGreaterThan(0);
      
      // Should contain Korean characters
      expect(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(result.translatedText)).toBe(true);
    }, 10000); // 10 second timeout for API call

    testIf('should translate simple Korean to English', async () => {
      const result = await translationService.translateText('안녕하세요');
      
      expect(result.originalText).toBe('안녕하세요');
      expect(result.sourceLanguage).toBe('ko');
      expect(result.targetLanguage).toBe('en');
      expect(result.translatedText).toBeTruthy();
      expect(result.translatedText.length).toBeGreaterThan(0);
      
      // Should be English (basic check - contains ASCII letters)
      expect(/[a-zA-Z]/.test(result.translatedText)).toBe(true);
    }, 10000);

    testIf('should handle blockchain-related terminology', async () => {
      const result = await translationService.translateText('blockchain technology');
      
      expect(result.originalText).toBe('blockchain technology');
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ko');
      expect(result.translatedText).toBeTruthy();
      
      // Should contain Korean characters
      expect(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(result.translatedText)).toBe(true);
    }, 10000);

    testIf('should handle Status network terminology', async () => {
      const result = await translationService.translateText('decentralized messaging platform');
      
      expect(result.originalText).toBe('decentralized messaging platform');
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ko');
      expect(result.translatedText).toBeTruthy();
      
      // Should contain Korean characters
      expect(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(result.translatedText)).toBe(true);
    }, 10000);

    testIf('should handle longer sentences', async () => {
      const longText = 'Welcome to the Status network event. We will discuss blockchain technology and decentralized applications.';
      const result = await translationService.translateText(longText);
      
      expect(result.originalText).toBe(longText);
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ko');
      expect(result.translatedText).toBeTruthy();
      expect(result.translatedText.length).toBeGreaterThan(10);
      
      // Should contain Korean characters
      expect(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(result.translatedText)).toBe(true);
    }, 15000);

    testIf('should handle Korean sentences', async () => {
      const koreanText = 'Status 네트워크 이벤트에 오신 것을 환영합니다. 블록체인 기술과 탈중앙화 애플리케이션에 대해 논의하겠습니다.';
      const result = await translationService.translateText(koreanText);
      
      expect(result.originalText).toBe(koreanText);
      expect(result.sourceLanguage).toBe('ko');
      expect(result.targetLanguage).toBe('en');
      expect(result.translatedText).toBeTruthy();
      expect(result.translatedText.length).toBeGreaterThan(10);
      
      // Should be English
      expect(/[a-zA-Z]/.test(result.translatedText)).toBe(true);
    }, 15000);
  });

  describe('Language Detection Edge Cases', () => {
    const testIf = hasRealApiKey ? it : it.skip;
    
    testIf('should handle mixed language text', async () => {
      const mixedText = 'Hello 안녕하세요 world';
      const result = await translationService.translateText(mixedText);
      
      expect(result.originalText).toBe(mixedText);
      // Should detect as Korean due to Korean characters present
      expect(result.sourceLanguage).toBe('ko');
      expect(result.targetLanguage).toBe('en');
    }, 10000);

    testIf('should handle text with numbers and symbols', async () => {
      const textWithSymbols = 'The price is $100 (100달러)';
      const result = await translationService.translateText(textWithSymbols);
      
      expect(result.originalText).toBe(textWithSymbols);
      expect(result.sourceLanguage).toBe('ko'); // Korean characters present
      expect(result.targetLanguage).toBe('en');
      expect(result.translatedText).toBeTruthy();
    }, 10000);
  });

  describe('Error Handling with Real API', () => {
    const testIf = hasRealApiKey ? it : it.skip;
    
    testIf('should handle empty string gracefully', async () => {
      const result = await translationService.translateText('');
      
      expect(result.originalText).toBe('');
      expect(result.sourceLanguage).toBe('en'); // Default to English
      expect(result.targetLanguage).toBe('ko');
      // OpenAI should handle empty strings gracefully
      expect(result.translatedText).toBeDefined();
    }, 10000);

    testIf('should handle very short text', async () => {
      const result = await translationService.translateText('Hi');
      
      expect(result.originalText).toBe('Hi');
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ko');
      expect(result.translatedText).toBeTruthy();
    }, 10000);
  });

  describe('Performance Tests', () => {
    const testIf = hasRealApiKey ? it : it.skip;
    
    testIf('should complete translation within reasonable time', async () => {
      const startTime = Date.now();
      
      await translationService.translateText('Hello world');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
    }, 15000);

    testIf('should handle multiple concurrent translations', async () => {
      const texts = [
        'Hello',
        'Thank you',
        'Good morning',
        'How are you?',
        'Goodbye'
      ];

      const startTime = Date.now();
      
      const promises = texts.map(text => translationService.translateText(text));
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // All translations should complete
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.originalText).toBe(texts[index]);
        expect(result.translatedText).toBeTruthy();
      });
      
      // Should complete within 20 seconds even with concurrent requests
      expect(duration).toBeLessThan(20000);
    }, 30000);
  });
});
