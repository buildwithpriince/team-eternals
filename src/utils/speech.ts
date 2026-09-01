import { AppLanguage } from '../types';

interface TTSResponse {
  audioBase64?: string;
  mimeType?: string;
  error?: string;
  fallback?: boolean;
}

const DEFAULT_VOICE = 'Despina';

class SpeechService {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isCurrentlyPlaying: boolean = false;
  private abortController: AbortController | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private synth: SpeechSynthesis | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 24000 });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  // Generate unique cache key from (text + voice name + language)
  private getCacheKey(text: string, voice: string = DEFAULT_VOICE, lang: AppLanguage = 'en'): string {
    return `tts_${voice}_${lang}_${text.trim().toLowerCase()}`;
  }

  // Play an accessible pleasant chime for feedback
  public playChime(type: 'gentle' | 'success' | 'alert' = 'gentle') {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'gentle') {
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // Audio context might fail on uninitiated user interaction, gracefully ignore
    }
  }

  private async decodeAudio(base64Data: string): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check if it's a RIFF/WAV format
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      return await ctx.decodeAudioData(bytes.buffer.slice(0));
    }

    // Otherwise, treat as raw 16-bit PCM little endian (24kHz, 1 channel)
    const sampleRate = 24000;
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
    audioBuffer.copyToChannel(float32Array, 0);
    return audioBuffer;
  }

  // Silent fallback to Web Speech API when quota/rate limits occur
  private speakFallback(
    text: string,
    lang: AppLanguage = 'hi',
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ) {
    if (!this.synth) {
      if (onStart) onStart();
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 1500);
      return;
    }

    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = this.synth.getVoices();
    const targetLang = lang === 'hi' ? 'hi-IN' : 'en-IN';

    // Prioritize soft, mild female voices in Hindi and English
    const femaleKeywords = [
      'female',
      'swara',
      'heera',
      'kalpana',
      'zira',
      'samantha',
      'serena',
      'karen',
      'victoria',
      'veena',
      'natural',
      'google',
    ];
    const matchingLangVoices = voices.filter(
      (v) => v.lang === targetLang || v.lang.startsWith(lang === 'hi' ? 'hi' : 'en')
    );

    const matchedVoice =
      matchingLangVoices.find((v) =>
        femaleKeywords.some((kw) => v.name.toLowerCase().includes(kw))
      ) || matchingLangVoices[0];

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.lang = targetLang;
    utterance.rate = lang === 'en' ? 1.08 : 0.95;
    utterance.pitch = 1.05;

    utterance.onstart = () => {
      this.isCurrentlyPlaying = true;
      if (onStart) onStart();
    };
    utterance.onend = () => {
      this.isCurrentlyPlaying = false;
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      this.isCurrentlyPlaying = false;
      if (onError) onError();
      if (onEnd) onEnd();
    };

    try {
      this.synth.speak(utterance);
    } catch {
      this.isCurrentlyPlaying = false;
      if (onEnd) onEnd();
    }
  }

  public async speak(
    text: string,
    lang: AppLanguage = 'hi',
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ): Promise<void> {
    if (!text || text.trim().length === 0) {
      if (onEnd) onEnd();
      return;
    }

    this.stop();

    const cleanText = text.trim();
    const cacheKey = this.getCacheKey(cleanText, DEFAULT_VOICE, lang);

    // 1. In-memory Cache Hit: Play directly
    if (this.bufferCache.has(cacheKey)) {
      const audioBuffer = this.bufferCache.get(cacheKey)!;
      this.playAudioBuffer(audioBuffer, onStart, onEnd, lang);
      return;
    }

    // 2. Local Storage Cache Hit (survives reloads): Decode and play directly
    try {
      const cachedBase64 = localStorage.getItem(cacheKey);
      if (cachedBase64) {
        const audioBuffer = await this.decodeAudio(cachedBase64);
        this.bufferCache.set(cacheKey, audioBuffer);
        this.playAudioBuffer(audioBuffer, onStart, onEnd, lang);
        return;
      }
    } catch {
      // LocalStorage access error or quota exceeded, proceed to API call
    }

    // 3. Genuine Cache Miss: Call the TTS API
    this.abortController = new AbortController();

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          language: lang,
          voice: DEFAULT_VOICE,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        console.warn(`Gemini TTS API returned status ${response.status}. Falling back silently to browser speech synthesis.`);
        this.speakFallback(cleanText, lang, onStart, onEnd, onError);
        return;
      }

      const data: TTSResponse = await response.json();

      if (data.fallback || !data.audioBase64) {
        if (data.error) {
          console.warn(`Gemini TTS info: ${data.error}. Falling back silently to browser speech synthesis.`);
        }
        this.speakFallback(cleanText, lang, onStart, onEnd, onError);
        return;
      }

      const audioBuffer = await this.decodeAudio(data.audioBase64);

      // Save to memory cache
      if (this.bufferCache.size > 100) {
        const firstKey = this.bufferCache.keys().next().value;
        if (firstKey) this.bufferCache.delete(firstKey);
      }
      this.bufferCache.set(cacheKey, audioBuffer);

      // Save to persistent storage if size permits
      try {
        localStorage.setItem(cacheKey, data.audioBase64);
      } catch {
        // LocalStorage quota may be full, memory cache still holds it
      }

      this.playAudioBuffer(audioBuffer, onStart, onEnd, lang);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was interrupted by next user prompt
        return;
      }
      console.warn('Gemini TTS network/execution error, falling back silently to browser speech synthesis:', err);
      this.speakFallback(cleanText, lang, onStart, onEnd, onError);
    }
  }

  private playAudioBuffer(
    buffer: AudioBuffer,
    onStart?: () => void,
    onEnd?: () => void,
    lang: AppLanguage = 'hi'
  ) {
    try {
      const ctx = this.getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (lang === 'en') {
        source.playbackRate.value = 1.08;
      } else {
        source.playbackRate.value = 1.0;
      }
      source.connect(ctx.destination);

      this.currentSource = source;
      this.isCurrentlyPlaying = true;

      if (onStart) onStart();

      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
          this.isCurrentlyPlaying = false;
          if (onEnd) onEnd();
        }
      };

      source.start(0);
    } catch (err) {
      console.warn('AudioBuffer playback error, falling back:', err);
      this.isCurrentlyPlaying = false;
      if (onEnd) onEnd();
    }
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }

    if (this.synth) {
      this.synth.cancel();
    }

    this.isCurrentlyPlaying = false;
  }

  public isSpeaking(): boolean {
    return this.isCurrentlyPlaying;
  }
}

export const speechService = new SpeechService();
export { useTTS } from '../hooks/useTTS';
