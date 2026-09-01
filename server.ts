import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import { matchSemanticsLocally } from './src/utils/aiMatcher';

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
let matcherRateLimitCooldownUntil = 0;

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

  // Ultra-Fast Gemini Voice Option Matcher Endpoint (gemini-3.7-flash / gemini-3.6-flash)
  // Semantically maps spoken patient voice transcripts (Hindi/English/Hinglish) to the most precise option IDs,
  // including duration ranges (e.g. "5 months" -> "> 1 to 3 months"), severity, synonyms, and colloquial terms.
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

      // Formatted options list with English and Hindi texts for semantic inference
      const compactOptions = options.map((opt: any) => ({
        id: opt.id,
        en: opt.text_en,
        hi: opt.text_hi,
        detail: opt.symptom_detail || undefined,
        red_flag: !!opt.red_flag,
      }));

      const prompt = `Patient Spoken Voice Input: "${cleanTranscript}"
Question Context: "${question?.question_en || ''}" / "${question?.question_hi || ''}"
Available Options:
${JSON.stringify(compactOptions, null, 2)}

TASK:
Identify the single most precise and clinically accurate option ID(s) from "Available Options" that represents the patient's intent.

CRITICAL REASONING RULES:
1. SEMANTIC & NEAREST-OPTION MATCHING:
   - Match even when exact words differ. Interpret the underlying clinical meaning, severity, timeline, and intent.
2. DURATION / TIME RANGE CONVERSIONS:
   - Convert spoken numbers and units (days, weeks, months, years) to the matching range bucket:
     * "5 months", "6 months", "1 year", "2 years", "since last year", "paanch mahine", "kaafi time se" -> Match the chronic / longest duration option (e.g. "More than 1 to 3 months / Long term").
     * "2 weeks", "3 weeks", "20 days", "do hafte", "half a month" -> Match the 1 to 4 weeks option.
     * "3 days", "4 days", "5 days", "char din", "past week", "pichle hafte" -> Match the 2 to 7 days option.
     * "today", "since morning", "few hours", "aaj subah", "kal raat se" -> Match the < 24 hours / today option.
3. SEVERITY & PAIN SCALES:
   - "unbearable", "killing me", "bahut zyada", "cannot sleep/stand", "10/10", "extreme" -> Severe / Unbearable option.
   - "mild", "thoda sa", "manageable", "tolerable", "1-3/10" -> Mild option.
   - "moderate", "medium", "disturbing routine", "madhyam" -> Moderate option.
   - "comes and goes", "waves", "kabhi kabhi", "beech beech me" -> Intermittent option.
4. BILINGUAL & COLLOQUIAL MAPPING:
   - Hindi/Hinglish phrases like "chakkar", "gas/jalan", "dam ghutna", "gathiya", "badan dard", "sugar/bp checkup", "bidi/tambaku", "sharab", "stent/heart attack" must be accurately routed to their corresponding option ID.
5. NEGATIONS & AFFIRMATIONS:
   - "nahi", "no", "never", "kuch nahi", "none", "bilkul nahi", "sab theek" -> Select the negative / "None" option.
   - "haan", "yes", "bilkul", "true" -> Select the affirmative / "Yes" option.

Return ONLY a JSON object:
{"matchedIds": ["<valid_option_id>"], "explanation": "<short reason>", "confidence": 0.95}`;

      if (ai && Date.now() >= matcherRateLimitCooldownUntil) {
        // Supported models for fast bilingual semantic classification
        const fastModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

        for (const modelName of fastModels) {
          try {
            const config: any = {
              temperature: 0,
              maxOutputTokens: 150,
              systemInstruction:
                'You are a high-speed bilingual clinical triage matcher in an Indian hospital OPD. Convert natural spoken language (including numbers, durations like "5 months", pain scales, Hindi/Hinglish expressions, and negations) to the single most precise option ID from the given list. Output JSON with {"matchedIds": string[]}.',
              responseMimeType: 'application/json',
            };

            // Set thinkingLevel only for Gemini 3 series models
            if (modelName.startsWith('gemini-3')) {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
            }

            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config,
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

                // Filter out "none" string if it's not a real option ID, or match valid IDs
                const validOptionIds = new Set(options.map((o: any) => o.id));
                const finalMatched = matchedIds.filter(
                  (id) => id && (validOptionIds.has(id) || (id.toLowerCase() !== 'none' && validOptionIds.has(id)))
                );

                if (finalMatched.length > 0) {
                  res.json({
                    matchedIds: finalMatched,
                    confidence: parsed.confidence || 0.98,
                    explanation: parsed.explanation || `Matched via ${modelName}`,
                    source: modelName,
                  });
                  return;
                }
              } catch {
                // Parse error, fallback to next
              }
            }
          } catch (genErr: any) {
            const errMsg = genErr?.message || String(genErr);
            if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
              // Upstream model spike or rate limit encountered; back off briefly and use instant local semantic engine
              matcherRateLimitCooldownUntil = Date.now() + 30000;
              break;
            }
          }
        }
      }

      // High-accuracy semantic duration & clinical heuristic fallback
      const fallbackResult = matchSemanticsLocally(cleanTranscript, options);
      res.json({
        matchedIds: fallbackResult.matchedIds,
        confidence: fallbackResult.confidence,
        explanation: fallbackResult.explanation,
        source: 'local-semantic-heuristic',
      });
    } catch (err) {
      console.error('Match voice options error:', err);
      res.status(500).json({ error: 'Internal matching error', matchedIds: [] });
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
