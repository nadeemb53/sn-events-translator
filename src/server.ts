import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { TranslationService } from './translation-service';
import { WebSocketMessage, TranslationMessage, AuthenticatedConnection } from './types';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuration
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLISHER_PASSWORD = process.env.PUBLISHER_PASSWORD || 'status2024';

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required');
  process.exit(1);
}

// Initialize services
const translationService = new TranslationService(OPENAI_API_KEY);

// Store connections
const connections = new Map<WebSocket, AuthenticatedConnection>();
let publisher: WebSocket | null = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    subscribers: connections.size,
    hasPublisher: !!publisher 
  });
});

// OpenAI API key endpoint (protected)
app.post('/api/openai-key', (req, res) => {
  const { password } = req.body;
  
  if (password !== PUBLISHER_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  res.json({ apiKey: OPENAI_API_KEY });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  // Add to connections as subscriber by default
  connections.set(ws, {
    ws: ws as any,
    isPublisher: false,
    authenticatedAt: Date.now(),
  });

  // Send current subscriber count to all clients
  broadcastSubscriberCount();

  ws.on('message', async (message) => {
    try {
      const data: WebSocketMessage = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'auth':
          await handleAuthentication(ws, data.password || '');
          break;
          
        case 'translation':
          await handleTranslation(ws, data.data, data.isFinal);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    const connection = connections.get(ws);
    
    if (connection?.isPublisher) {
      publisher = null;
      console.log('Publisher disconnected');
    }
    
    connections.delete(ws);
    broadcastSubscriberCount();
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connections.delete(ws);
  });
});

async function handleAuthentication(ws: WebSocket, password: string) {
  if (password === PUBLISHER_PASSWORD) {
    // Remove existing publisher if any
    if (publisher) {
      const existingConnection = connections.get(publisher);
      if (existingConnection) {
        existingConnection.isPublisher = false;
      }
    }
    
    // Set this connection as publisher
    const connection = connections.get(ws);
    if (connection) {
      connection.isPublisher = true;
      publisher = ws;
    }
    
    ws.send(JSON.stringify({
      type: 'auth_success',
      data: 'Publisher mode activated'
    }));
    
    console.log('New publisher authenticated');
  } else {
    ws.send(JSON.stringify({
      type: 'auth_failed',
      data: 'Invalid password'
    }));
  }
}

// Store the last interim translation to avoid duplicates
let lastInterimTranslation: string = '';
let interimTranslationTimeout: NodeJS.Timeout | null = null;
let currentSessionText: string = ''; // Accumulate text in the same session
let currentSessionId: string | null = null;
let sessionTimeout: NodeJS.Timeout | null = null;

async function handleTranslation(ws: WebSocket, text: string, isFinal: boolean = true) {
  const connection = connections.get(ws);
  
  if (!connection?.isPublisher) {
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Only publishers can send translations'
    }));
    return;
  }

  try {
    // Start or continue a session
    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}`;
      currentSessionText = '';
    }
    
    // Reset session timeout (3 seconds of silence ends the session)
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
    }
    sessionTimeout = setTimeout(() => {
      currentSessionId = null;
      currentSessionText = '';
    }, 3000);

    // Handle interim translations (live preview)
    if (!isFinal) {
      // Accumulate text in current session
      const newSessionText = currentSessionText ? `${currentSessionText} ${text}` : text;
      currentSessionText = newSessionText;
      
      // Avoid translating the same interim text repeatedly
      if (newSessionText === lastInterimTranslation) return;
      lastInterimTranslation = newSessionText;
      
      // Clear any pending interim translation
      if (interimTranslationTimeout) {
        clearTimeout(interimTranslationTimeout);
      }
      
      // Set a timeout to translate interim text if no final comes quickly
      interimTranslationTimeout = setTimeout(async () => {
        try {
          const result = await translationService.translateText(newSessionText);
          
          const translationMessage: TranslationMessage = {
            id: currentSessionId || `interim-${Date.now()}`,
            originalText: result.originalText,
            translatedText: result.translatedText,
            sourceLanguage: result.sourceLanguage,
            targetLanguage: result.targetLanguage,
            timestamp: Date.now(),
            isFinal: false,
          };

          broadcastToSubscribers({
            type: 'translation',
            translation: translationMessage,
          });
        } catch (error) {
          console.error('Interim translation error:', error);
        }
      }, 500); // Wait 500ms before translating interim text
      
      return;
    }
    
    // Handle final translations
    if (interimTranslationTimeout) {
      clearTimeout(interimTranslationTimeout);
      interimTranslationTimeout = null;
    }
    
    // Accumulate final text in session
    const finalSessionText = currentSessionText ? `${currentSessionText} ${text}` : text;
    currentSessionText = finalSessionText;
    lastInterimTranslation = ''; // Reset interim tracking
    
    const result = await translationService.translateText(finalSessionText);
    
    const translationMessage: TranslationMessage = {
      id: currentSessionId || Date.now().toString(),
      originalText: result.originalText,
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage,
      targetLanguage: result.targetLanguage,
      timestamp: Date.now(),
      isFinal: true,
    };

    // Broadcast to all subscribers
    broadcastToSubscribers({
      type: 'translation',
      translation: translationMessage,
    });

    console.log(`Final translation: ${result.sourceLanguage} -> ${result.targetLanguage}`);
  } catch (error) {
    console.error('Translation error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Translation failed'
    }));
  }
}

function broadcastToSubscribers(message: WebSocketMessage) {
  connections.forEach((connection) => {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastSubscriberCount() {
  const count = connections.size;
  broadcastToSubscribers({
    type: 'subscriber_count',
    count: count,
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Publisher password: ${PUBLISHER_PASSWORD}`);
  console.log(`🔑 Visit http://localhost:${PORT} to access the app`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
