import { QuestionOption, AppLanguage } from '../types';

export interface VoiceMatchResult {
  matchedIds: string[];
  confidence?: number;
  explanation?: string;
  source?: string;
}

/**
 * Parses spoken numbers and duration units (e.g., "5 months", "3 weeks", "दो साल", "char din")
 * and returns equivalent approximate duration in days.
 */
export function parseSpokenDurationInDays(transcript: string): number | null {
  const lower = transcript.toLowerCase();

  // Convert word numbers to digits
  const wordMap: Record<string, number> = {
    one: 1, ek: 1, 'एक': 1,
    two: 2, do: 2, 'दो': 2,
    three: 3, teen: 3, tin: 3, 'तीन': 3,
    four: 4, char: 4, 'चार': 4,
    five: 5, paanch: 5, panch: 5, 'पांच': 5,
    six: 6, chhah: 6, chhe: 6, 'छह': 6,
    seven: 7, saat: 7, 'सात': 7,
    eight: 8, aath: 8, 'आठ': 8,
    nine: 9, nau: 9, 'नौ': 9,
    ten: 10, das: 10, 'दस': 10,
    half: 0.5, aadha: 0.5, 'आधा': 0.5,
  };

  // Check for "today", "since morning", "aaj subah"
  if (
    lower.includes('today') ||
    lower.includes('aaj') ||
    lower.includes('आज') ||
    lower.includes('subah') ||
    lower.includes('morning') ||
    lower.includes('last night') ||
    lower.includes('kal raat') ||
    lower.includes('few hours') ||
    lower.includes('24 hours') ||
    lower.includes('sudden')
  ) {
    return 0.5;
  }

  // Regex to capture numbers and duration units
  const regex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|tin|char|paanch|panch|chhah|chhe|saat|aath|nau|das|half|aadha|एक|दो|तीन|चार|पांच|छह|सात|आठ|नौ|दस|आधा)\s*(years?|yrs?|yr|saal|साल|months?|mths?|mth|mahine|महीने|mahina|महीना|weeks?|wks?|wk|hafte|हफ्ते|hafta|हफ्ता|days?|din|दिन|hours?|hrs?|ghante|घंटे|ghanta|घंटा)/i;
  const match = lower.match(regex);

  if (match) {
    let num = parseFloat(match[1]);
    if (isNaN(num)) {
      num = wordMap[match[1].toLowerCase()] || 1;
    }
    const unit = match[2].toLowerCase();

    if (unit.startsWith('year') || unit.startsWith('yr') || unit.includes('saal') || unit.includes('साल')) {
      return num * 365;
    }
    if (unit.startsWith('month') || unit.startsWith('mth') || unit.includes('mahin') || unit.includes('महीन')) {
      return num * 30;
    }
    if (unit.startsWith('week') || unit.startsWith('wk') || unit.includes('haft') || unit.includes('हफ्त')) {
      return num * 7;
    }
    if (unit.startsWith('day') || unit.includes('din') || unit.includes('दिन')) {
      return num;
    }
    if (unit.startsWith('hour') || unit.startsWith('hr') || unit.includes('ghant') || unit.includes('घंट')) {
      return num / 24;
    }
  }

  // General colloquial long-term or short-term indicators
  if (
    lower.includes('long time') ||
    lower.includes('chronic') ||
    lower.includes('purana') ||
    lower.includes('kaafi time') ||
    lower.includes('saalon se') ||
    lower.includes('bachpan se')
  ) {
    return 180; // 6 months+
  }

  if (
    lower.includes('past week') ||
    lower.includes('few days') ||
    lower.includes('kuch din') ||
    lower.includes('pichle hafte')
  ) {
    return 4; // few days
  }

  return null;
}

/**
 * Client-Side Semantic Matcher that computes nearest option for durations, severity,
 * negations, symptom keywords, and AYUSH terms.
 */
