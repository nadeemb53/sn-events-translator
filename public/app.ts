/// <reference path="../src/types/speech.d.ts" />

interface TranslationMessage {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: 'ko' | 'en';
  targetLanguage: 'ko' | 'en';
  timestamp: number;
  isFinal?: boolean;
}

interface WebSocketMessage {
  type: 'translation' | 'auth' | 'auth_success' | 'auth_failed' | 'subscriber_count' | 'error';
  data?: any;
  translation?: TranslationMessage;
  password?: string;
  count?: number;
  isFinal?: boolean;
}

class TranslatorApp {
  private ws: WebSocket | null = null;
  private isPublisher = false;
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private openaiApiKey: string | null = null;
  private translations: TranslationMessage[] = [];
  private recordingStartTime: number = 0;
  private silenceTimeout: number | null = null;
  private lastPassword: string | null = null;
  private recognition: any = null; // SpeechRecognition interface
  private interimTimeout: number | null = null;

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
  private koreanText: HTMLElement;
  private englishText: HTMLElement;
  private koreanLive: HTMLElement;
  private englishLive: HTMLElement;

  constructor() {
    try {
      // Safari iOS detection and debugging
      this.detectSafari();
      this.initializeElements();
      this.setupEventListeners();
      this.initializeSpeechRecognition();
      this.connectWebSocket();
    } catch (error) {
      console.error('Failed to initialize TranslatorApp:', error);
      // Display error to user
      document.body.innerHTML = `
        <div style="color: white; padding: 20px; text-align: center; background: #0a0b1f; min-height: 100vh;">
          <h1>Initialization Error</h1>
          <p>Failed to initialize the application: ${error.message}</p>
          <p>Please refresh the page and try again.</p>
          <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #8b5cf6; color: white; border: none; border-radius: 5px; cursor: pointer;">Refresh Page</button>
        </div>
      `;
    }
  }

