import { AppLanguage } from '../types';

class SpeechService {
  private audioContext: AudioContext | null = null;
  private synth: SpeechSynthesis | null = null;
  private lockedVoiceEn: SpeechSynthesisVoice | null = null;
  private lockedVoiceHi: SpeechSynthesisVoice | null = null;
  private isCurrentlyPlaying: boolean = false;
  private voicesLoaded: boolean = false;
  private keepAliveTimer: any = null;
  private speakRequestId: number = 0;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private isAudioUnlocked: boolean = false;
  private activeAudioSource: AudioBufferSourceNode | null = null;
  private activeUtteranceList: SpeechSynthesisUtterance[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Purge legacy caches
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('tts_') || k.startsWith('gemini_tts_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }

      // 2. Initialize SpeechSynthesis
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.initVoices();
      }

      // 3. Attach global user interaction listeners to unlock audio
      const unlockHandler = () => {
        this.unlockAudio();
      };
      window.addEventListener('click', unlockHandler, { once: false, passive: true });
      window.addEventListener('touchstart', unlockHandler, { once: false, passive: true });
      window.addEventListener('pointerdown', unlockHandler, { once: false, passive: true });
      window.addEventListener('keydown', unlockHandler, { once: false, passive: true });
    }
  }

  public unlockAudio(): void {
    try {
      if (this.synth) {
        if (this.synth.paused) {
          this.synth.resume();
        }
      }
      this.getAudioContext();
      this.isAudioUnlocked = true;
    } catch {
      // ignore
    }
  }

  private initVoices() {
    if (!this.synth) return;

    const resolveAndLockVoices = () => {
      try {
        const voices = this.synth?.getVoices() || [];
        if (voices.length === 0) return;

        this.voicesLoaded = true;
        this.lockedVoiceEn = this.findBestIndianVoice(voices, 'en');
        this.lockedVoiceHi = this.findBestIndianVoice(voices, 'hi');
      } catch {
        // ignore
      }
    };

    resolveAndLockVoices();

    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        resolveAndLockVoices();
      };
    }
  }

  private findBestIndianVoice(
    voices: SpeechSynthesisVoice[],
    lang: AppLanguage
  ): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;

    if (lang === 'en') {
      const indianFemaleKeywords = [
        'neerja',
        'heera',
        'veena',
        'swara',
        'aditi',
        'kavya',
        'ananya',
        'priya',
        'shruti',
        'sunita',
        'isha',
        'pooja',
        'kalpana',
      ];

      // 1. Direct match for en-IN female named voices
      const enInVoices = voices.filter((v) => {
        const l = (v.lang || '').toLowerCase().replace('_', '-');
        const n = (v.name || '').toLowerCase();
        return (
          (l === 'en-in' || l.startsWith('en-in') || n.includes('india') || n.includes('indian')) &&
          (l.startsWith('en') || n.includes('english'))
        );
      });

      const matchedIndianFemale = enInVoices.find((v) => {
        const n = v.name.toLowerCase();
        return indianFemaleKeywords.some((kw) => n.includes(kw));
      });
      if (matchedIndianFemale) return matchedIndianFemale;

      // 2. Any en-IN voice
      if (enInVoices.length > 0) return enInVoices[0];

      // 3. High quality natural female English voices
      const femaleKeywords = [
        'female',
        'woman',
        'natural',
        'samantha',
        'victoria',
        'serena',
        'karen',
        'zira',
        'google',
      ];
      const matchedFemaleEn = voices.find((v) => {
        const l = (v.lang || '').toLowerCase();
        const n = (v.name || '').toLowerCase();
        return l.startsWith('en') && femaleKeywords.some((kw) => n.includes(kw));
      });
      if (matchedFemaleEn) return matchedFemaleEn;

      // 4. Any English voice
      const anyEn = voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
      return anyEn || voices[0];
    } else {
      // Hindi voice search
      const hindiKeywords = ['swara', 'kalpana', 'heera', 'google', 'female', 'lekha', 'priya'];
      const hiVoices = voices.filter((v) => {
        const l = (v.lang || '').toLowerCase().replace('_', '-');
        const n = (v.name || '').toLowerCase();
        return (
          l === 'hi-in' ||
          l.startsWith('hi') ||
          n.includes('hindi') ||
          n.includes('हिन्दी') ||
          l.includes('hin')
        );
      });

      const matchedHiFemale = hiVoices.find((v) => {
        const n = v.name.toLowerCase();
        return hindiKeywords.some((kw) => n.includes(kw));
      });
      if (matchedHiFemale) return matchedHiFemale;
      if (hiVoices.length > 0) return hiVoices[0];

      // Fallback if no specific hi voice is installed
      const anyHi = voices.find((v) => (v.lang || '').toLowerCase().startsWith('hi'));
      if (anyHi) return anyHi;

      // Check if Indian English voice is available as secondary fallback for Hindi
      return this.lockedVoiceEn || voices[0];
    }
  }

  public prewarm() {
    try {
      this.unlockAudio();
      if (this.synth) {
        const voices = this.synth.getVoices();
        if (voices.length > 0) {
          this.lockedVoiceEn = this.findBestIndianVoice(voices, 'en');
          this.lockedVoiceHi = this.findBestIndianVoice(voices, 'hi');
        }
      }
    } catch {
      // safe ignore
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

  // Play an accessible chime without interfering with speech
  public playChime(type: 'gentle' | 'success' | 'alert' = 'gentle') {
    try {
      this.unlockAudio();
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'gentle') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // Audio context may fail on uninitiated interaction, gracefully ignore
    }
  }

  public async prefetch(_text: string, _lang: AppLanguage = 'en'): Promise<void> {
    this.prewarm();
  }

  /**
   * Clean and normalize raw text for smooth speech pronunciation
   */
  private cleanSpeechText(text: string): string {
    return text
      .replace(/[*#_~`]/g, '') // remove markdown symbols
      .replace(/\s+/g, ' ') // collapse whitespace
      .replace(/OPD-(\d+)/gi, 'O P D token number $1')
      .replace(/ABHA ID:?/gi, 'Aabha I D')
      .trim();
  }

  /**
   * Split long text into natural sentence chunks for instant Chromium synthesis
   */
  private splitIntoSentenceChunks(text: string): string[] {
    const clean = this.cleanSpeechText(text);
    if (!clean) return [];
    if (clean.length <= 150) return [clean];

    // Split by sentence terminators (periods, question marks, exclamation marks, or Hindi danda)
    const sentences = clean.split(/(?<=[.?!।\n])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length <= 1) {
      // Fallback: split by commas if very long single sentence
      if (clean.length > 180) {
        return clean.split(/(?<=[,])\s+/).map((s) => s.trim()).filter(Boolean);
      }
      return [clean];
    }
    return sentences;
  }

  /**
   * Speak function that executes INSTANTLY with zero latency (at the blink of an eye)
   * Guaranteed against Chromium garbage collection cancellation and queue deadlocks.
   */
  public speak(
    text: string,
    lang: AppLanguage = 'en',
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ): void {
    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    const chunks = this.splitIntoSentenceChunks(text);
    if (chunks.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    this.speakRequestId += 1;
    const currentReq = this.speakRequestId;

    // 1. Immediately stop any active Web Audio fallback
    if (this.activeAudioSource) {
      try {
        this.activeAudioSource.stop();
      } catch {
        // ignore
      }
      this.activeAudioSource = null;
    }

    // 2. Stop keepalive timer from previous utterance
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    if (!this.synth) {
      if (onStart) onStart();
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 1500);
      return;
    }

    // 3. Clear existing speech queue and immediately resume synth
    try {
      this.synth.cancel();
      this.synth.resume();
    } catch {
      // ignore
    }

    const voices = this.synth.getVoices() || [];
    if (!this.lockedVoiceEn || !this.lockedVoiceHi || voices.length > 0) {
      this.lockedVoiceEn = this.findBestIndianVoice(voices, 'en');
      this.lockedVoiceHi = this.findBestIndianVoice(voices, 'hi');
    }

    const targetVoice = lang === 'hi' ? this.lockedVoiceHi : this.lockedVoiceEn;
    const targetLang = targetVoice?.lang || (lang === 'hi' ? 'hi-IN' : 'en-IN');

    // Setup sequential queue for chunks
    this.activeUtteranceList = [];
    let currentChunkIdx = 0;
    let hasStartedOverall = false;

    const startHeartbeat = () => {
      if (this.keepAliveTimer) return;
      this.keepAliveTimer = setInterval(() => {
        if (this.synth) {
          if (this.synth.paused) {
            try {
              this.synth.resume();
            } catch {
              // ignore
            }
          }
        }
      }, 200);
    };

    const stopHeartbeat = () => {
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
    };

    const speakNextChunk = () => {
      if (this.speakRequestId !== currentReq) return;

      if (currentChunkIdx >= chunks.length) {
        // Finished all chunks
        this.isCurrentlyPlaying = false;
        this.activeUtterance = null;
        stopHeartbeat();
        if (onEnd) onEnd();
        return;
      }

      const chunkText = chunks[currentChunkIdx];
      const utterance = new SpeechSynthesisUtterance(chunkText);

      if (targetVoice) {
        utterance.voice = targetVoice;
      }
      utterance.lang = targetLang;
      utterance.rate = lang === 'en' ? 1.0 : 0.95;
      utterance.pitch = 1.02;
      utterance.volume = 1.0;

      this.activeUtterance = utterance;
      this.activeUtteranceList.push(utterance);
      if (typeof window !== 'undefined') {
        (window as any).__swasthyaUtteranceQueue = this.activeUtteranceList;
      }

      utterance.onstart = () => {
        if (this.speakRequestId !== currentReq) return;
        this.isCurrentlyPlaying = true;
        if (!hasStartedOverall) {
          hasStartedOverall = true;
          if (onStart) onStart();
        }
        startHeartbeat();
      };

      utterance.onend = () => {
        if (this.speakRequestId !== currentReq) return;
        currentChunkIdx += 1;
        speakNextChunk();
      };

      utterance.onerror = (e) => {
        if (this.speakRequestId !== currentReq) return;
        if (e.error === 'canceled' || e.error === 'interrupted') {
          return;
        }
        console.warn('[SpeechService] Utterance error on chunk:', e.error);
        currentChunkIdx += 1;
        if (currentChunkIdx < chunks.length) {
          speakNextChunk();
        } else {
          this.isCurrentlyPlaying = false;
          stopHeartbeat();
          if (onError) onError();
          if (onEnd) onEnd();
        }
      };

      try {
        this.synth?.speak(utterance);
        this.synth?.resume();
      } catch (err) {
        console.warn('[SpeechService] synth.speak threw:', err);
        this.isCurrentlyPlaying = false;
        stopHeartbeat();
        if (onError) onError();
        if (onEnd) onEnd();
      }
    };

    // Execute immediately without artificial delay
    speakNextChunk();

    // Fast watchdog: if onstart hasn't fired in 300ms, force resume
    setTimeout(() => {
      if (this.speakRequestId === currentReq && !hasStartedOverall && this.synth) {
        try {
          this.synth.resume();
        } catch {
          // ignore
        }
      }
    }, 300);
  }

  public stop(): void {
    this.speakRequestId += 1;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.activeAudioSource) {
      try {
        this.activeAudioSource.stop();
      } catch {
        // ignore
      }
      this.activeAudioSource = null;
    }
    if (this.synth) {
      try {
        this.synth.cancel();
        this.synth.resume();
      } catch {
        // ignore
      }
    }
    this.activeUtterance = null;
    this.activeUtteranceList = [];
    this.isCurrentlyPlaying = false;
  }

  public isPlaying(): boolean {
    return this.isCurrentlyPlaying || (this.synth ? this.synth.speaking : false);
  }
}

export const speechService = new SpeechService();
