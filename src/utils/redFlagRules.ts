/**
 * Deterministic Rule-Based Clinical Red-Flag Engine for Swasthya AI.
 * 
 * Safety Principle:
 * - Hardcoded pattern matcher against clinically verified symptom tags.
 * - Does NOT ask the LLM "is this an emergency" — keeps triage 100% predictable,
 *   auditable, and deterministic.
 */

export interface RedFlagEvaluationResult {
  isRedFlag: boolean;
  redFlagReasons: string[];
  matchedTags: string[];
}

interface RedFlagRule {
  id: string;
  category: 'cardiac' | 'stroke' | 'respiratory' | 'hemorrhage' | 'sepsis_neuro' | 'severe_pain';
  reason: string;
  // Tags that trigger this rule if present
  triggerTags: string[];
  // If multiple required tags (e.g. high fever + neck stiffness)
  coOccurringTags?: string[][];
  // Keyword patterns in patient free text
  textKeywords?: RegExp[];
}

export const CLINICAL_RED_FLAG_RULES: RedFlagRule[] = [
  // 1. CARDIAC / ACUTE CORONARY SYNDROME
  {
    id: 'cardiac_acs',
    category: 'cardiac',
    reason: 'Suspected Acute Coronary Syndrome / Angina (Immediate ECG & Cardiac Triage)',
    triggerTags: [
      'chest_pain',
      'radiates_left_arm',
      'radiates_jaw',
      'crushing_chest_pain',
      'substernal_chest_pain',
      'sweating_with_chest_pain',
      'angina',
      'cardiac_arrest_risk',
      'cold_sweats_chest_pain',
    ],
    textKeywords: [
      /crushing.*chest/i,
      /chest.*(left\s*arm|jaw|back|radiat)/i,
      /seene.*(dard|jakdan|paseena)/i,
      /chhati.*dard/i,
    ],
  },

  // 2. STROKE / FAST PROTOCOL (Face, Arms, Speech, Time)
  {
    id: 'stroke_fast',
    category: 'stroke',
    reason: 'Suspected Acute Stroke / FAST Warning (Immediate Neurological Triage)',
    triggerTags: [
      'facial_droop',
      'facial_weakness',
      'slurred_speech',
      'speech_difficulty',
      'arm_weakness',
      'hemiplegia',
      'sudden_weakness',
      'one_sided_weakness',
      'sudden_numbness_face_arm',
      'acute_paralysis',
    ],
    textKeywords: [
      /facial\s*droop/i,
      /slurred\s*speech/i,
      /sudden.*weakness.*(arm|leg|side|face)/i,
      /chehra.*tedha/i,
      /boli.*ladkhada/i,
      /ek\s*taraf.*kamzori/i,
    ],
  },

  // 3. ACUTE RESPIRATORY DISTRESS
  {
    id: 'respiratory_distress',
    category: 'respiratory',
    reason: 'Acute Respiratory Distress / Severe Hypoxia Alert (Immediate SpO2 & O2 Support)',
    triggerTags: [
      'breathlessness_at_rest',
      'severe_dyspnea',
      'cyanosis',
      'unable_to_speak_sentences',
      'stridor',
      'gasping',
      'respiratory_failure_risk',
      'severe_breathlessness',
    ],
    textKeywords: [
      /breathless.*(rest|sitting|severe|cannot\s*breathe)/i,
      /dam\s*ghut/i,
      /saans.*(fool|ruk|takleef)/i,
      /unable\s*to\s*speak.*sentence/i,
    ],
  },

  // 4. ACTIVE HEMORRHAGE / SEVERE BLEEDING
  {
    id: 'active_hemorrhage',
    category: 'hemorrhage',
    reason: 'Active Gastrointestinal / Pulmonary Hemorrhage Alert (Immediate Resuscitation Triage)',
    triggerTags: [
      'severe_bleeding',
      'blood_in_vomit',
      'hematemesis',
      'melena',
      'hemoptysis',
      'coughing_blood',
      'rectal_bleeding',
      'massive_blood_loss',
    ],
    textKeywords: [
      /coughing.*blood/i,
      /blood.*(vomit|stool|potty|cough)/i,
      /khun.*(ulti|khansi|tatti|pakhana)/i,
      /severe.*bleeding/i,
    ],
  },

  // 5. SEPSIS & ACUTE MENINGEAL / NEUROLOGICAL INFECTION
  {
    id: 'sepsis_meningitis',
    category: 'sepsis_neuro',
    reason: 'Potential Acute Sepsis / Meningismus Warning (Immediate Vitals & Antibiotic Triage)',
    triggerTags: [
      'neck_stiffness',
      'altered_mental_status',
      'confusion_with_fever',
      'petechial_rash',
      'rigors_with_hypotension',
      'unresponsive_fever',
    ],
    coOccurringTags: [
      ['high_grade_fever', 'neck_stiffness'],
      ['high_grade_fever', 'altered_mental_status'],
      ['high_grade_fever', 'confusion'],
      ['high_grade_fever', 'petechial_rash'],
    ],
    textKeywords: [
      /fever.*(neck\s*stiff|confusion|unconscious|deliri)/i,
      /gardan.*(akad|dard).*bukhar/i,
      /bukhar.*(behosh|bhatak)/i,
    ],
  },

  // 6. SEVERE 9-10/10 PAIN SCALE
  {
    id: 'severe_pain_9_10',
    category: 'severe_pain',
    reason: 'Pain Scale 9-10/10 requires immediate analgesic triage',
    triggerTags: [
      'pain_scale_9_10',
      'unbearable_pain',
      'severe_agony',
      'worst_pain_of_life',
      'excruciating_pain',
    ],
    textKeywords: [
      /unbearable.*pain/i,
      /10\s*out\s*of\s*10/i,
      /worst\s*pain.*life/i,
      /asahniya.*dard/i,
    ],
  },
];

