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
            content: `You are a professional translator specializing in blockchain, cryptocurrency, and Web3 technology. You have expertise in translating technical terms related to:
- DeFi (Decentralized Finance), DEX, liquidity pools, yield farming, staking
- NFTs, smart contracts, dApps, protocols, governance tokens
- Layer 1/Layer 2 networks, sidechains, rollups, bridges
- Wallets, private keys, seed phrases, gas fees, mining, validators
- DAO, tokenomics, airdrops, ICO, IDO, TGE
- Status Network, Ethereum, Bitcoin, and other blockchain ecosystems

Translate the following ${sourceLangName} text to ${targetLanguage}. Preserve technical accuracy and use appropriate terminology. Only respond with the translation, no explanations or additional text.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.2,
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
    const sourceLanguage = await this.detectLanguage(text);
    const targetLanguage = sourceLanguage === 'ko' ? 'en' : 'ko';
    
    console.log(`Translating: "${text}" from ${sourceLanguage} to ${targetLanguage}`);
    
    const translatedText = await this.translate(text, sourceLanguage);

    console.log(`Result: "${translatedText}"`);

    return {
      originalText: text,
      translatedText,
      sourceLanguage,
      targetLanguage,
    };
  }
}
