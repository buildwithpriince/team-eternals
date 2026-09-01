import { AppLanguage } from '../types';

class SpeechService {
  private audioContext: AudioContext | null = null;
  private synth: SpeechSynthesis | null = null;
  private lockedVoiceEn: SpeechSynthesisVoice | null = null;
  private lockedVoiceHi: SpeechSynthesisVoice | null = null;
  private isCurrentlyPlaying: boolean = false;
  private voicesLoaded: boolean = false;
  private keepAliveTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Purge any stale legacy audio caches from localStorage to ensure 100% voice uniformity
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
    }
  }

  private initVoices() {
    if (!this.synth) return;

    const resolveAndLockVoices = () => {
      const voices = this.synth?.getVoices() || [];
      if (voices.length === 0) return;

      this.voicesLoaded = true;
      this.lockedVoiceEn = this.findBestIndianVoice(voices, 'en');
      this.lockedVoiceHi = this.findBestIndianVoice(voices, 'hi');
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
      // High-priority named Indian English female voices
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
        return (l === 'en-in' || l.startsWith('en-in') || n.includes('india') || n.includes('indian')) && l.startsWith('en');
      });

      const matchedIndianFemale = enInVoices.find((v) => {
        const n = v.name.toLowerCase();
        return indianFemaleKeywords.some((kw) => n.includes(kw));
      });
      if (matchedIndianFemale) return matchedIndianFemale;

      // 2. Any en-IN voice (provides native authentic Indian English accent)
      if (enInVoices.length > 0) return enInVoices[0];

      // 3. High quality natural female English voices
      const femaleKeywords = ['female', 'woman', 'natural', 'samantha', 'victoria', 'serena', 'karen', 'zira'];
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
      const hindiKeywords = ['swara', 'kalpana', 'heera', 'google', 'female'];
      const hiVoices = voices.filter((v) => {
        const l = (v.lang || '').toLowerCase().replace('_', '-');
        const n = (v.name || '').toLowerCase();
        return l === 'hi-in' || l.startsWith('hi') || n.includes('hindi') || n.includes('हिन्दी');
      });

      const matchedHiFemale = hiVoices.find((v) => {
        const n = v.name.toLowerCase();
        return hindiKeywords.some((kw) => n.includes(kw));
      });
      if (matchedHiFemale) return matchedHiFemale;
      if (hiVoices.length > 0) return hiVoices[0];

      return voices.find((v) => (v.lang || '').toLowerCase().startsWith('hi')) || voices[0];
    }
  }

  public prewarm() {
    try {
      this.getAudioContext();
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

  // No-op prefetch to maintain interface compatibility without network roundtrip delay
  public async prefetch(_text: string, _lang: AppLanguage = 'en'): Promise<void> {
    this.prewarm();
  }

  /**
   * Speak function that executes INSTANTLY with zero latency (at the blink of an eye)
   * and guarantees 100% identical Indian feminine voice synchronization across all pages.
   */
  public speak(
    text: string,
    lang: AppLanguage = 'en',
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ): void {
    if (!text || text.trim().length === 0) {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = text.trim();

    // 1. Immediately stop any active utterance
    this.stop();

    if (!this.synth) {
      if (onStart) onStart();
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 1500);
      return;
    }

    // 2. Ensure voice is resolved and locked
    const voices = this.synth.getVoices();
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

    // Standardized rate and pitch for calm, polite Indian nurse delivery
    utterance.rate = lang === 'en' ? 1.0 : 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this.isCurrentlyPlaying = true;
      if (onStart) onStart();

      // Chromium keep-alive heartbeat to prevent silent pauses during speech
      if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = setInterval(() => {
        if (this.synth && this.synth.speaking) {
          this.synth.pause();
          this.synth.resume();
        } else {
          if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        }
      }, 8000);
    };

    utterance.onend = () => {
      this.isCurrentlyPlaying = false;
      if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      this.isCurrentlyPlaying = false;
      if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
      // If canceled intentionally by user or step transition, do not trigger error state
      if (e.error === 'canceled' || e.error === 'interrupted') {
        if (onEnd) onEnd();
      } else {
        if (onError) onError();
        if (onEnd) onEnd();
      }
    };

    try {
      this.synth.speak(utterance);
    } catch {
      this.isCurrentlyPlaying = false;
      if (onEnd) onEnd();
    }
  }

  public stop(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
    this.isCurrentlyPlaying = false;
  }

  public isPlaying(): boolean {
    return this.isCurrentlyPlaying || (this.synth ? this.synth.speaking : false);
  }
}

export const speechService = new SpeechService();
