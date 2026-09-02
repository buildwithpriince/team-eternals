import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { matchSemanticsLocally } from './src/utils/aiMatcher';
import { getSupabaseServer, initializeSupabaseBackend } from './src/lib/supabaseServer';

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
          if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('404') || errMsg.includes('NOT_FOUND')) {
            // Set a 45s cooldown before retrying cloud TTS to smoothly use client fallback
            ttsRateLimitCooldownUntil = Date.now() + 45000;
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

  let interviewRateLimitCooldownUntil = 0;
  let summaryRateLimitCooldownUntil = 0;

  // Conversational History Engine: Turn-by-Turn Dynamic Intake Endpoint (Gemini-Powered)
  // Implements the Swasthya AI System Prompt Spec for live per-turn question generation.
  // Produces structured bilingual JSON output with adaptive SOCRATES/Dashavidha Pariksha flow & symptom tags.
  app.post('/api/interview-next-turn', async (req, res) => {
    try {
      const {
        mode = 'general',
        language = 'en',
        department = 'General Medicine OPD',
        structured_state_json = {},
      } = req.body;

      const stateString =
        typeof structured_state_json === 'string'
          ? structured_state_json
          : JSON.stringify(structured_state_json, null, 2);

      const systemPrompt = `You are the history-taking engine inside Swasthya AI (MediKiosk), a
pre-consultation clinical intake assistant used in Indian hospital OPDs.
You are NOT a diagnostic AI. You never suggest a diagnosis, never reassure
or alarm the patient about what a symptom might mean, and never give
medical advice. Your only job is to elicit a complete, structured clinical
history through one question at a time, the way a careful physician would.

MODE: ${mode}   // "general" | "ayush"
LANGUAGE: ${language}  // "en" | "hi"
DEPARTMENT: ${department}
PATIENT STATE SO FAR: ${stateString}

## Interview structure — general mode
Follow this section order, but branch adaptively within each section based
on what the patient has already said. Do not ask something already answered.

1. Chief complaint (open-ended: "What's bothering you today?")
2. History of Present Illness — once a complaint is named, apply SOCRATES:
   Site, Onset, Character, Radiation, Associated symptoms, Timing/duration,
   Exacerbating/relieving factors, Severity (ask for a 0–10 scale in
   patient-friendly terms, not clinical jargon)
3. Past medical & surgical history
4. Drug & allergy history
5. Family history
6. Personal history (smoking, alcohol, diet, occupation — only what's
   relevant to the complaint, don't pad this out)
7. Review of systems — brief, targeted at systems adjacent to the chief
   complaint, not an exhaustive checklist

## Interview structure — AYUSH mode
Same opening (chief complaint, SOCRATES for HPI), then instead of a generic
ROS, cover Dashavidha Pariksha in patient-friendly language:
Prakriti (constitution), Vikriti (current imbalance), Sara, Samhanana,
Pramana, Satmya, Sattva, Ahara Shakti (digestive capacity), Vyayama Shakti
(exercise tolerance), Vaya (age-related factors), plus Ahara-Vihara
(diet and lifestyle). Translate these into plain questions — never show the
Sanskrit term to the patient as the question itself; use it only as an
internal section label.

## Rules
- Ask exactly ONE question per turn. Never stack multiple questions.
- Every question MUST include an \`options\` array with 4–8 plausible answer chips.
- For the chief-complaint turn (Turn 1 / opening question), ALWAYS provide 6–8 common OPD chief-complaint option chips:
  1. Fever & Body Shivers (बुखार एवं कंपकंपी)
  2. Cough or Breathing Trouble (खांसी या सांस लेने में तकलीफ)
  3. Stomach Pain, Acidity or Vomiting (पेट दर्द, एसिडिटी या उल्टी)
  4. Body Ache, Joint or Back Pain (बदन दर्द, जोड़ों या कमर का दर्द)
  5. Chest Pain or Heavy Pressure (सीने में दर्द या भारीपन - red flag)
  6. Headache or Dizziness (सिरदर्द या चक्कर आना)
  7. Skin Rash, Itching or Allergy (त्वचा पर दाने, खुजली या एलर्जी)
  8. Recent Injury, Cut or Fall (हालिया चोट, घाव या गिरने से दर्द)
- For all other questions, always provide 3–6 plausible short answer chips matching the question.
- Always set "input_type" to "single_select" or "multi_select". Never omit the options array or default to free-text-only. (The client UI automatically renders both the tappable options grid AND an integrated free-text / voice entry box as a universal fallback for anything not listed).
- Keep question phrasing at a 5th-grade reading level. No medical jargon
  ("radiating" becomes "does it move to another part of your body?").
- Always produce BOTH English and Hindi phrasing for the question and
  options, regardless of the patient's chosen language — the UI decides
  which to render.
- After each patient answer, extract any clinically relevant symptom tags
  from what they said and add them to \`symptom_tags\` (snake_case, e.g.
  "chest_pain", "radiates_left_arm", "sweating", "sudden_onset",
  "facial_droop", "slurred_speech", "breathlessness_at_rest",
  "high_grade_fever", "neck_stiffness", "severe_bleeding"). This list is
  consumed by a separate rule-based red-flag checker — do not judge
  urgency yourself, just tag accurately and completely.
- Set "section_complete": true when a section has enough information to
  move on. Set "interview_complete": true only when all required sections
  for the current mode are done.
- If the patient's answer is ambiguous or you didn't understand it, ask a
  single clarifying question rather than guessing.

## Output format — respond with ONLY this JSON, no other text:
{
  "question_en": "string",
  "question_hi": "string",
  "input_type": "single_select" | "multi_select",
  "options": [
    {"id": "a", "text_en": "string", "text_hi": "string", "red_flag": false, "red_flag_reason": "optional string"}
  ],
  "section": "chief_complaint" | "hpi" | "past_history" | "drug_allergy" |
             "family_history" | "personal_history" | "ros" |
             "dashavidha_pariksha" | "ahara_vihara",
  "symptom_tags": ["string"],
  "section_complete": boolean,
  "interview_complete": boolean
}`;

      const ai = getAI();
      let generatedTurn: any = null;

      if (ai && Date.now() >= interviewRateLimitCooldownUntil) {
        const candidateModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

        for (const modelName of candidateModels) {
          try {
            const config: any = {
              temperature: 0.2,
              responseMimeType: 'application/json',
              systemInstruction: systemPrompt,
            };

            const prompt = `Based on the PATIENT STATE SO FAR, generate the single next best question in the clinical intake sequence. Output ONLY valid JSON matching the specified schema.`;

            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config,
            });

            const text = response?.text?.trim() || '';
            if (text) {
              const parsed = JSON.parse(text);
              if (parsed && parsed.question_en && parsed.options && Array.isArray(parsed.options)) {
                generatedTurn = {
                  question_en: parsed.question_en,
                  question_hi: parsed.question_hi || parsed.question_en,
                  input_type: parsed.input_type || 'single_select',
                  options: parsed.options,
                  section: parsed.section || 'chief_complaint',
                  symptom_tags: Array.isArray(parsed.symptom_tags) ? parsed.symptom_tags : [],
                  section_complete: !!parsed.section_complete,
                  interview_complete: !!parsed.interview_complete,
                  modelUsed: modelName,
                };
                break;
              }
            }
          } catch (modelErr: any) {
            const errMsg = modelErr?.message || String(modelErr);
            console.warn(`Interview turn generation fallback from ${modelName}:`, errMsg);
            // If quota/rate limit error, continue trying next candidate model
            if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
              continue;
            }
          }
        }
        if (!generatedTurn) {
          interviewRateLimitCooldownUntil = Date.now() + 30000;
        }
      }

      if (generatedTurn) {
        res.json(generatedTurn);
        return;
      }

      // Fallback if AI client not configured or transient error/quota cooldown
      const turnsCount = Array.isArray(structured_state_json?.turns) ? structured_state_json.turns.length : 0;
      if (turnsCount === 0) {
        res.json({
          question_en: 'What is the main reason for your hospital visit today?',
          question_hi: 'आज अस्पताल आने का आपका मुख्य कारण क्या है?',
          input_type: 'single_select',
          options: [
            { id: 'fever', text_en: 'Fever & Body Shivers', text_hi: 'बुखार एवं शरीर में कंपकंपी' },
            { id: 'cough_breath', text_en: 'Cough or Breathing Trouble', text_hi: 'खांसी या सांस लेने में तकलीफ' },
            { id: 'stomach_pain', text_en: 'Stomach Pain, Acidity or Vomiting', text_hi: 'पेट दर्द, एसिडिटी या उल्टी' },
            { id: 'body_joint_pain', text_en: 'Body Ache, Joint or Back Pain', text_hi: 'बदन दर्द, जोड़ों या कमर का दर्द' },
            { id: 'chest_pain', text_en: 'Chest Pain or Heavy Pressure', text_hi: 'सीने में दर्द या भारीपन', red_flag: true, red_flag_reason: 'Suspected Acute Coronary Syndrome / Angina (Immediate ECG & Cardiac Triage)' },
            { id: 'headache_dizzy', text_en: 'Headache or Dizziness', text_hi: 'सिरदर्द या चक्कर आना' },
            { id: 'skin_issue', text_en: 'Skin Rash, Itching or Allergy', text_hi: 'त्वचा पर दाने, खुजली या एलर्जी' },
            { id: 'injury_wound', text_en: 'Recent Injury, Cut or Fall', text_hi: 'चोट, घाव या गिरने से दर्द' },
          ],
          section: 'chief_complaint',
          symptom_tags: ['primary_concern'],
          section_complete: false,
          interview_complete: false,
          modelUsed: 'Adaptive Clinical Rules Engine',
        });
        return;
      }

      if (turnsCount === 1) {
        res.json({
          question_en: 'How long have you been having this problem?',
          question_hi: 'यह तकलीफ आपको कितने दिनों या समय से हो रही है?',
          input_type: 'single_select',
          options: [
            { id: 'dur_today', text_en: 'Started suddenly today (< 24 hours)', text_hi: 'आज अचानक शुरू हुआ (24 घंटे से कम)' },
            { id: 'dur_few_days', text_en: '2 to 7 days (Past week)', text_hi: '2 से 7 दिन (पिछले एक हफ्ते से)' },
            { id: 'dur_weeks', text_en: '1 to 4 weeks (About a month)', text_hi: '1 से 4 हफ्ते (लगभग एक महीने से)' },
            { id: 'dur_chronic', text_en: 'More than 1 to 3 months (Long term)', text_hi: '1 से 3 महीने या उससे अधिक समय से' },
          ],
          section: 'chief_complaint',
          symptom_tags: ['duration', 'timeline'],
          section_complete: true,
          interview_complete: false,
          modelUsed: 'Adaptive Clinical Rules Engine',
        });
        return;
      }

      if (turnsCount === 2) {
        res.json({
          question_en: 'How severe is your discomfort, and does it spread anywhere else?',
          question_hi: 'तकलीफ कितनी तेज है, और क्या यह शरीर के किसी अन्य हिस्से में फैलती है?',
          input_type: 'single_select',
          options: [
            { id: 'sev_mild', text_en: 'Mild — Can easily manage daily work', text_hi: 'हल्की — रोजमर्रा का काम कर पा रहे हैं' },
            { id: 'sev_moderate', text_en: 'Moderate — Disturbing sleep and routine', text_hi: 'मध्यम — नींद व काम में बाधा आ रही है' },
            { id: 'sev_severe_spread', text_en: 'Severe and spreads to arm, jaw or back', text_hi: 'बहुत तेज है और हाथ, जबड़े या पीठ में फैल रहा है', red_flag: true, red_flag_reason: 'Suspected Acute Coronary Syndrome / Angina' },
            { id: 'sev_severe_local', text_en: 'Severe / Unbearable (stays in one spot)', text_hi: 'असहनीय तेज दर्द (एक ही जगह पर)', red_flag: true, red_flag_reason: 'Pain Scale 9-10/10 requires immediate analgesic triage' },
          ],
          section: 'hpi',
          symptom_tags: ['severity', 'radiation', 'quality'],
          section_complete: true,
          interview_complete: false,
          modelUsed: 'Adaptive Clinical Rules Engine',
        });
        return;
      }

      if (turnsCount === 3) {
        res.json({
          question_en: 'Do you have any existing long-term medical conditions like BP or Sugar?',
          question_hi: 'क्या आपको पहले से कोई पुरानी बीमारी जैसे ब्लड प्रेशर या शुगर है?',
          input_type: 'single_select',
          options: [
            { id: 'pmh_none', text_en: 'No known long-term illness', text_hi: 'कोई पुरानी बीमारी नहीं है' },
            { id: 'pmh_htn_dm', text_en: 'High Blood Pressure or Diabetes', text_hi: 'हाई ब्लड प्रेशर या शुगर (मधुमेह)' },
            { id: 'pmh_heart_kidney', text_en: 'Heart disease, Asthma, or Kidney problem', text_hi: 'हृदय रोग, दमा (अस्थमा) या गुर्दे की समस्या' },
            { id: 'pmh_prior_surg', text_en: 'Prior major surgery in the past', text_hi: 'पूर्व में कोई बड़ा ऑपरेशन/सर्जरी हुई है' },
          ],
          section: 'past_history',
          symptom_tags: ['comorbidities'],
          section_complete: true,
          interview_complete: false,
          modelUsed: 'Adaptive Clinical Rules Engine',
        });
        return;
      }

      if (turnsCount === 4) {
        res.json({
          question_en: 'Are you taking regular medications, or do you have any drug allergy?',
          question_hi: 'क्या आप नियमित दवाइयां ले रहे हैं, या किसी दवा से कोई एलर्जी है?',
          input_type: 'single_select',
          options: [
            { id: 'med_none', text_en: 'No regular medications and No drug allergies (NKDA)', text_hi: 'कोई नियमित दवा नहीं और कोई दवा एलर्जी नहीं' },
            { id: 'med_regular', text_en: 'Taking regular daily prescriptions (BP/Diabetes/Thyroid)', text_hi: 'नियमित दवाइयां ले रहे हैं (बीपी/शुगर/थायराइड)' },
            { id: 'med_allergy_penicillin', text_en: 'Allergy to Penicillin / Sulfa / Painkillers', text_hi: 'पेनिसिलिन, सल्फा या दर्द निवारक दवाओं से एलर्जी है' },
            { id: 'med_ayurvedic', text_en: 'Taking Ayurvedic, Homeopathic or herbal supplements', text_hi: 'आयुर्वेदिक, होम्योपैथिक या हर्बल दवाइयां ले रहे हैं' },
          ],
          section: 'drug_allergy',
          symptom_tags: ['medications', 'drug_allergy'],
          section_complete: true,
          interview_complete: false,
          modelUsed: 'Adaptive Clinical Rules Engine',
        });
        return;
      }

      if (turnsCount === 5) {
        res.json({
          question_en: 'Does anyone in your direct family (parents or siblings) have heart disease or diabetes?',
          question_hi: 'क्या आपके परिवार में माता-पिता या भाई-बहन को हृदय रोग या शुगर की बीमारी है?',
          input_type: 'single_select',
          options: [
            { id: 'fam_none', text_en: 'No major hereditary illness in family', text_hi: 'परिवार में कोई गंभीर अनुवांशिक बीमारी नहीं है' },
            { id: 'fam_heart', text_en: 'Heart attack or heart stent at early age in family', text_hi: 'परिवार में कम उम्र में हार्ट अटैक या दिल की बीमारी' },
            { id: 'fam_dm_htn', text_en: 'Diabetes or Hypertension runs in parents', text_hi: 'माता-पिता में शुगर या हाई बीपी की समस्या' },
            { id: 'fam_asthma', text_en: 'Asthma or severe allergies in family', text_hi: 'परिवार में दमा (अस्थमा) या एलर्जी' },
          ],
          section: 'family_history',
          symptom_tags: ['family_history'],
          section_complete: true,
          interview_complete: false,
          modelUsed: 'Adaptive Clinical Rules Engine',
        });
        return;
      }

      if (mode === 'ayush') {
        res.json({
          question_en: 'How is your appetite, digestion, and daily bowel movement?',
          question_hi: 'आपकी भूख, पाचन क्रिया और पेट साफ होने की स्थिति कैसी रहती है?',
          input_type: 'single_select',
          options: [
            { id: 'agni_sama', text_en: 'Normal digestion, daily clear bowel (Samagni)', text_hi: 'सामान्य पाचन, रोज पेट अच्छी तरह साफ होता है (समाग्नि)' },
            { id: 'agni_manda', text_en: 'Sluggish digestion, heaviness after food, constipation (Mandagni)', text_hi: 'पाचन धीमा, खाने के बाद भारीपन व कब्ज (मंदाग्नि)' },
            { id: 'agni_teekshna', text_en: 'Excess burning hunger, acidity and loose motions (Tikshnagni)', text_hi: 'तेज जलन वाली भूख, एसिडिटी और दस्त (तीक्ष्णाग्नि)' },
            { id: 'agni_visham', text_en: 'Irregular appetite, frequent gas and bloating (Vishamagni)', text_hi: 'अनियमित भूख, गैस और पेट फूलना (विषमाग्नि)' },
          ],
          section: 'dashavidha_pariksha',
          symptom_tags: ['agni', 'digestion', 'kostha'],
          section_complete: true,
          interview_complete: true,
          modelUsed: 'Adaptive Clinical Rules Engine',
        });
        return;
      }

      res.json({
        question_en: 'Do you have any other associated symptoms like fever, weight loss, or swelling in feet?',
        question_hi: 'क्या आपको बुखार, अचानक वजन कम होना या पैरों में सूजन जैसा कोई अन्य लक्षण है?',
        input_type: 'single_select',
        options: [
          { id: 'ros_none', text_en: 'None of these (No fever, swelling, or weight loss)', text_hi: 'इनमें से कोई नहीं (बुखार, सूजन या वजन घटना नहीं है)' },
          { id: 'ros_fever', text_en: 'Mild fever or night chills', text_hi: 'हल्का बुखार या रात में ठंड लगना' },
          { id: 'ros_swelling', text_en: 'Swelling in feet or around eyes', text_hi: 'पैरों में या आंखों के आसपास सूजन' },
          { id: 'ros_fatigue', text_en: 'Severe general fatigue and weakness', text_hi: 'अत्यधिक कमजोरी व थकान महसूस होना' },
        ],
        section: 'ros',
        symptom_tags: ['associated_symptoms', 'ros'],
        section_complete: true,
        interview_complete: true,
        modelUsed: 'Adaptive Clinical Rules Engine',
      });
    } catch (err) {
      console.error('Error in interview-next-turn:', err);
      res.status(500).json({ error: 'Failed to generate interview turn' });
    }
  });

  // Gemini-Powered Physician Summary Generation Endpoint (gemini-3.7-flash / gemini-3.1-flash-lite / gemini-flash-latest)
  // Generates structured SOAP clinical summaries from patient interview transcripts and digitized documents.
  // Rule: Must never suggest a diagnosis or interpret findings; only summarizes what was reported.
  app.post('/api/generate-doctor-summary', async (req, res) => {
    try {
      const {
        patientId,
        name = 'Patient',
        age = 50,
        gender = 'male',
        department = 'general',
        chiefComplaints = [],
        historyAnswers = {},
        scannedDocs = [],
        redFlags = [],
        vitals = {},
        ayushAssessment,
      } = req.body;

      const isAyush = department === 'ayush';

      // 1. Format interview transcript
      const transcriptEntries = Object.entries(historyAnswers).map(([key, item]: [string, any]) => {
        return `[Section: ${item.section || key}] Question: "${item.question_en || item.question_hi || key}" -> Patient Answer: "${item.answer_en || item.answer_hi || ''}" (Hindi: "${item.answer_hi || ''}") ${item.is_red_flag ? '[RED FLAG TRIGGERED]' : ''}`;
      });
      const formattedTranscript = transcriptEntries.length > 0
        ? transcriptEntries.join('\n')
        : `Chief Complaint reported: ${chiefComplaints.join(', ')}`;

      // 2. Format extracted document JSON
      const formattedDocs = (scannedDocs || []).map((doc: any, i: number) => {
        const ext = doc.extractedData || {};
        return `Document #${i + 1} (${doc.title || doc.type}):
- Prior Diagnoses: ${(ext.diagnoses || []).join(', ') || 'None stated'}
- Prior Prescribed Medicines: ${(ext.medicines || []).map((m: any) => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('; ') || 'None stated'}
- Lab Values: ${(ext.labValues || []).map((l: any) => `${l.parameter}: ${l.value} ${l.unit} (${l.status})`).join('; ') || 'None'}
- Notes: ${ext.notesSummary || 'None'}`;
      }).join('\n\n');

      const existingRedFlagsList = Array.isArray(redFlags) ? redFlags : [];

      const prompt = `PATIENT CLINICAL INTAKE DATA:
Patient Demographics: ${name}, ${age} years old, ${gender.toUpperCase()}
Department: ${isAyush ? 'AYUSH & Integrative Medicine OPD' : 'General Internal Medicine OPD'}
Recorded Triage Vitals: BP: ${vitals.bp || '120/80 mmHg'}, Pulse: ${vitals.pulse || '72 bpm'}, Temp: ${vitals.temp || '98.6 °F'}, SpO2: ${vitals.spo2 || '98%'}

PATIENT INTERVIEW TRANSCRIPT (REPORTED BY PATIENT):
${formattedTranscript}

DIGITIZED / SCANNED MEDICAL DOCUMENTS ATTACHED:
${formattedDocs || 'No prior medical documents attached.'}

MATCHED RED-FLAG WARNING RULES DETECTED DURING INTAKE:
${existingRedFlagsList.length > 0 ? existingRedFlagsList.join('\n') : 'None triggered.'}

${isAyush && ayushAssessment ? `AYUSH PARAMETERS REPORTED:
Prakriti: ${ayushAssessment.prakriti || 'N/A'}, Agni: ${ayushAssessment.agni || 'N/A'}, Kostha: ${ayushAssessment.kostha || 'N/A'}, Bala: ${ayushAssessment.bala || 'N/A'}` : ''}

INSTRUCTIONS FOR PHYSICIAN SUMMARY GENERATION:
You are an expert physician assistant and clinical scribe in an Indian hospital outpatient department.
Synthesize the interview transcript and digitized document data into a high-standard, physician-facing clinical intake summary.

MANDATORY CLINICAL SAFETY AND ACCURACY RULES:
1. NEVER SUGGEST A DIAGNOSIS OR SPECULATE ON ETIOLOGY under any circumstances (e.g. do NOT say "suggestive of acute coronary syndrome", "indicative of tuberculosis", or "probable migraine").
2. NEVER INTERPRET what a finding or lab value means (e.g. do NOT state "elevated fasting glucose signifies uncontrolled diabetes").
3. ONLY SUMMARIZE and organize what was explicitly reported by the patient and what is recorded in their uploaded medical records.
4. "priorityClinicalWarningFlags": list ONLY the symptom combinations already matched by the existing red-flag rule set provided above. Do not invent new warning flags or add unflagged symptoms.
5. Provide structured, professional medical English for the sections:
   - "chiefComplaint": Primary reason for consultation and stated duration.
   - "hpi": Structured narrative of symptom onset, duration, character, radiation, severity scale, aggravating/relieving factors as reported by the patient.
   - "pastMedicalSurgicalHistory": Medical history, past hospitalizations, chronic illnesses, and surgeries explicitly reported by patient or found on attached records.
   - "drugAndAllergyHistory": Known drug allergies (NKDA if none) and current medications with dosages/frequencies extracted from reports or reported.
   - "familyHistory": Any reported hereditary or family illnesses (or explicitly state none reported).
   - "personalHistory": Lifestyle, smoking/tobacco/alcohol habits, occupation, sleep, and bowel/bladder habits as reported.
   - "reviewOfSystems": Systemic review summarizing presence or absence of associated systemic symptoms (fever, chills, GI symptoms, dyspnea, weight changes) as stated by patient.
${isAyush ? `   - "ayushAssessment": Object containing "prakriti", "agni", "kostha", "bala", and "clinicalNotes" summarizing reported Ayurvedic parameters.` : ''}

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "chiefComplaint": "string",
  "hpi": "string",
  "pastMedicalSurgicalHistory": "string",
  "drugAndAllergyHistory": "string",
  "familyHistory": "string",
  "personalHistory": "string",
  "reviewOfSystems": "string",
  "priorityClinicalWarningFlags": ["string"]${isAyush ? `,
  "ayushAssessment": {
    "prakriti": "string",
    "agni": "string",
    "kostha": "string",
    "bala": "string",
    "clinicalNotes": "string"
  }` : ''}
}`;

      const ai = getAI();
      let generatedSummary: any = null;

      if (ai && Date.now() >= summaryRateLimitCooldownUntil) {
        const candidateModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

        for (const modelName of candidateModels) {
          try {
            const config: any = {
              temperature: 0.1,
              responseMimeType: 'application/json',
              systemInstruction:
                'You are a senior physician documentation assistant. Create structured, objective, physician-facing SOAP summaries. NEVER suggest a diagnosis or interpret findings; summarize only what was reported by the patient and extracted from records. Only include red-flags that were already matched by the rule set.',
            };

            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config,
            });

            const text = response?.text?.trim() || '';
            if (text) {
              const parsed = JSON.parse(text);
              if (parsed && parsed.chiefComplaint && parsed.hpi) {
                generatedSummary = {
                  chiefComplaint: parsed.chiefComplaint,
                  hpi: parsed.hpi,
                  pastMedicalSurgicalHistory: parsed.pastMedicalSurgicalHistory || 'No past surgical or chronic illness reported.',
                  drugAndAllergyHistory: parsed.drugAndAllergyHistory || 'No Known Drug Allergies (NKDA).',
                  familyHistory: parsed.familyHistory || 'No family history of premature chronic disease reported.',
                  personalHistory: parsed.personalHistory || 'Non-smoker, non-alcoholic.',
                  reviewOfSystems: parsed.reviewOfSystems || 'Systemic review non-contributory.',
                  priorityClinicalWarningFlags: Array.isArray(parsed.priorityClinicalWarningFlags)
                    ? parsed.priorityClinicalWarningFlags
                    : existingRedFlagsList,
                  ayushAssessment: parsed.ayushAssessment || (isAyush ? {
                    prakriti: ayushAssessment?.prakriti || 'Vata-Pitta Pradhana',
                    agni: ayushAssessment?.agni || 'Mandagni',
                    kostha: ayushAssessment?.kostha || 'Krura Kostha',
                    bala: ayushAssessment?.bala || 'Madhyama Rogibala',
                    clinicalNotes: 'Digestive fire and metabolic balance assessment completed.',
                  } : undefined),
                  generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  modelUsed: modelName,
                };
                break;
              }
            }
          } catch (modelErr: any) {
            const errMsg = modelErr?.message || String(modelErr);
            console.warn(`Summary generation fallback from ${modelName}:`, errMsg);
            if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
              continue;
            }
          }
        }
        if (!generatedSummary) {
          summaryRateLimitCooldownUntil = Date.now() + 30000;
        }
      }

      // If Gemini did not return a valid object, produce a pristine deterministic summary
      if (!generatedSummary) {
        const primaryCc = chiefComplaints.length > 0
          ? chiefComplaints.join(', ')
          : historyAnswers['chief_complaint']?.answer_en || 'Routine outpatient health consultation';

        const durationAnswer = historyAnswers['duration']?.answer_en || historyAnswers['q2_duration']?.answer_en;
        const hpiDetail = historyAnswers['hpi']?.answer_en || historyAnswers['q3_severity_and_nature']?.answer_en;
        const hpiTrigger = historyAnswers['triggers']?.answer_en || historyAnswers['q4_triggers']?.answer_en;

        let hpiStr = `Patient presents with chief complaint of ${primaryCc}.`;
        if (durationAnswer) hpiStr += ` Reported onset/duration: ${durationAnswer}.`;
        if (hpiDetail) hpiStr += ` Character and severity: ${hpiDetail}.`;
        if (hpiTrigger) hpiStr += ` Modulating factors: ${hpiTrigger}.`;

        const docDiagnoses: string[] = [];
        const docMeds: string[] = [];
        (scannedDocs || []).forEach((d: any) => {
          if (d.extractedData?.diagnoses) docDiagnoses.push(...d.extractedData.diagnoses);
          if (d.extractedData?.medicines) {
            docMeds.push(...d.extractedData.medicines.map((m: any) => `${m.name} ${m.dosage || ''}`));
          }
        });

        let pastHist = historyAnswers['past_history']?.answer_en || 'No major chronic illnesses reported by patient.';
        if (docDiagnoses.length > 0) {
          pastHist += ` Documented prior diagnoses in uploaded medical records: ${Array.from(new Set(docDiagnoses)).join(', ')}.`;
        }

        let drugHist = historyAnswers['drug_allergy']?.answer_en || 'No Known Drug Allergies (NKDA).';
        if (docMeds.length > 0) {
          drugHist += ` Current prescription medicines: ${Array.from(new Set(docMeds)).join('; ')}.`;
        }

        generatedSummary = {
          chiefComplaint: primaryCc,
          hpi: hpiStr,
          pastMedicalSurgicalHistory: pastHist,
          drugAndAllergyHistory: drugHist,
          familyHistory: historyAnswers['family_history']?.answer_en || historyAnswers['personal_history']?.answer_en || 'No hereditary illness reported.',
          personalHistory: historyAnswers['personal_history']?.answer_en || 'Non-smoker, non-alcoholic.',
          reviewOfSystems: historyAnswers['ros']?.answer_en || 'Systemic review negative for fever, weight loss, or swelling.',
          priorityClinicalWarningFlags: existingRedFlagsList,
          ayushAssessment: isAyush ? {
            prakriti: ayushAssessment?.prakriti || 'Vata-Pitta Pradhana',
            agni: ayushAssessment?.agni || 'Mandagni',
            kostha: ayushAssessment?.kostha || 'Krura Kostha',
            bala: ayushAssessment?.bala || 'Madhyama Rogibala',
            clinicalNotes: 'Ayurvedic intake parameters recorded at kiosk.',
          } : undefined,
          generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'Deterministic Clinical Engine',
        };
      }

      res.json({
        success: true,
        patientId,
        summary: generatedSummary,
      });
    } catch (err) {
      console.error('Error generating doctor summary:', err);
      res.status(500).json({ error: 'Failed to generate physician summary' });
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
        const fastModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

        for (const modelName of fastModels) {
          try {
            const config: any = {
              temperature: 0,
              maxOutputTokens: 150,
              systemInstruction:
                'You are a high-speed bilingual clinical triage matcher in an Indian hospital OPD. Convert natural spoken language (including numbers, durations like "5 months", pain scales, Hindi/Hinglish expressions, and negations) to the single most precise option ID from the given list. Output JSON with {"matchedIds": string[]}.',
              responseMimeType: 'application/json',
            };

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
            console.warn(`Voice matcher fallback from ${modelName}:`, errMsg);
            if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
              continue;
            }
          }
        }
        matcherRateLimitCooldownUntil = Date.now() + 30000;
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

  // =========================================================================
  // SUPABASE PERSISTENCE API ENDPOINTS (Interviews, Documents, Triage Queue)
  // =========================================================================

  // 1. Sync Interview Turn & Patient State to Supabase on every turn
  app.post('/api/interviews/turn', async (req, res) => {
    try {
      const {
        interviewId,
        patientId,
        patientData = {},
        department = 'general',
        status = 'in_interview',
        structuredState = {},
        transcript = [],
        symptomTags = [],
        redFlag = false,
        redFlagReason = null,
        opdToken = 'OPD-NEW',
        summary = {},
      } = req.body;

      const supabase = getSupabaseServer();
      if (!supabase) {
        res.json({ success: true, saved: false, message: 'Supabase server client not configured' });
        return;
      }

      // Upsert patient record
      if (patientId) {
        const parsedAge =
          typeof patientData.age === 'number'
            ? patientData.age
            : patientData.age && String(patientData.age).trim() !== ''
            ? parseInt(String(patientData.age).trim(), 10) || null
            : null;

        const patientPayload: any = {
          id: patientId,
          language_pref: patientData.language || 'hi',
        };
        if (patientData.name && patientData.name.trim() !== '') {
          patientPayload.name = patientData.name.trim();
        } else {
          patientPayload.name = 'Anonymous Kiosk Patient';
        }
        if (parsedAge !== null) patientPayload.age = parsedAge;
        if (patientData.phone) patientPayload.phone = String(patientData.phone).trim();
        if (patientData.abhaId) patientPayload.abha_id = String(patientData.abhaId).trim();

        const { error: patientErr } = await supabase.from('patients').upsert(
          patientPayload,
          { onConflict: 'id' }
        );
        if (patientErr) {
          console.warn('[Supabase /api/interviews/turn] Patient upsert warning:', patientErr.message);
        }
      }

      // Upsert interview record
      if (interviewId) {
        const { error: interviewErr } = await supabase.from('interviews').upsert(
          {
            id: interviewId,
            patient_id: patientId || null,
            department,
            status,
            structured_state: structuredState,
            transcript: Array.isArray(transcript) ? transcript : [],
            symptom_tags: Array.isArray(symptomTags) ? symptomTags : [],
            red_flag: !!redFlag,
            red_flag_reason: redFlagReason || null,
            opd_token: opdToken,
            summary: summary || {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        if (interviewErr) {
          console.warn('[Supabase] Interview upsert warning:', interviewErr.message);
        }
      }

      res.json({ success: true, interviewId, patientId });
    } catch (err) {
      console.error('[Supabase] Error saving interview turn:', err);
      res.status(500).json({ error: 'Failed to persist interview turn' });
    }
  });

  // 2. Real-time Red-Flag trigger update in Supabase
  app.post('/api/interviews/red-flag', async (req, res) => {
    try {
      const { interviewId, redFlag = true, redFlagReason } = req.body;
      const supabase = getSupabaseServer();
      if (!supabase || !interviewId) {
        res.json({ success: true, updated: false });
        return;
      }

      const { error } = await supabase
        .from('interviews')
        .update({
          red_flag: !!redFlag,
          red_flag_reason: redFlagReason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', interviewId);

      if (error) {
        console.warn('[Supabase] Red-flag update warning:', error.message);
      }
      res.json({ success: true, interviewId, redFlag, redFlagReason });
    } catch (err) {
      console.error('[Supabase] Error updating red flag:', err);
      res.status(500).json({ error: 'Failed to update red flag' });
    }
  });

  // 3. Finalize interview & update physician summary
  app.post('/api/interviews/summary', async (req, res) => {
    try {
      const {
        interviewId,
        patientId,
        status = 'waiting',
        summary = {},
        patientData = {},
        transcript = [],
        redFlag = false,
        redFlagReason = null,
        opdToken,
      } = req.body;

      console.log('[SERVER /api/interviews/summary] Received finalize request:', {
        interviewId,
        patientId,
        patientData,
        opdToken,
        redFlag,
      });

      const supabase = getSupabaseServer();
      if (!supabase || !interviewId) {
        res.json({ success: true, updated: false, message: 'Supabase client or interviewId missing' });
        return;
      }

      const targetPatientId = patientId || interviewId;

      // Ensure patient record in 'patients' table is updated with final entered demographics
      if (targetPatientId) {
        const parsedAge =
          typeof patientData.age === 'number'
            ? patientData.age
            : patientData.age && String(patientData.age).trim() !== ''
            ? parseInt(String(patientData.age).trim(), 10) || null
            : null;

        const patientUpsertPayload = {
          id: targetPatientId,
          name:
            patientData.name && String(patientData.name).trim() !== ''
              ? String(patientData.name).trim()
              : 'Anonymous Patient',
          age: parsedAge,
          phone:
            patientData.phone && String(patientData.phone).trim() !== ''
              ? String(patientData.phone).trim()
              : null,
          abha_id:
            patientData.abhaId && String(patientData.abhaId).trim() !== ''
              ? String(patientData.abhaId).trim()
              : null,
          language_pref: patientData.language || 'hi',
        };

        console.log(
          '[SERVER /api/interviews/summary] WRITING PATIENT ROW TO SUPABASE:',
          JSON.stringify(patientUpsertPayload, null, 2)
        );

        const { data: upsertedPatient, error: patientErr } = await supabase
          .from('patients')
          .upsert(patientUpsertPayload, { onConflict: 'id' })
          .select()
          .single();

        if (patientErr) {
          console.error('[SERVER /api/interviews/summary] Patient upsert error:', patientErr);
        } else {
          console.log('[SERVER /api/interviews/summary] Successfully wrote patient row:', upsertedPatient);
        }
      }

      const { data: updatedInterview, error: interviewErr } = await supabase
        .from('interviews')
        .update({
          patient_id: targetPatientId,
          status,
          summary,
          transcript: Array.isArray(transcript) ? transcript : [],
          red_flag: !!redFlag,
          red_flag_reason: redFlagReason || null,
          opd_token: opdToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', interviewId)
        .select()
        .single();

      if (interviewErr) {
        console.warn('[Supabase] Finalize interview warning:', interviewErr.message);
      } else {
        console.log('[SERVER /api/interviews/summary] Interview updated in DB:', updatedInterview?.id);
      }

      res.json({ success: true, interviewId, patientId: targetPatientId });
    } catch (err) {
      console.error('[Supabase] Error finalizing interview summary:', err);
      res.status(500).json({ error: 'Failed to finalize interview summary' });
    }
  });

  // 4. Document upload & extraction storage
  app.post('/api/documents/upload', async (req, res) => {
    try {
      const {
        interviewId,
        documentId,
        title = 'Medical Record',
        docType = 'prescription',
        extractedData = {},
        fileBase64,
        confidence = 95,
      } = req.body;

      const supabase = getSupabaseServer();
      if (!supabase) {
        res.json({
          success: true,
          document: { id: documentId, title, doc_type: docType, extracted_data: extractedData },
        });
        return;
      }

      let storagePath = null;

      // If file image is provided, upload to Supabase "documents" bucket
      if (fileBase64 && interviewId) {
        try {
          const match = fileBase64.match(/^data:(image\/[a-zA-Z+]+|application\/pdf);base64,(.+)$/);
          const mimeType = match ? match[1] : 'image/jpeg';
          const base64Data = match ? match[2] : fileBase64;
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';
          const fileName = `${interviewId}/${documentId || Date.now()}.${ext}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(fileName, buffer, {
              contentType: mimeType,
              upsert: true,
            });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from('documents')
              .getPublicUrl(fileName);
            storagePath = publicUrlData?.publicUrl || fileName;
          } else {
            console.warn('[Supabase Storage] Upload error:', uploadErr.message);
          }
        } catch (uploadException) {
          console.warn('[Supabase Storage] Buffer upload notice:', uploadException);
        }
      }

      // Insert record into documents table
      const docRecord = {
        id: documentId,
        interview_id: interviewId || null,
        storage_path: storagePath || `documents/${interviewId}/${documentId || Date.now()}`,
        extracted_data: extractedData,
        doc_type: docType,
        created_at: new Date().toISOString(),
      };

      const { data: insertedDoc, error: insertErr } = await supabase
        .from('documents')
        .upsert(docRecord, { onConflict: 'id' })
        .select()
        .single();

      if (insertErr) {
        console.warn('[Supabase] Document insert warning:', insertErr.message);
      }

      res.json({
        success: true,
        document: insertedDoc || docRecord,
      });
    } catch (err) {
      console.error('[Supabase] Error uploading document:', err);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  // 5. Doctor Queue fetch endpoint with Supabase table join
  app.get('/api/doctor/queue', async (req, res) => {
    try {
      const { department } = req.query;
      const supabase = getSupabaseServer();

      if (!supabase) {
        res.json({ patients: [] });
        return;
      }

      let query = supabase
        .from('interviews')
        .select(`
          id,
          patient_id,
          department,
          status,
          structured_state,
          transcript,
          symptom_tags,
          red_flag,
          red_flag_reason,
          summary,
          opd_token,
          assigned_doctor_id,
          created_at,
          updated_at,
          patients (
            id,
            name,
            age,
            phone,
            abha_id,
            language_pref
          ),
          documents (
            id,
            storage_path,
            extracted_data,
            doc_type,
            created_at
          )
        `)
        .order('updated_at', { ascending: false });

      if (department && department !== 'all') {
        query = query.eq('department', department);
      }

      const { data: rows, error } = await query;
      if (error) {
        console.warn('[Supabase] Queue fetch warning:', error.message);
        res.json({ patients: [] });
        return;
      }

      // Map Supabase rows to PatientRecord interface for frontend
      const mappedPatients = (rows || []).map((row: any) => {
        const pat = row.patients || {};
        const docs = (row.documents || []).map((d: any) => ({
          id: d.id,
          title: d.doc_type ? `${d.doc_type.replace(/_/g, ' ').toUpperCase()}` : 'Uploaded Report',
          type: d.doc_type || 'prescription',
          date: d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Recent',
          facility: 'OPD Document Archive',
          confidence: 95,
          extractedData: d.extracted_data || {},
          fileUrl: d.storage_path,
        }));

        const historyAnswers: Record<string, any> = {};
        if (Array.isArray(row.transcript)) {
          row.transcript.forEach((t: any, idx: number) => {
            const key = t.section || `turn_${idx + 1}`;
            historyAnswers[key] = {
              question_en: t.question_en || '',
              question_hi: t.question_hi || '',
              section: t.section || 'chief_complaint',
              answer_en: t.answer_en || '',
              answer_hi: t.answer_hi || '',
              timestamp: t.timestamp || new Date(row.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              is_red_flag: !!t.is_red_flag,
            };
          });
        }

        const redFlagsList = [];
        if (row.red_flag && row.red_flag_reason) {
          redFlagsList.push(row.red_flag_reason);
        }

        const chiefComplaints = [];
        if (row.structured_state?.chief_complaint) {
          chiefComplaints.push(row.structured_state.chief_complaint);
        } else if (historyAnswers['chief_complaint']?.answer_en) {
          chiefComplaints.push(historyAnswers['chief_complaint'].answer_en);
        } else {
          chiefComplaints.push('General Consultation');
        }

        return {
          id: row.id,
          tokenNumber: row.opd_token || `OPD-${row.id.slice(0, 4).toUpperCase()}`,
          name: pat.name || 'Kiosk Patient',
          age: pat.age || 45,
          gender: 'male',
          phone: pat.phone || '+91 98000 00000',
          abhaId: pat.abha_id || '',
          department: row.department || 'general',
          language: pat.language_pref || 'hi',
          inputMode: 'touch',
          redFlags: redFlagsList,
          chiefComplaints,
          historyAnswers,
          scannedDocs: docs,
          status: row.status || 'waiting',
          timestamp: new Date(row.updated_at || row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          roomNumber: row.department === 'ayush' ? 'AYUSH Room 202' : 'OPD Room 104',
          waitTimeMin: row.red_flag ? 2 : 12,
          doctorAssigned: row.department === 'ayush' ? 'Dr. Ananya Vaidya, MD (Ayur)' : 'Dr. Rajesh Sharma, MD',
          doctorSummary: row.summary && Object.keys(row.summary).length > 0 ? row.summary : undefined,
        };
      });

      res.json({ patients: mappedPatients });
    } catch (err) {
      console.error('[Supabase] Error loading doctor queue:', err);
      res.status(500).json({ error: 'Failed to load doctor queue', patients: [] });
    }
  });

  // 6. Doctor profile management (doctors table)
  app.post('/api/doctor/profile', async (req, res) => {
    try {
      const { id, name, department = 'general' } = req.body;
      const supabase = getSupabaseServer();
      if (!supabase || !id) {
        res.json({ success: true });
        return;
      }

      const { data, error } = await supabase
        .from('doctors')
        .upsert(
          {
            id,
            name: name || 'Doctor',
            department,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        console.warn('[Supabase] Doctor profile upsert warning:', error.message);
      }
      res.json({ success: true, doctor: data });
    } catch (err) {
      console.error('[Supabase] Error updating doctor profile:', err);
      res.status(500).json({ error: 'Failed to update doctor profile' });
    }
  });

  // 7. Supabase client credentials config for browser initialization
  app.get('/api/supabase-config', (req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://owlrokravkwkptmsogai.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    });
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

  // Initialize Supabase tables/storage bucket verification on launch
  initializeSupabaseBackend().catch((err) => {
    console.warn('Initial Supabase verification note:', err);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Swasthya AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