  private detectSafari(): void {
    const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isSafari || isIOS) {
      console.log('Safari/iOS detected, applying compatibility fixes');
      // Add safari-specific class to body for additional styling
      document.body.classList.add('safari-browser');
      
      // Force minimum font size to prevent zoom on iOS
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    }
  }

  private initializeElements(): void {
    try {
      this.connectionStatus = document.getElementById('connection-status');
      this.subscriberCount = document.getElementById('subscriber-count');
      this.subscriberModeBtn = document.getElementById('subscriber-mode-btn') as HTMLButtonElement;
      this.publisherModeBtn = document.getElementById('publisher-mode-btn') as HTMLButtonElement;
      this.authSection = document.getElementById('auth-section');
      this.publisherPassword = document.getElementById('publisher-password') as HTMLInputElement;
      this.authBtn = document.getElementById('auth-btn') as HTMLButtonElement;
      this.authStatus = document.getElementById('auth-status');
      this.publisherControls = document.getElementById('publisher-controls');
      this.startRecordingBtn = document.getElementById('start-recording') as HTMLButtonElement;
      this.stopRecordingBtn = document.getElementById('stop-recording') as HTMLButtonElement;
      this.recordingStatus = document.getElementById('recording-status');
      this.speechText = document.getElementById('speech-text');
      this.koreanText = document.getElementById('korean-text');
      this.englishText = document.getElementById('english-text');
      this.koreanLive = document.getElementById('korean-live');
      this.englishLive = document.getElementById('english-live');

      // Check if all required elements exist
      const requiredElements = [
        'connection-status', 'subscriber-count', 'subscriber-mode-btn', 'publisher-mode-btn',
        'auth-section', 'publisher-password', 'auth-btn', 'auth-status', 'publisher-controls',
        'start-recording', 'stop-recording', 'recording-status', 'speech-text', 
        'korean-text', 'english-text', 'korean-live', 'english-live'
      ];

      for (const elementId of requiredElements) {
        const element = document.getElementById(elementId);
        if (!element) {
          throw new Error(`Required element not found: ${elementId}`);
        }
      }

      console.log('All UI elements initialized successfully');
    } catch (error) {
      console.error('Failed to initialize UI elements:', error);
      throw error;
    }
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
    // Prevent multiple concurrent connection attempts
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket connection already exists, skipping new connection');
      return;
    }
    
    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
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
      console.log('Attempting WebSocket connection to:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.connectionStatus.textContent = 'Connected';
        this.connectionStatus.classList.remove('disconnected');
        this.connectionStatus.classList.add('connected');
        
        // Re-authenticate if we were previously authenticated as publisher
        if (this.isPublisher && this.lastPassword) {
          console.log('Re-authenticating as publisher after reconnection');
          this.ws?.send(JSON.stringify({ 
            type: 'auth', 
            password: this.lastPassword 
          }));
        }
      };
      
      this.ws.onmessage = (event) => {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
        this.connectionStatus.textContent = 'Disconnected';
        this.connectionStatus.classList.remove('connected');
        this.connectionStatus.classList.add('disconnected');
        
        // Only attempt reconnection if it wasn't a deliberate close
        if (event.code !== 1000) { // 1000 = normal closure
          console.log('Scheduling reconnection in 3 seconds...');
          setTimeout(() => this.connectWebSocket(), 3000);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.connectionStatus.textContent = 'Connection Error';
        this.connectionStatus.classList.remove('connected');
        this.connectionStatus.classList.add('disconnected');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.connectionStatus.textContent = 'Connection Failed';
      this.connectionStatus.classList.remove('connected');
      this.connectionStatus.classList.add('disconnected');
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
        this.fetchOpenAIKey();
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
    
    // Store password for re-authentication
    this.lastPassword = password;
    
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

  private async fetchOpenAIKey(): Promise<void> {
    try {
      const password = this.publisherPassword.value.trim();
      
      // Determine the correct backend URL
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      let apiUrl: string;
      
      if (isLocal) {
        apiUrl = `${window.location.protocol}//${window.location.host}/api/openai-key`;
      } else {
        // Production API URL - Connected to Railway backend
        apiUrl = 'https://sn-events-translator-production.up.railway.app/api/openai-key';
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.openaiApiKey = data.apiKey;
        console.log('OpenAI API key fetched successfully');
      } else {
        console.error('Failed to fetch OpenAI API key:', response.status);
      }
    } catch (error) {
      console.error('Error fetching OpenAI API key:', error);
    }
  }

  private showPublisherControls(): void {
    this.authSection.classList.add('hidden');
    this.publisherControls.classList.remove('hidden');
  }

  private async startRecording(): Promise<void> {
    if (!this.openaiApiKey) {
      this.recordingStatus.textContent = '❌ OpenAI API key not available';
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
    
    try {
      // Initialize audio recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        await this.processAudioWithWhisper();
      };
      
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.speechText.textContent = '';
      
      // Record in 8-second chunks for even better context and accuracy
      this.mediaRecorder.start();
      this.scheduleNextChunk();
      
      this.recordingStatus.textContent = '🎤 Recording...';
      this.updateRecordingButtons();
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.recordingStatus.textContent = '❌ Microphone access denied';
      this.isRecording = false;
      this.updateRecordingButtons();
    }
  }
  
  private scheduleNextChunk(): void {
    if (this.isRecording && this.mediaRecorder) {
      setTimeout(() => {
        if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          // Restart for next chunk
          setTimeout(() => {
            if (this.isRecording && this.mediaRecorder) {
              this.mediaRecorder.start();
              this.scheduleNextChunk();
            }
          }, 100);
        }
      }, 5000); // 5-second chunks for accuracy
    }
  }
  
  private async processAudioWithWhisper(): Promise<void> {
    if (!this.openaiApiKey || this.audioChunks.length === 0) return;
    
    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.audioChunks = [];
      
      // Skip very short recordings (need substantial audio for good transcription)
      // Skip very small audio chunks (likely silence/noise) - but not too aggressive
      if (audioBlob.size < 500) {
        console.log('🔇 Skipping small audio chunk:', audioBlob.size, 'bytes');
        return;
      }
      
      this.recordingStatus.textContent = '🔄 Transcribing...';
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'gpt-4o-transcribe');
      formData.append('temperature', '0');
      formData.append('prompt', 'Dont repeat the prompt Status, Logos, Codex, Waku, Nimbus, Nomos, IFT, DA Layer');
      formData.append('response_format', 'text');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}:`, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      // gpt-4o-transcribe with response_format=text returns plain text, not JSON
      let transcript = (await response.text()).trim();
      
      // Filter out prompt hallucination - detect Korean repetitions and exact prompt echoing
      const koreanRepetitions = /스테이터스.*로고스.*코덱스/g;
      const hasKoreanRepetitions = koreanRepetitions.test(transcript);
      const isExactPromptEcho = transcript.includes('Status, Logos, Codex, Waku, Nimbus, Nomos, IFT, DA Layer');
      const isHallucination = hasKoreanRepetitions || isExactPromptEcho;
      
      if (isHallucination) {
        console.log('🚫 Filtered out prompt hallucination:', transcript);
        transcript = '';
      }
      
      // Also check transcript length to avoid sending very short/meaningless text
      if (transcript && transcript.length > 2 && this.ws && this.isPublisher) {
        // Accumulate text instead of replacing
        const currentText = this.speechText.textContent || '';
        this.speechText.textContent = currentText ? `${currentText} ${transcript}` : transcript;
        
        // Send translation
        this.sendTranslation(transcript);
        this.recordingStatus.textContent = '🎤 Recording...';
        
        console.log('transcript:', transcript);
      }
      
    } catch (error) {
      console.error('transcription error:', error);
      this.recordingStatus.textContent = '❌ Transcription failed';
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      // Stop all audio tracks
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
    this.isRecording = false;
    this.recordingStatus.textContent = 'Recording stopped';
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
    // Show live indicators
    if (!translation.isFinal) {
      this.showLiveIndicators(translation.sourceLanguage);
    } else {
      this.hideLiveIndicators();
    }
    
    // Add text to the appropriate blob based on language
    this.appendToBlob(translation.originalText, translation.sourceLanguage, !translation.isFinal);
    this.appendToBlob(translation.translatedText, translation.targetLanguage, !translation.isFinal);
    
    // Store translation for potential future use
    if (translation.isFinal) {
      this.translations.unshift(translation);
      if (this.translations.length > 50) {
        this.translations = this.translations.slice(0, 50);
      }
    }
  }

  private showLiveIndicators(sourceLanguage: 'ko' | 'en'): void {
    if (sourceLanguage === 'ko') {
      this.koreanLive.style.display = 'block';
      this.englishLive.style.display = 'none';
    } else {
      this.englishLive.style.display = 'block';
      this.koreanLive.style.display = 'none';
    }
  }
  
  private hideLiveIndicators(): void {
    this.koreanLive.style.display = 'none';
    this.englishLive.style.display = 'none';
  }
  
  private appendToBlob(text: string, language: 'ko' | 'en', isInterim: boolean): void {
    const targetElement = language === 'ko' ? this.koreanText : this.englishText;
    
    // Remove placeholder text if it exists
    const placeholder = targetElement.querySelector('.placeholder-text');
    if (placeholder) {
      placeholder.remove();
    }
    
    if (isInterim) {
      // For interim results, replace or add interim text
      let interimSpan = targetElement.querySelector('.interim-text') as HTMLSpanElement;
      if (!interimSpan) {
        interimSpan = document.createElement('span');
        interimSpan.className = 'interim-text';
        targetElement.appendChild(interimSpan);
      }
      interimSpan.textContent = text + ' ';
      interimSpan.style.backgroundColor = '#fef3c7';
      interimSpan.style.padding = '2px 4px';
      interimSpan.style.borderRadius = '4px';
    } else {
      // For final results, remove interim and add final text
      const interimSpan = targetElement.querySelector('.interim-text');
      if (interimSpan) {
        interimSpan.remove();
      }
      
      const finalSpan = document.createElement('span');
      finalSpan.textContent = text + ' ';
      targetElement.appendChild(finalSpan);
    }
    
    // Auto-scroll to bottom
    targetElement.scrollTop = targetElement.scrollHeight;
  }

}

// Initialize the app when the page loads with error handling
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('DOM loaded, initializing TranslatorApp...');
    new TranslatorApp();
  } catch (error) {
    console.error('Failed to start TranslatorApp:', error);
    // Fallback error display
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="color: white; padding: 20px; text-align: center; background: #0a0b1f; min-height: 100vh; font-family: Arial, sans-serif;">
        <h1 style="color: #ef4444;">Application Error</h1>
        <p>The application failed to start: ${error.message}</p>
        <p>Please check the browser console for more details.</p>
        <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #8b5cf6; color: white; border: none; border-radius: 5px; cursor: pointer;">Refresh Page</button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
});
