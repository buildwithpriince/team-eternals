import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Lazy or safe initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// In-memory cache for synthesized voice prompts to guarantee fast response
const audioCache = new Map<string, { audioBase64: string; mimeType: string }>();
let ttsRateLimitCooldownUntil = 0;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Swasthya AI Backend' });
  });

  // Gemini Native TTS Endpoint
  // Default Model: gemini-2.5-flash-tts (fallback to gemini-3.1-flash-tts-preview)
  // Default Voice: Despina
  // Style Instruction: "Say gently and warmly, like a caring mid-age nurse reassuring a patient:"
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, language = 'en', voice = 'Despina' } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text prompt is required for TTS' });
        return;
      }

      const cleanText = text.trim();
      const styleInstruction =
        language === 'en'
          ? 'Speak in a gentle, warm, polite, and reassuring Indian feminine voice with an authentic Indian English accent, like a caring Indian female hospital nurse assisting a patient:'
          : 'Speak gently, clearly, and warmly in natural Hindi with a caring, respectful feminine voice, like a compassionate female hospital nurse assisting a patient:';
      const prompt = `${styleInstruction} ${cleanText}`;
      const cacheKey = `${voice}:${language}:${cleanText}`;

      if (audioCache.has(cacheKey)) {
        const cached = audioCache.get(cacheKey)!;
        res.json(cached);
        return;
      }

      const ai = getAI();
      if (!ai) {
        res.json({
          fallback: true,
          error: 'GEMINI_API_KEY is not configured on the server',
        });
        return;
      }

      // If in cooldown from recent 429 rate limits, skip remote call and use silent client fallback
      if (Date.now() < ttsRateLimitCooldownUntil) {
        res.json({
          fallback: true,
          error: 'Rate limit active, using browser voice fallback',
        });
        return;
      }

      const modelsToTry = [
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-pro-preview-tts',
        'gemini-3.1-flash-tts-preview',
      ];
      let response = null;
      let lastError: unknown = null;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voice,
                  },
                },
              },
            },
          });
          if (response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
            break;
          }
        } catch (mErr: unknown) {
          lastError = mErr;
          const errMsg = mErr instanceof Error ? mErr.message : String(mErr);
          if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
            // Set a 60s cooldown before retrying cloud TTS to smoothly use client fallback
            ttsRateLimitCooldownUntil = Date.now() + 60000;
            break;
          }
        }
      }

      const audioBase64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const mimeType = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/pcm;rate=24000';

      if (!audioBase64) {
        res.json({
          fallback: true,
          message: 'Client speech synthesis fallback active',
        });
        return;
      }

      const result = { audioBase64, mimeType };
      // Limit server memory cache size to 150 entries
      if (audioCache.size > 150) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) audioCache.delete(firstKey);
      }
      audioCache.set(cacheKey, result);

      res.json(result);
    } catch {
      res.json({
        fallback: true,
        message: 'Client speech synthesis fallback active',
      });
    }
  });

  // Gemini Voice Option Matcher Endpoint (gemini-2.5-flash)
  // Maps a patient's spoken transcript (Hindi/English/Hinglish) to matching question option IDs
  app.post('/api/match-voice-options', async (req, res) => {
    try {
      const { transcript, question, options = [], language = 'en' } = req.body;

      if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
        res.status(400).json({ error: 'Valid transcript is required', matchedIds: [] });
        return;
      }

      if (!options || !Array.isArray(options) || options.length === 0) {
        res.json({ matchedIds: [], explanation: 'No options provided' });
        return;
      }

      const cleanTranscript = transcript.trim();
      const ai = getAI();

      // Options summary for the prompt
      const optionsFormatted = options.map((opt: any) => ({
        id: opt.id,
        text_en: opt.text_en,
        text_hi: opt.text_hi,
        symptom_detail: opt.symptom_detail || '',
        red_flag: !!opt.red_flag,
      }));

      const questionText = question
        ? `Question: "${question.question_en || ''}" / "${question.question_hi || ''}"`
        : '';

      const prompt = `
${questionText}
Patient's Spoken Voice Transcript: "${cleanTranscript}"
Spoken Language Context: ${language === 'hi' ? 'Hindi / Hinglish' : 'English / Hinglish'}

Available Options:
${JSON.stringify(optionsFormatted, null, 2)}

Instructions:
1. Determine which option ID(s) from the "Available Options" list directly match what the patient said.
2. If the patient described multiple symptoms or conditions (e.g. "I have diabetes and high BP"), return ALL corresponding option IDs in the "matchedIds" array.
3. If the transcript clearly selects or answers with one option (even with casual slang, colloquial terms, Hindi words, or descriptive phrasing like "very severe on left side"), return that option's ID.
4. If nothing in the transcript matches any available option, return ["none"] in matchedIds.
`;

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              systemInstruction:
                'You are an expert bilingual clinical AI triage assistant in an Indian hospital OPD. Your task is to match spoken patient transcripts (in Hindi, English, Hinglish, or regional dialects) to the exact option IDs from a predefined clinical questionnaire. Return only valid option IDs from the provided list, or ["none"] if nothing matches. When multiple symptoms are described, return all matching IDs.',
              responseMimeType: 'application/json',
            },
          });

          const rawText = response?.text?.trim() || '';
          if (rawText) {
            try {
              const parsed = JSON.parse(rawText);
              let matchedIds: string[] = [];

              if (Array.isArray(parsed.matchedIds)) {
                matchedIds = parsed.matchedIds;
              } else if (typeof parsed.matchedIds === 'string') {
                matchedIds = [parsed.matchedIds];
              } else if (Array.isArray(parsed.matched_ids)) {
                matchedIds = parsed.matched_ids;
              } else if (typeof parsed.id === 'string') {
                matchedIds = [parsed.id];
              }

              // Filter out "none" or invalid IDs that aren't in options
              const validOptionIds = new Set(options.map((o: any) => o.id));
              const finalMatched = matchedIds.filter(
                (id) => id && id.toLowerCase() !== 'none' && validOptionIds.has(id)
              );

              res.json({
                matchedIds: finalMatched,
                confidence: parsed.confidence || 0.95,
                explanation: parsed.explanation || 'Matched via Gemini 2.5 Flash',
                source: 'gemini-2.5-flash',
              });
              return;
            } catch {
              // JSON parse error, proceed to fallback
            }
          }
        } catch (genErr) {
          console.warn('Gemini option matching error, running fallback matcher:', genErr);
        }
      }

      // High-accuracy heuristic & token matching fallback if Gemini is offline or rate-limited
      const lower = cleanTranscript.toLowerCase();
      const matchedIds: string[] = [];

      for (const opt of options) {
        const enLower = (opt.text_en || '').toLowerCase();
        const hiLower = (opt.text_hi || '').toLowerCase();
        const idLower = (opt.id || '').toLowerCase().replace(/_/g, ' ');

        // Direct token or phrase inclusion
        if (
          lower.includes(enLower) ||
          lower.includes(hiLower) ||
          enLower.includes(lower) ||
          lower.includes(idLower)
        ) {
          matchedIds.push(opt.id);
          continue;
        }

        // Word-level matching
        const words = lower.split(/\s+/).filter((w: string) => w.length > 3);
        const matchCount = words.filter(
          (w: string) => enLower.includes(w) || hiLower.includes(w) || idLower.includes(w)
        ).length;

        if (matchCount >= 2 || (words.length === 1 && matchCount === 1)) {
          matchedIds.push(opt.id);
        }
      }

      res.json({
        matchedIds: matchedIds.length > 0 ? matchedIds : [],
        confidence: 0.8,
        explanation: 'Matched via local heuristic engine',
        source: 'local-heuristic',
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error in option matcher', matchedIds: [] });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Swasthya AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
