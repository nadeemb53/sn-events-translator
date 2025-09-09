# 🌐 Status Network Translator

Real-time Korean ↔ English translation app for Status network events in Korea. One person publishes translations via microphone, everyone else subscribes and sees the translations in real-time.

## ✨ Features

- 🎤 **Publisher Mode**: Password-protected microphone input with automatic language detection
- 👥 **Subscriber Mode**: Real-time translation display for unlimited users
- 🔄 **Auto Translation**: Korean ↔ English using OpenAI API
- 🌍 **Global Access**: Works worldwide, no local network required
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚡ **Real-time**: WebSocket-based instant updates

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp env.example .env

# Edit .env with your settings
nano .env
```

Add your OpenAI API key and set a publisher password:
```
OPENAI_API_KEY=sk-your-openai-api-key-here
PUBLISHER_PASSWORD=status2024
PORT=3000
```

### 2. Install & Run

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

For development:
```bash
# Development mode with auto-reload
npm run dev
```

### 3. Access the App

- Open `http://localhost:3000` in your browser
- **Subscribers**: Just visit the URL, translations appear automatically
- **Publisher**: Click "Publisher Mode", enter password (`status2024` by default), start recording

## 🌍 Global Deployment

### Option 1: Railway (Recommended)
1. Fork this repository
2. Connect to Railway
3. Add environment variables in Railway dashboard
4. Deploy automatically

### Option 2: Render
1. Connect repository to Render
2. Add environment variables
3. Deploy as Web Service

### Option 3: Vercel (with external WebSocket)
1. Deploy frontend to Vercel
2. Deploy backend to Railway/Render
3. Update WebSocket URL in frontend

## 🎯 How to Use at Events

### For the Event Host (Publisher):
1. Open the app and click "Publisher Mode"
2. Enter the publisher password
3. Click "Start Recording"
4. Speak in Korean or English - it auto-detects and translates
5. Click "Stop Recording" when done

### For Attendees (Subscribers):
1. Just open the app URL
2. Translations appear automatically in real-time
3. No authentication required

## 🔧 Configuration

### Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PUBLISHER_PASSWORD`: Password for publisher mode (default: "status2024")
- `PORT`: Server port (default: 3000)

### Supported Languages
- Korean (ko) ↔ English (en)
- Auto-detection based on text content

## 🛠 Technical Details

### Architecture
- **Frontend**: TypeScript + HTML5 + CSS3
- **Backend**: Node.js + Express + WebSocket
- **Translation**: OpenAI GPT-3.5-turbo
- **Speech Recognition**: Browser Web Speech API
- **Real-time**: WebSocket connections

### Browser Requirements
- Modern browser with Web Speech API support
- Chrome/Safari recommended for speech recognition
- HTTPS required in production for microphone access

## 📱 Mobile Support

The app is fully responsive and works on mobile devices. For best speech recognition results:
- Use Chrome on Android
- Use Safari on iOS
- Ensure microphone permissions are granted

## 🔒 Security

- Publisher mode requires password authentication
- No user data is stored permanently
- All communication is real-time only
- HTTPS recommended for production

## 🚨 Troubleshooting

### Common Issues:

1. **Microphone not working**:
   - Check browser permissions
   - Use HTTPS in production
   - Try Chrome/Safari browsers

2. **WebSocket connection fails**:
   - Check firewall settings
   - Ensure PORT is not blocked
   - Verify server is running

3. **Translation errors**:
   - Check OpenAI API key
   - Verify API credits/quota
   - Check internet connection

### Development:
```bash
# Check logs
npm run dev

# Build only
npm run build

# Check TypeScript
npx tsc --noEmit
```

## 📄 License

MIT License - feel free to use for Status network events!

---

Built with ❤️ for the Status community in Korea 🇰🇷
