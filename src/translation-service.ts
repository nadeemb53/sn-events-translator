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
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
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
- Status → 스테이터스 (use Korean phonetic, not translation)
- Logos → 로고스 (use Korean phonetic)
- Codex → 코덱스 (use Korean phonetic)
- Smart Contract → 스마트 컨트랙트
- Gasless → 가스리스 (gasless transactions)
- Layer 2 → 레이어 2
- Rollup → 롤업
- dApp → 디앱
- DeFi → 디파이
- NFT → 엔에프티
- DAO → 다오
- Web3 → 웹3
- Blockchain → 블록체인
- Ethereum → 이더리움
- Wallet → 지갑
- Token → 토큰
- Staking → 스테이킹
- Mining → 마이닝
- Node → 노드
- Validator → 검증자
- Consensus → 합의
- Decentralized → 탈중앙화
- Protocol → 프로토콜

Translate the following ${sourceLangName} text to ${targetLanguage}. Keep Status Network brand names in their phonetic Korean form. Preserve technical accuracy and use appropriate Web3 terminology. Only respond with the translation, no explanations.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content?.trim() || 'Translation failed';
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
      .replace(/\bstudies\b/gi, 'Status')
      .replace(/\bstatistical\b/gi, 'Status') 
      .replace(/\bIFTTT+\b/gi, 'IFT')
      .replace(/\bIFD\b/gi, 'IFT')
      .replace(/\bthank you\b/gi, '') // Remove thank you artifacts
      .trim();
    
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
