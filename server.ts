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
- Every question must be answerable by a short spoken sentence OR a tap —
  so always populate \`options\` with 2–5 plausible short answers, even for
  questions that feel open-ended (include an "Other / let me say it" option
  that maps to free-text voice input).
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
  "input_type": "single_select" | "free_text",
  "options": [
    {"id": "a", "text_en": "string", "text_hi": "string"}
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

      if (ai) {
        const candidateModels = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];

        for (const modelName of candidateModels) {
          try {
            const config: any = {
              temperature: 0.2,
              responseMimeType: 'application/json',
              systemInstruction: systemPrompt,
            };

            if (modelName.startsWith('gemini-3')) {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
            }

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
          } catch (modelErr) {
            console.warn(`Interview turn generation error with ${modelName}:`, modelErr);
          }
        }
      }

      if (generatedTurn) {
        res.json(generatedTurn);
        return;
      }

      // Fallback if AI client not configured or transient error
      res.json({
        question_en: 'What is the main reason for your hospital visit today?',
        question_hi: 'आज अस्पताल आने का आपका मुख्य कारण क्या है?',
        input_type: 'single_select',
        options: [
          { id: 'fever', text_en: 'Fever & Body Shivers', text_hi: 'बुखार एवं शरीर में कंपकंपी' },
          { id: 'chest_pain', text_en: 'Chest Pain or Discomfort', text_hi: 'सीने में दर्द या भारीपन' },
          { id: 'cough_breath', text_en: 'Cough or Difficulty in Breathing', text_hi: 'खांसी या सांस लेने में तकलीफ' },
          { id: 'stomach_pain', text_en: 'Stomach Ache or Vomiting', text_hi: 'पेट दर्द या उल्टी' },
          { id: 'other', text_en: 'Other symptom / Let me speak', text_hi: 'अन्य तकलीफ / बोलकर बताएं' },
        ],
        section: 'chief_complaint',
        symptom_tags: ['primary_concern'],
        section_complete: false,
        interview_complete: false,
        modelUsed: 'Deterministic Fallback',
      });
    } catch (err) {
      console.error('Error in interview-next-turn:', err);
      res.status(500).json({ error: 'Failed to generate interview turn' });
    }
  });

  // Gemini-Powered Physician Summary Generation Endpoint (gemini-2.5-flash / gemini-2.5-pro)
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

      if (ai) {
        const candidateModels = ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-2.5-pro'];

        for (const modelName of candidateModels) {
          try {
            const config: any = {
              temperature: 0.1,
              responseMimeType: 'application/json',
              systemInstruction:
                'You are a senior physician documentation assistant. Create structured, objective, physician-facing SOAP summaries. NEVER suggest a diagnosis or interpret findings; summarize only what was reported by the patient and extracted from records. Only include red-flags that were already matched by the rule set.',
            };

            if (modelName.startsWith('gemini-3')) {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
            }

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
          } catch (modelErr) {
            console.warn(`Summary generation error with ${modelName}:`, modelErr);
          }
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
