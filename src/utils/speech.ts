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

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Purge any stale legacy audio caches from localStorage
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

      // 3. Attach one-time global user interaction listener to unlock audio on first touch/click
      const unlockHandler = () => {
        this.unlockAudio();
      };
      window.addEventListener('click', unlockHandler, { once: false, passive: true });
      window.addEventListener('touchstart', unlockHandler, { once: false, passive: true });
      window.addEventListener('keydown', unlockHandler, { once: false, passive: true });
    }
  }

  public unlockAudio(): void {
    if (this.isAudioUnlocked) {
      if (this.synth && this.synth.paused) {
        try {
          this.synth.resume();
        } catch {
          // ignore
        }
      }
      return;
    }

    try {
      this.getAudioContext();
      if (this.synth) {
        this.synth.resume();
      }
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
      return anyHi || this.lockedVoiceEn || voices[0];
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

  // Play an accessible, pleasant chime for user feedback
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
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
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

    const cleanText = this.cleanSpeechText(text);
    if (!cleanText) {
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

    // 3. Clear existing speech queue
    const hadActiveSpeech = this.synth.speaking || this.synth.pending || this.synth.paused;
    if (hadActiveSpeech) {
      try {
        this.synth.cancel();
      } catch {
        // ignore
      }
    }

    // Ensure speech synthesis is unpaused
    try {
      this.synth.resume();
    } catch {
      // ignore
    }

    // 4. Schedule the new utterance with a micro-delay if a cancel was just issued
    // This completely eliminates the Chromium cancel-and-speak race bug!
    const delay = hadActiveSpeech ? 40 : 0;

    setTimeout(() => {
      // If a newer speak request was dispatched in the meantime, discard this one
      if (this.speakRequestId !== currentReq) {
        return;
      }

      const voices = this.synth?.getVoices() || [];
      if (!this.lockedVoiceEn || !this.lockedVoiceHi) {
        this.lockedVoiceEn = this.findBestIndianVoice(voices, 'en');
        this.lockedVoiceHi = this.findBestIndianVoice(voices, 'hi');
      }

      const targetVoice = lang === 'hi' ? this.lockedVoiceHi : this.lockedVoiceEn;
      const targetLang = lang === 'hi' ? 'hi-IN' : 'en-IN';

      const utterance = new SpeechSynthesisUtterance(cleanText);

      if (targetVoice) {
        utterance.voice = targetVoice;
      }
      utterance.lang = targetLang;

      // Natural speech cadence
      utterance.rate = lang === 'en' ? 1.0 : 0.95;
      utterance.pitch = 1.02;
      utterance.volume = 1.0;

      // CRITICAL BUGFIX: Store utterance on class instance & global window
      // so Chrome V8 Garbage Collector DOES NOT kill it during synthesis!
      this.activeUtterance = utterance;
      if (typeof window !== 'undefined') {
        (window as any).__swasthyaActiveUtterance = utterance;
      }

      let hasStarted = false;
      let hasFinished = false;

      const finishUtterance = (wasError = false) => {
        if (hasFinished) return;
        hasFinished = true;
        this.isCurrentlyPlaying = false;
        this.activeUtterance = null;
        if (this.keepAliveTimer) {
          clearInterval(this.keepAliveTimer);
          this.keepAliveTimer = null;
        }
        if (wasError) {
          if (onError) onError();
        }
        if (onEnd) onEnd();
      };

      utterance.onstart = () => {
        if (this.speakRequestId !== currentReq) return;
        hasStarted = true;
        this.isCurrentlyPlaying = true;
        if (onStart) onStart();

        // Safe watchdog: ensure Chrome doesn't freeze the speech queue
        this.keepAliveTimer = setInterval(() => {
          if (this.synth) {
            if (this.synth.paused) {
              this.synth.resume();
            }
          }
        }, 3000);
      };

      utterance.onend = () => {
        if (this.speakRequestId !== currentReq) return;
        finishUtterance(false);
      };

      utterance.onerror = (e) => {
        if (this.speakRequestId !== currentReq) return;
        // Ignore canceled/interrupted if superseded
        if (e.error === 'canceled' || e.error === 'interrupted') {
          finishUtterance(false);
        } else {
          console.warn('[SpeechService] Utterance error:', e.error);
          finishUtterance(true);
        }
      };

      try {
        this.synth?.speak(utterance);
        // Force immediate audio resume
        this.synth?.resume();
      } catch (err) {
        console.warn('[SpeechService] synth.speak threw:', err);
        finishUtterance(true);
      }

      // Fallback timer: if browser never fires onstart within 3 seconds, unblock UI
      setTimeout(() => {
        if (!hasStarted && this.speakRequestId === currentReq && !hasFinished) {
          try {
            if (this.synth && this.synth.paused) {
              this.synth.resume();
            }
          } catch {
            // ignore
          }
        }
      }, 3000);
    }, delay);
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
      } catch {
        // ignore
      }
    }
    this.activeUtterance = null;
    this.isCurrentlyPlaying = false;
  }

  public isPlaying(): boolean {
    return this.isCurrentlyPlaying || (this.synth ? this.synth.speaking : false);
  }
}

export const speechService = new SpeechService();
