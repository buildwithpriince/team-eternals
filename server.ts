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