export function matchSemanticsLocally(
  transcript: string,
  options: QuestionOption[]
): VoiceMatchResult {
  if (!transcript || !transcript.trim() || !options || options.length === 0) {
    return { matchedIds: [] };
  }

  const lower = transcript.toLowerCase().trim();

  // 1. Duration / Time Range Classification
  const days = parseSpokenDurationInDays(lower);
  if (days !== null) {
    // Check if options have duration concepts
    for (const opt of options) {
      const en = (opt.text_en || '').toLowerCase();
      const hi = (opt.text_hi || '').toLowerCase();
      const id = (opt.id || '').toLowerCase();

      // Chronic / > 1-3 months (days >= 35)
      if (days >= 35) {
        if (
          id.includes('chronic') ||
          id.includes('month') ||
          en.includes('more than 1 to 3 months') ||
          en.includes('more than 3 months') ||
          en.includes('long term') ||
          hi.includes('महीने या उससे अधिक') ||
          en.includes('> 1') ||
          en.includes('> 3')
        ) {
          return {
            matchedIds: [opt.id],
            confidence: 0.95,
            explanation: `Mapped spoken duration (${days} days) to Long Term / Chronic option`,
            source: 'semantic-duration-engine',
          };
        }
      }

      // 1 to 4 weeks (8 <= days < 35)
      if (days >= 8 && days < 35) {
        if (
          id.includes('week') ||
          en.includes('1 to 4 weeks') ||
          en.includes('about a month') ||
          hi.includes('1 से 4 हफ्ते') ||
          hi.includes('एक महीने से')
        ) {
          return {
            matchedIds: [opt.id],
            confidence: 0.95,
            explanation: `Mapped spoken duration (${days} days) to 1-4 Weeks option`,
            source: 'semantic-duration-engine',
          };
        }
      }

      // 2 to 7 days (2 <= days <= 7)
      if (days >= 1.5 && days <= 7.5) {
        if (
          id.includes('few_days') ||
          id.includes('days') ||
          en.includes('2 to 7 days') ||
          en.includes('past week') ||
          hi.includes('2 से 7 दिन') ||
          hi.includes('पिछले एक हफ्ते')
        ) {
          return {
            matchedIds: [opt.id],
            confidence: 0.95,
            explanation: `Mapped spoken duration (${days} days) to 2-7 Days option`,
            source: 'semantic-duration-engine',
          };
        }
      }

      // < 24 hours / Today (days < 1.5)
      if (days < 1.5) {
        if (
          id.includes('today') ||
          id.includes('hours') ||
          en.includes('< 24 hours') ||
          en.includes('today') ||
          hi.includes('24 घंटे') ||
          hi.includes('आज अचानक')
        ) {
          return {
            matchedIds: [opt.id],
            confidence: 0.95,
            explanation: `Mapped spoken duration (< 24h) to Today / Acute option`,
            source: 'semantic-duration-engine',
          };
        }
      }
    }
  }

  // 2. Severity & Pain Scale Classification
  const isSevere =
    lower.includes('unbearable') ||
    lower.includes('severe') ||
    lower.includes('killing') ||
    lower.includes('extreme') ||
    lower.includes('bahut zyada') ||
    lower.includes('bahut tez') ||
    lower.includes('sahan nahi') ||
    lower.includes('asahan') ||
    lower.includes('10/10') ||
    lower.includes('9/10') ||
    lower.includes('8/10') ||
    lower.includes('10 out of 10') ||
    lower.includes('9 out of 10') ||
    lower.includes('8 out of 10');

  if (isSevere) {
    const sevOpt = options.find(
      (o) =>
        o.id.includes('unbearable') ||
        o.id.includes('severe') ||
        (o.text_en || '').toLowerCase().includes('severe') ||
        (o.text_en || '').toLowerCase().includes('unbearable') ||
        (o.text_hi || '').includes('असहनीय') ||
        (o.text_hi || '').includes('बहुत तेज')
    );
    if (sevOpt) {
      return {
        matchedIds: [sevOpt.id],
        confidence: 0.95,
        explanation: 'Matched severe/unbearable pain scale',
        source: 'semantic-severity-engine',
      };
    }
  }

  const isMild =
    lower.includes('mild') ||
    lower.includes('halka') ||
    lower.includes('thoda') ||
    lower.includes('manageable') ||
    lower.includes('tolerable') ||
    lower.includes('1/10') ||
    lower.includes('2/10') ||
    lower.includes('3/10') ||
    lower.includes('1 out of 10') ||
    lower.includes('2 out of 10') ||
    lower.includes('3 out of 10');

  if (isMild) {
    const mildOpt = options.find(
      (o) =>
        o.id.includes('mild') ||
        (o.text_en || '').toLowerCase().includes('mild') ||
        (o.text_hi || '').includes('हल्की')
    );
    if (mildOpt) {
      return {
        matchedIds: [mildOpt.id],
        confidence: 0.95,
        explanation: 'Matched mild severity option',
        source: 'semantic-severity-engine',
      };
    }
  }

  const isModerate =
    lower.includes('moderate') ||
    lower.includes('medium') ||
    lower.includes('madhyam') ||
    lower.includes('disturbing') ||
    lower.includes('4/10') ||
    lower.includes('5/10') ||
    lower.includes('6/10') ||
    lower.includes('7/10');

  if (isModerate) {
    const modOpt = options.find(
      (o) =>
        o.id.includes('moderate') ||
        (o.text_en || '').toLowerCase().includes('moderate') ||
        (o.text_hi || '').includes('मध्यम')
    );
    if (modOpt) {
      return {
        matchedIds: [modOpt.id],
        confidence: 0.95,
        explanation: 'Matched moderate severity option',
        source: 'semantic-severity-engine',
      };
    }
  }

  const isIntermittent =
    lower.includes('waves') ||
    lower.includes('intermittent') ||
    lower.includes('comes and goes') ||
    lower.includes('kabhi kabhi') ||
    lower.includes('beech beech') ||
    lower.includes('ruka ruka');

  if (isIntermittent) {
    const intOpt = options.find(
      (o) =>
        o.id.includes('intermittent') ||
        (o.text_en || '').toLowerCase().includes('waves') ||
        (o.text_en || '').toLowerCase().includes('comes and goes') ||
        (o.text_hi || '').includes('रुक-रुक')
    );
    if (intOpt) {
      return {
        matchedIds: [intOpt.id],
        confidence: 0.95,
        explanation: 'Matched intermittent wave pattern option',
        source: 'semantic-severity-engine',
      };
    }
  }

  // 3. Negation / None Screening
  const isNegation =
    lower === 'no' ||
    lower === 'nahi' ||
    lower === 'nahin' ||
    lower === 'none' ||
    lower === 'never' ||
    lower === 'नहीं' ||
    lower.includes('bilkul nahi') ||
    lower.includes('kuch nahi') ||
    lower.includes('nothing') ||
    lower.includes('no symptoms') ||
    lower.includes('sab theek') ||
    lower.includes('no disease') ||
    lower.includes('no surgeries') ||
    lower.includes('no allergies') ||
    lower.includes('koi bimari nahi') ||
    lower.includes('koi allergy nahi') ||
    lower.includes('koi operation nahi');

  if (isNegation) {
    const noneOpt = options.find(
      (o) =>
        o.id.includes('none') ||
        o.id.includes('no') ||
        (o.text_en || '').toLowerCase().includes('none') ||
        (o.text_en || '').toLowerCase().includes('no known') ||
        (o.text_en || '').toLowerCase().includes('no surgeries') ||
        (o.text_hi || '').includes('कोई नहीं') ||
        (o.text_hi || '').includes('नहीं, कोई') ||
        (o.text_hi || '').includes('नहीं है')
    );
    if (noneOpt) {
      return {
        matchedIds: [noneOpt.id],
        confidence: 0.95,
        explanation: 'Matched negative / None option',
        source: 'semantic-negation-engine',
      };
    }
  }

  // 4. Clinical Symptom & Condition Matching
  // Fever
  if (lower.includes('bukhar') || lower.includes('fever') || lower.includes('thand') || lower.includes('shiver') || lower.includes('temperature') || lower.includes('तापमान')) {
    const feverOpt = options.find((o) => o.id.includes('fever') || (o.text_en || '').toLowerCase().includes('fever'));
    if (feverOpt) return { matchedIds: [feverOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // Chest Pain
  if (lower.includes('chest') || lower.includes('seene') || lower.includes('chhati') || lower.includes('dil') || lower.includes('angina') || lower.includes('heart attack')) {
    const chestOpt = options.find((o) => o.id.includes('chest') || (o.text_en || '').toLowerCase().includes('chest') || (o.text_hi || '').includes('सीने'));
    if (chestOpt) return { matchedIds: [chestOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // Cough & Breathlessness
  if (lower.includes('khasi') || lower.includes('cough') || lower.includes('saans') || lower.includes('breath') || lower.includes('dam') || lower.includes('asthma') || lower.includes('dama')) {
    const coughOpt = options.find((o) => o.id.includes('cough') || o.id.includes('breath') || o.id.includes('asthma') || (o.text_en || '').toLowerCase().includes('cough') || (o.text_en || '').toLowerCase().includes('breath'));
    if (coughOpt) return { matchedIds: [coughOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // Stomach & Acidity
  if (lower.includes('pet') || lower.includes('stomach') || lower.includes('acidity') || lower.includes('gas') || lower.includes('ulti') || lower.includes('vomit') || lower.includes('jalan') || lower.includes('dast')) {
    const stomachOpt = options.find((o) => o.id.includes('stomach') || o.id.includes('pitta') || (o.text_en || '').toLowerCase().includes('stomach') || (o.text_en || '').toLowerCase().includes('acidity') || (o.text_hi || '').includes('पेट'));
    if (stomachOpt) return { matchedIds: [stomachOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // Joint & Body Pain
  if (lower.includes('joint') || lower.includes('jodon') || lower.includes('ghutn') || lower.includes('kamar') || lower.includes('back') || lower.includes('gathiya') || lower.includes('badan dard')) {
    const jointOpt = options.find((o) => o.id.includes('joint') || o.id.includes('vata') || (o.text_en || '').toLowerCase().includes('joint') || (o.text_en || '').toLowerCase().includes('backache') || (o.text_hi || '').includes('जोड़ों'));
    if (jointOpt) return { matchedIds: [jointOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // Dizziness & Headache
  if (lower.includes('chakkar') || lower.includes('dizzy') || lower.includes('headache') || lower.includes('sir dard') || lower.includes('behoshi') || lower.includes('faint')) {
    const dizzyOpt = options.find((o) => o.id.includes('headache') || o.id.includes('dizzy') || (o.text_en || '').toLowerCase().includes('headache') || (o.text_en || '').toLowerCase().includes('dizziness') || (o.text_hi || '').includes('चक्कर'));
    if (dizzyOpt) return { matchedIds: [dizzyOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // Diabetes & Blood Pressure
  if (lower.includes('sugar') || lower.includes('diabetes') || lower.includes('bp') || lower.includes('blood pressure') || lower.includes('hypertension') || lower.includes('madhumeh')) {
    const dbOpt = options.find((o) => o.id.includes('diabetes') || o.id.includes('bp') || (o.text_en || '').toLowerCase().includes('diabetes') || (o.text_en || '').toLowerCase().includes('blood pressure') || (o.text_hi || '').includes('शुगर'));
    if (dbOpt) return { matchedIds: [dbOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // Tobacco / Smoking
  if (lower.includes('bidi') || lower.includes('cigarette') || lower.includes('smoke') || lower.includes('gutkha') || lower.includes('tambaku') || lower.includes('tobacco')) {
    const tobOpt = options.find((o) => o.id.includes('tobacco') || o.id.includes('smoke') || (o.text_en || '').toLowerCase().includes('tobacco') || (o.text_hi || '').includes('तंबाकू'));
    if (tobOpt) return { matchedIds: [tobOpt.id], confidence: 0.92, source: 'clinical-keyword-engine' };
  }

  // 5. Direct Word / Substring & Token Overlap Fallback
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
      return {
        matchedIds: [opt.id],
        confidence: 0.88,
        explanation: `Matched: ${opt.text_en}`,
        source: 'token-match',
      };
    }
  }

  // Multi-word token overlap
  const words = lower.split(/\s+/).filter((w) => w.length > 2);
  let bestOpt: QuestionOption | null = null;
  let maxScore = 0;

  for (const opt of options) {
    const en = (opt.text_en || '').toLowerCase();
    const hi = (opt.text_hi || '').toLowerCase();
    const idClean = (opt.id || '').toLowerCase().replace(/_/g, ' ');

    let score = 0;
    for (const w of words) {
      if (en.includes(w)) score += 2;
      if (hi.includes(w)) score += 2;
      if (idClean.includes(w)) score += 1;
    }

    if (score > maxScore) {
      maxScore = score;
      bestOpt = opt;
    }
  }

  if (bestOpt && maxScore >= 2) {
    return {
      matchedIds: [bestOpt.id],
      confidence: 0.8,
      explanation: `Nearest token match: ${bestOpt.text_en}`,
      source: 'nearest-token-match',
    };
  }

  return { matchedIds: [] };
}

/**
 * Sends a patient's spoken voice transcript + question options list to Gemini AI (gemini-3.7-flash / gemini-3.6-flash)
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
      if (data.matchedIds && data.matchedIds.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Network error when matching voice to options via Gemini, falling back to local semantic engine:', err);
  }

  // Client-side high-precision semantic fallback
  return matchSemanticsLocally(transcript, options);
}

