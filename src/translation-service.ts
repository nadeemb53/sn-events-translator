import OpenAI from 'openai';

export class TranslationService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async detectLanguage(text: string): Promise<'ko' | 'en'> {
    try {
      // Simple heuristic: if text contains Korean characters, it's Korean
      const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
      if (koreanRegex.test(text)) {
        return 'ko';
      }
      return 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default to English
    }
  }

  async translate(text: string, sourceLanguage: 'ko' | 'en'): Promise<string> {
    try {
      const targetLanguage = sourceLanguage === 'ko' ? 'English' : 'Korean';
      const sourceLangName = sourceLanguage === 'ko' ? 'Korean' : 'English';

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'user',
            content: `You are a professional translator specializing in Status Network, Logos Network, and Web3 ecosystem terminology. You have deep expertise in:

STATUS NETWORK ECOSYSTEM:
- Status: Decentralized communication platform and ecosystem
- Logos: Decentralized autonomous organization platform
- Codex: Decentralized storage network
- DA Layer: Data Availability Layer for blockchain scaling
- Status Ecosystem: The broader Status Network infrastructure
- Logos Ecosystem: Logos network and governance systems

TECHNICAL WEB3 TERMS:
- Smart Contracts, Gasless transactions, Zero gas fees
- Layer 2, Rollup, Optimistic rollups, ZK rollups
- Ethereum scaling, Blockchain interoperability
- DeFi protocols, DEX, AMM, liquidity pools
- NFTs, dApps, Web3 applications
- Private messaging, Encrypted communications
- Decentralized governance, DAO voting
- Tokenomics, Staking rewards, Yield farming

KOREAN SPECIFIC MAPPINGS:
- Status → 스테이터스
- The Status Network → 스테이터스 네트워크
- Status Messenger → 스테이터스 메신저
- Status network token → 스테이터스 네트워크 토큰
- Logos → 로고스
- Codex → 코덱스
- Waku → 와쿠
- Nimbus → 님버스
- Nomos → 노모스
- Ethereum → 이더리움
- Ethereum 2.0 → 이더리움 2.0
- Ethereum Wallet → 이더리움 지갑
- Ethereum price → 이더리움 가격
- Ethereum network → 이더리움 네트워크
- Bitcoin → 비트코인
- Blockchain → 블록체인
- Crypto → 크립토
- Cryptocurrency → 암호화폐
- Decentralization → 탈중앙화
- Decentralized internet → 탈중앙 인터넷
- dApps → 디앱
- Decentralized apps → 탈중앙 앱
- Web3 browser → 웹3 브라우저
- Chainlink → 체인링크
- Coinbase → 코인베이스
- Private messaging → 비밀 메시징
- Encrypted chat → 암호화 채팅
- Secure messenger → 안전한 메신저
- Decentralized chat → 탈중앙 채팅

You are a direct translation tool. Translate the following ${sourceLangName} text to ${targetLanguage}. 

CRITICAL RULES:
- Only output the translation, nothing else
- No "I'm here to help" or explanatory text
- No conversational responses
- Just translate the input text directly
- Keep Status Network brand names in their phonetic Korean form
- Use the Korean mappings provided above

TEXT TO TRANSLATE: ${text}`,
          },
        ],
      });

      let translation = completion.choices[0]?.message?.content?.trim() || 'Translation failed';
      
      console.log(`🤖 Raw OpenAI response: "${translation}"`);
      
      // Filter out conversational responses
      if (translation.includes("I'm here to help") || 
          translation.includes("Please provide") ||
          translation.includes("Just let me know") ||
          translation.includes("I'll take care") ||
          translation.includes("How can I help") ||
          translation.includes("How may I") ||
          translation.includes("What would you like")) {
        console.log(`❌ Filtered out conversational response: "${translation}"`);
        return 'Translation failed - invalid response';
      }
      
      console.log(`✅ Valid translation: "${translation}"`);
      return translation;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error('Translation service unavailable');
    }
  }

  async translateText(text: string): Promise<{
    originalText: string;
    translatedText: string;
    sourceLanguage: 'ko' | 'en';
    targetLanguage: 'ko' | 'en';
  }> {
    // Fix common Whisper misrecognitions before translation
    let correctedText = text
      // Remove common Whisper hallucinations and artifacts
      .replace(/\b(thank you|thanks|for watching|for your attention|bye|goodbye)\b/gi, '')
      .replace(/\.\.\./g, '.') // Clean up ellipsis
      
      // Fix Status ecosystem terms
      .replace(/\bstudies\b/gi, 'Status')
      .replace(/\bstatistical\b/gi, 'Status') 
      .replace(/\bIFTTT+\b/gi, 'IFT')
      .replace(/\bIFD\b/gi, 'IFT')
      
      // Fix other Web3 terms that might be misrecognized
      .replace(/\bweb 3\b/gi, 'Web3')
      .replace(/\bD app\b/gi, 'dApp')
      .replace(/\bD apps\b/gi, 'dApps')
      .replace(/\bethereum 2\b/gi, 'Ethereum 2.0')
      .replace(/\bbit coin\b/gi, 'Bitcoin')
      .replace(/\bchain link\b/gi, 'Chainlink')
      
      // Clean up extra spaces and trim
      .replace(/\s+/g, ' ')
      .trim();
    
    // Skip if text becomes empty after cleaning
    if (!correctedText) {
      console.log(`❌ Text became empty after cleaning. Original: "${text}"`);
      throw new Error('No meaningful content to translate');
    }
    
    const sourceLanguage = await this.detectLanguage(correctedText);
    const targetLanguage = sourceLanguage === 'ko' ? 'en' : 'ko';
    
    console.log(`Original: "${text}"`);
    console.log(`Corrected: "${correctedText}"`);
    console.log(`Translating from ${sourceLanguage} to ${targetLanguage}`);
    
    const translatedText = await this.translate(correctedText, sourceLanguage);

    console.log(`Result: "${translatedText}"`);

    return {
      originalText: correctedText, // Use corrected text as original
      translatedText,
      sourceLanguage,
      targetLanguage,
    };
  }
}
