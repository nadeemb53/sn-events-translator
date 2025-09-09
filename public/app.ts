/// <reference path="../src/types/speech.d.ts" />

interface TranslationMessage {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: 'ko' | 'en';
  targetLanguage: 'ko' | 'en';
  timestamp: number;
}

interface WebSocketMessage {
  type: 'translation' | 'auth' | 'auth_success' | 'auth_failed' | 'subscriber_count' | 'error';
  data?: any;
  translation?: TranslationMessage;
  password?: string;
  count?: number;
}

class TranslatorApp {
  private ws: WebSocket | null = null;
  private isPublisher = false;
  private isRecording = false;
  private recognition: SpeechRecognition | null = null;
  private translations: TranslationMessage[] = [];

  // UI Elements
  private connectionStatus: HTMLElement;
  private subscriberCount: HTMLElement;
  private subscriberModeBtn: HTMLButtonElement;
  private publisherModeBtn: HTMLButtonElement;
  private authSection: HTMLElement;
  private publisherPassword: HTMLInputElement;
  private authBtn: HTMLButtonElement;
  private authStatus: HTMLElement;
  private publisherControls: HTMLElement;
  private startRecordingBtn: HTMLButtonElement;
  private stopRecordingBtn: HTMLButtonElement;
  private recordingStatus: HTMLElement;
  private speechText: HTMLElement;
  private translationsContainer: HTMLElement;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.initializeSpeechRecognition();
    this.connectWebSocket();
  }

  private initializeElements(): void {
    this.connectionStatus = document.getElementById('connection-status')!;
    this.subscriberCount = document.getElementById('subscriber-count')!;
    this.subscriberModeBtn = document.getElementById('subscriber-mode-btn') as HTMLButtonElement;
    this.publisherModeBtn = document.getElementById('publisher-mode-btn') as HTMLButtonElement;
    this.authSection = document.getElementById('auth-section')!;
    this.publisherPassword = document.getElementById('publisher-password') as HTMLInputElement;
    this.authBtn = document.getElementById('auth-btn') as HTMLButtonElement;
    this.authStatus = document.getElementById('auth-status')!;
    this.publisherControls = document.getElementById('publisher-controls')!;
    this.startRecordingBtn = document.getElementById('start-recording') as HTMLButtonElement;
    this.stopRecordingBtn = document.getElementById('stop-recording') as HTMLButtonElement;
    this.recordingStatus = document.getElementById('recording-status')!;
    this.speechText = document.getElementById('speech-text')!;
    this.translationsContainer = document.getElementById('translations-container')!;
  }

  private setupEventListeners(): void {
    this.subscriberModeBtn.addEventListener('click', () => this.switchToSubscriberMode());
    this.publisherModeBtn.addEventListener('click', () => this.switchToPublisherMode());
    this.authBtn.addEventListener('click', () => this.authenticate());
    this.startRecordingBtn.addEventListener('click', () => this.startRecording());
    this.stopRecordingBtn.addEventListener('click', () => this.stopRecording());
    
    // Enter key for password
    this.publisherPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.authenticate();
      }
    });
  }

  private initializeSpeechRecognition(): void {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'ko-KR'; // Start with Korean, will auto-detect
      
      this.recognition.onstart = () => {
        this.recordingStatus.textContent = '🎤 Recording... Speak now!';
        this.recordingStatus.classList.add('recording');
      };
      
      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        this.speechText.textContent = finalTranscript + interimTranscript;
        
        if (finalTranscript && this.ws && this.isPublisher) {
          this.sendTranslation(finalTranscript.trim());
          this.recordingStatus.textContent = '📤 Processing translation...';
          this.recordingStatus.classList.remove('recording');
          this.recordingStatus.classList.add('processing');
        }
      };
      
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.recordingStatus.textContent = `❌ Error: ${event.error}`;
        this.recordingStatus.classList.remove('recording', 'processing');
        this.isRecording = false;
        this.updateRecordingButtons();
      };
      
      this.recognition.onend = () => {
        this.isRecording = false;
        this.updateRecordingButtons();
        if (this.recordingStatus.classList.contains('recording')) {
          this.recordingStatus.textContent = 'Ready to record';
          this.recordingStatus.classList.remove('recording');
        }
      };
    } else {
      console.error('Speech recognition not supported');
      this.recordingStatus.textContent = '❌ Speech recognition not supported in this browser';
    }
  }

  private connectWebSocket(): void {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let wsUrl: string;
    
    if (isLocal) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}`;
    } else {
      // Production WebSocket URL - UPDATE THIS after deploying backend
      wsUrl = 'wss://YOUR_BACKEND_URL_HERE.railway.app';
    }
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.connectionStatus.textContent = 'Connected';
        this.connectionStatus.classList.remove('disconnected');
        this.connectionStatus.classList.add('connected');
      };
      
      this.ws.onmessage = (event) => {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.connectionStatus.textContent = 'Disconnected';
        this.connectionStatus.classList.remove('connected');
        this.connectionStatus.classList.add('disconnected');
        
        // Reconnect after 3 seconds
        setTimeout(() => this.connectWebSocket(), 3000);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setTimeout(() => this.connectWebSocket(), 3000);
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'auth_success':
        this.isPublisher = true;
        this.authStatus.textContent = '✅ Publisher mode activated!';
        this.authStatus.classList.remove('error');
        this.authStatus.classList.add('success');
        this.showPublisherControls();
        break;
        
      case 'auth_failed':
        this.authStatus.textContent = '❌ Invalid password';
        this.authStatus.classList.remove('success');
        this.authStatus.classList.add('error');
        break;
        
      case 'translation':
        if (message.translation) {
          this.addTranslation(message.translation);
        }
        break;
        
      case 'subscriber_count':
        if (typeof message.count === 'number') {
          this.subscriberCount.textContent = `${message.count} subscriber${message.count !== 1 ? 's' : ''}`;
        }
        break;
        
      case 'error':
        console.error('Server error:', message.data);
        break;
    }
  }

  private switchToSubscriberMode(): void {
    this.subscriberModeBtn.classList.add('active');
    this.publisherModeBtn.classList.remove('active');
    this.authSection.classList.add('hidden');
    this.publisherControls.classList.add('hidden');
    this.isPublisher = false;
    
    if (this.isRecording) {
      this.stopRecording();
    }
  }

  private switchToPublisherMode(): void {
    this.publisherModeBtn.classList.add('active');
    this.subscriberModeBtn.classList.remove('active');
    this.authSection.classList.remove('hidden');
    this.publisherControls.classList.add('hidden');
  }

  private authenticate(): void {
    const password = this.publisherPassword.value.trim();
    if (!password) {
      this.authStatus.textContent = '❌ Please enter a password';
      this.authStatus.classList.remove('success');
      this.authStatus.classList.add('error');
      return;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'auth',
        password: password
      }));
      this.authStatus.textContent = '🔄 Authenticating...';
      this.authStatus.classList.remove('success', 'error');
    } else {
      this.authStatus.textContent = '❌ Not connected to server';
      this.authStatus.classList.remove('success');
      this.authStatus.classList.add('error');
    }
  }

  private showPublisherControls(): void {
    this.authSection.classList.add('hidden');
    this.publisherControls.classList.remove('hidden');
  }

  private startRecording(): void {
    if (!this.recognition) {
      this.recordingStatus.textContent = '❌ Speech recognition not supported';
      return;
    }
    
    if (!this.isPublisher) {
      this.recordingStatus.textContent = '❌ Please authenticate as publisher first';
      return;
    }
    
    this.isRecording = true;
    this.speechText.textContent = '';
    this.recognition.start();
    this.updateRecordingButtons();
  }

  private stopRecording(): void {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
    this.isRecording = false;
    this.updateRecordingButtons();
  }

  private updateRecordingButtons(): void {
    this.startRecordingBtn.disabled = this.isRecording;
    this.stopRecordingBtn.disabled = !this.isRecording;
  }

  private sendTranslation(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'translation',
        data: text
      }));
    }
  }

  private addTranslation(translation: TranslationMessage): void {
    this.translations.unshift(translation);
    
    // Keep only the last 20 translations
    if (this.translations.length > 20) {
      this.translations = this.translations.slice(0, 20);
    }
    
    this.renderTranslations();
    
    // Reset recording status if we're the publisher
    if (this.isPublisher) {
      this.recordingStatus.textContent = 'Ready to record';
      this.recordingStatus.classList.remove('processing');
    }
  }

  private renderTranslations(): void {
    if (this.translations.length === 0) {
      this.translationsContainer.innerHTML = '<div class="no-translations">Waiting for translations...</div>';
      return;
    }
    
    this.translationsContainer.innerHTML = this.translations.map(translation => {
      const time = new Date(translation.timestamp).toLocaleTimeString();
      const langDirection = translation.sourceLanguage === 'ko' ? 'Korean → English' : 'English → Korean';
      
      return `
        <div class="translation-item">
          <div class="translation-header">
            <span class="language-indicator">${langDirection}</span>
            <span class="timestamp">${time}</span>
          </div>
          <div class="translation-content">
            <div class="original-text">
              <div class="text-label">Original</div>
              ${translation.originalText}
            </div>
            <div class="translated-text">
              <div class="text-label">Translation</div>
              ${translation.translatedText}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new TranslatorApp();
});
