import { QuestionOption, AppLanguage } from '../types';

export interface VoiceMatchResult {
  matchedIds: string[];
  confidence?: number;
  explanation?: string;
  source?: string;
}

/**
 * Sends a patient's spoken voice transcript + question options list to Gemini 2.5 Flash
 * on the server to match the transcript to exact option ID(s), or returns empty array / 'none'.
 */
export async function matchVoiceToOptions(
  transcript: string,
  question: { id: string; question_en: string; question_hi: string },
  options: QuestionOption[],
  language: AppLanguage = 'en'
): Promise<VoiceMatchResult> {
  if (!transcript || !transcript.trim() || !options || options.length === 0) {
    return { matchedIds: [] };
  }

  try {
    const response = await fetch('/api/match-voice-options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: transcript.trim(),
        question: {
          id: question.id,
          question_en: question.question_en,
          question_hi: question.question_hi,
        },
        options: options.map((opt) => ({
          id: opt.id,
          text_en: opt.text_en,
          text_hi: opt.text_hi,
          symptom_detail: opt.symptom_detail,
          red_flag: opt.red_flag,
          red_flag_reason: opt.red_flag_reason,
        })),
        language,
      }),
    });

    if (response.ok) {
      const data: VoiceMatchResult = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('Network error when matching voice to options via Gemini, falling back to local:', err);
  }

  // Client-side heuristic fallback
  const lower = transcript.toLowerCase();
  const matchedIds: string[] = [];

  for (const opt of options) {
    const en = (opt.text_en || '').toLowerCase();
    const hi = (opt.text_hi || '').toLowerCase();
    const idClean = (opt.id || '').toLowerCase().replace(/_/g, ' ');

    if (
      lower.includes(en) ||
      lower.includes(hi) ||
      en.includes(lower) ||
      lower.includes(idClean)
    ) {
      matchedIds.push(opt.id);
      continue;
    }

    const words = lower.split(/\s+/).filter((w) => w.length > 3);
    const matches = words.filter((w) => en.includes(w) || hi.includes(w) || idClean.includes(w));
    if (matches.length >= 2 || (words.length === 1 && matches.length === 1)) {
      matchedIds.push(opt.id);
    }
  }

  return {
    matchedIds,
    confidence: 0.75,
    explanation: 'Local heuristic fallback match',
    source: 'local-fallback',
  };
}
