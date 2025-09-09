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
  private interimTimeout: number | null = null;
  private currentInterimTranslation: TranslationMessage | null = null;

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
    // Check if HTTPS is required
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    
    if (!isSecureContext) {
      console.error('Speech recognition requires HTTPS in production');
      this.recordingStatus.textContent = '❌ HTTPS required for microphone access';
      return;
    }
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      try {
        this.recognition = new SpeechRecognitionClass();
        
        // Configure for teleprompter-style continuous recognition
        this.recognition.continuous = true; // Always recording for teleprompter mode
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        
        // Set language - start with English for better compatibility
        this.recognition.lang = 'en-US';
        
        console.log('Speech recognition initialized successfully');
      } catch (error) {
        console.error('Failed to initialize speech recognition:', error);
        this.recordingStatus.textContent = '❌ Failed to initialize speech recognition';
        return;
      }
      
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
        
        // Show both final and interim results for teleprompter effect
        const fullText = finalTranscript + interimTranscript;
        this.speechText.textContent = fullText;
        
        // Send interim translations for real-time effect
        if (interimTranscript.trim() && this.ws && this.isPublisher) {
          this.sendInterimTranslation(interimTranscript.trim());
        }
        
        // Send final translations 
        if (finalTranscript.trim() && this.ws && this.isPublisher) {
          this.sendTranslation(finalTranscript.trim());
        }
      };
      
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = 'Recognition failed';
        
        switch (event.error) {
          case 'network':
            errorMessage = 'Network error - check connection and try again';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied - please allow microphone permission';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected - please try speaking again';
            break;
          case 'audio-capture':
            errorMessage = 'Audio capture failed - check microphone';
            break;
          case 'service-not-allowed':
            errorMessage = 'Speech service not allowed - try HTTPS';
            break;
          default:
            errorMessage = `Recognition error: ${event.error}`;
        }
        
        this.recordingStatus.textContent = `❌ ${errorMessage}`;
        this.recordingStatus.classList.remove('recording', 'processing');
        this.isRecording = false;
        this.updateRecordingButtons();
      };
      
      this.recognition.onend = () => {
        console.log('Speech recognition ended');
        
        // For teleprompter mode, always restart if we're still supposed to be recording
        if (this.isRecording) {
          try {
            setTimeout(() => {
              if (this.isRecording && this.recognition) {
                console.log('Restarting continuous recognition...');
                this.recognition.start();
              }
            }, 100); // Small delay before restarting
          } catch (error) {
            console.error('Failed to restart recording:', error);
            this.isRecording = false;
            this.updateRecordingButtons();
            this.recordingStatus.textContent = 'Ready to record';
            this.recordingStatus.classList.remove('recording');
          }
        } else {
          this.updateRecordingButtons();
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
      // Production WebSocket URL - Connected to Railway backend
      wsUrl = 'wss://sn-events-translator-production.up.railway.app';
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
    
    if (this.isRecording) {
      this.recordingStatus.textContent = '❌ Already recording';
      return;
    }
    
    this.isRecording = true;
    this.speechText.textContent = '';
    
    try {
      this.recognition.start();
      this.updateRecordingButtons();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.recordingStatus.textContent = '❌ Failed to start recording';
      this.isRecording = false;
      this.updateRecordingButtons();
    }
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
        data: text,
        isFinal: true
      }));
    }
  }

  private sendInterimTranslation(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Throttle interim translations to avoid spam
      clearTimeout(this.interimTimeout);
      this.interimTimeout = setTimeout(() => {
        this.ws!.send(JSON.stringify({
          type: 'translation',
          data: text,
          isFinal: false
        }));
      }, 300); // 300ms throttle
    }
  }

  private addTranslation(translation: TranslationMessage): void {
    // Handle interim translations differently for teleprompter effect
    if (!translation.isFinal) {
      this.currentInterimTranslation = translation;
      this.renderTranslations();
      return;
    }
    
    // Clear interim translation when final arrives
    this.currentInterimTranslation = null;
    
    // Find existing translation by ID (session-based grouping)
    const existingIndex = this.translations.findIndex(t => t.id === translation.id);
    
    if (existingIndex >= 0) {
      // Update existing translation in the same box
      this.translations[existingIndex] = translation;
    } else {
      // Add new translation
      this.translations.unshift(translation);
    }
    
    // Keep only the last 10 translations for teleprompter clarity
    if (this.translations.length > 10) {
      this.translations = this.translations.slice(0, 10);
    }
    
    this.renderTranslations();
  }

  private renderTranslations(): void {
    let content = '';
    
    // Show current interim translation at the top if available
    if (this.currentInterimTranslation) {
      const langDirection = this.currentInterimTranslation.sourceLanguage === 'ko' ? 'Korean → English' : 'English → Korean';
      content += `
        <div class="translation-item interim-translation">
          <div class="translation-header">
            <span class="language-indicator">${langDirection}</span>
            <span class="interim-label">🔴 LIVE</span>
          </div>
          <div class="translation-content">
            <div class="original-text">
              <div class="text-label">Speaking...</div>
              ${this.currentInterimTranslation.originalText}
            </div>
            <div class="translated-text">
              <div class="text-label">Live Translation</div>
              ${this.currentInterimTranslation.translatedText}
            </div>
          </div>
        </div>
      `;
    }
    
    // Show final translations
    if (this.translations.length === 0 && !this.currentInterimTranslation) {
      content = '<div class="no-translations">🎤 Ready for live translation...</div>';
    } else {
      content += this.translations.map(translation => {
        const time = new Date(translation.timestamp).toLocaleTimeString();
        const langDirection = translation.sourceLanguage === 'ko' ? 'Korean → English' : 'English → Korean';
        
        return `
          <div class="translation-item final-translation">
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
    
    this.translationsContainer.innerHTML = content;
  }

}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new TranslatorApp();
});
