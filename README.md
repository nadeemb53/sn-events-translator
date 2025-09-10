# Status Translator

Real-time Korean ↔ English translation for Status network events. Features a publisher/subscriber model where one person speaks and everyone else receives live translations.

## Features

- **Publisher Mode**: Password-protected microphone input with OpenAI Whisper transcription
- **Subscriber Mode**: Live translation display for unlimited users  
- **Dual Language Display**: Korean and English text in separate, scrollable containers
- **Automatic Language Detection**: Whisper API handles Korean/English detection
- **Web3-Aware Translation**: Enhanced prompts for blockchain and cryptocurrency terminology
- **Global Access**: WebSocket-based real-time communication
- **Mobile Responsive**: Optimized layout for phones and tablets

## Quick Start

### 1. Environment Setup

```bash
cp env.example .env
```

Configure your `.env` file:
```
OPENAI_API_KEY=sk-your-openai-api-key-here
PUBLISHER_PASSWORD=status2024
PORT=3000
```

### 2. Installation

```bash
npm install
npm run build
npm start
```

Visit `http://localhost:3000`

### 3. Usage

**Publisher (Event Host):**
1. Click "Publisher Mode" 
2. Enter password
3. Click "Start Recording"
4. Speak in Korean or English

**Subscribers (Attendees):**
1. Open the app URL
2. View live translations automatically

## Technical Implementation

### Architecture
- **Frontend**: TypeScript, Vite build system
- **Backend**: Node.js, Express, WebSocket server
- **Speech Recognition**: OpenAI Whisper API (3-second audio chunks)
- **Translation**: OpenAI GPT-3.5-turbo with specialized Web3 prompts
- **UI**: Dual-panel layout with Korean (red) and English (blue) containers

### Audio Processing
- MediaRecorder captures high-quality audio (16kHz, mono)
- 3-second chunks sent to Whisper for near real-time processing
- Automatic language detection and transcription
- Superior accuracy compared to browser speech recognition

### Translation Features
- Specialized prompts for DeFi, NFT, blockchain terminology
- Session-based text accumulation (reduces fragmentation)
- Real-time interim and final translation states
- Auto-scrolling text containers

## Deployment

### Frontend (Vercel)
```bash
npm run build:client
npx vercel --prod
```

### Backend (Railway/Render)
Deploy the Node.js server with WebSocket support and environment variables.

## Browser Requirements

- **Audio Recording**: Modern browsers with MediaRecorder API
- **HTTPS**: Required in production for microphone access
- **WebSocket**: Standard support (all modern browsers)
- **Recommended**: Chrome, Safari, Firefox

## Cost Considerations

- **Whisper API**: ~$0.006 per minute of audio
- **GPT Translation**: Standard OpenAI pricing
- **Suitable for**: Professional events where accuracy matters

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for Whisper and translation
- `PUBLISHER_PASSWORD`: Access control for publisher mode
- `PORT`: Server port (default: 3000)

### Audio Settings
- Sample rate: 16kHz
- Channels: Mono
- Format: WebM/Opus
- Chunk size: 3 seconds
- Features: Echo cancellation, noise suppression

## Troubleshooting

**Microphone Issues:**
- Grant browser permissions
- Use HTTPS in production
- Check audio input device

**API Errors:**
- Verify OpenAI API key and credits
- Check network connectivity
- Monitor browser console for errors

**WebSocket Connection:**
- Ensure backend is running and accessible
- Check firewall/proxy settings
- Verify correct WebSocket URL

## Development

```bash
# Development mode
npm run dev

# Type checking
npx tsc --noEmit

# Tests
npm test
```

## License

MIT

---

*Built for Status Network events in Korea*