/**
 * Runs symptom tags and answers through the hardcoded clinical red-flag rules.
 */
export function evaluateRedFlagRules(
  symptomTags: string[] = [],
  answerText: string = '',
  optionRedFlag?: boolean,
  optionRedFlagReason?: string
): RedFlagEvaluationResult {
  const normalizedTags = symptomTags.map((t) => t.toLowerCase().trim());
  const reasonsSet = new Set<string>();
  const matchedTagsSet = new Set<string>();

  // 1. If explicit option flagged
  if (optionRedFlag && optionRedFlagReason) {
    reasonsSet.add(optionRedFlagReason);
  }

  // 2. Evaluate each deterministic clinical rule
  for (const rule of CLINICAL_RED_FLAG_RULES) {
    let triggered = false;

    // Check direct trigger tags
    for (const tag of rule.triggerTags) {
      if (normalizedTags.includes(tag) || normalizedTags.some((nt) => nt.includes(tag))) {
        triggered = true;
        matchedTagsSet.add(tag);
      }
    }

    // Check co-occurring tag sets
    if (rule.coOccurringTags) {
      for (const pair of rule.coOccurringTags) {
        const hasAll = pair.every((t) =>
          normalizedTags.includes(t) || normalizedTags.some((nt) => nt.includes(t))
        );
        if (hasAll) {
          triggered = true;
          pair.forEach((t) => matchedTagsSet.add(t));
        }
      }
    }

    // Check regex on text answer if provided
    if (answerText && rule.textKeywords) {
      for (const regex of rule.textKeywords) {
        if (regex.test(answerText)) {
          triggered = true;
          matchedTagsSet.add(`keyword_match:${rule.id}`);
        }
      }
    }

    if (triggered) {
      reasonsSet.add(rule.reason);
    }
  }

  const redFlagReasons = Array.from(reasonsSet);
  return {
    isRedFlag: redFlagReasons.length > 0,
    redFlagReasons,
    matchedTags: Array.from(matchedTagsSet),
  };
}
