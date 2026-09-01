import { BackendQuestionContract, SectionKey, Department, AppLanguage } from '../types';

export interface StructuredTurnRecord {
  turn_number: number;
  section: SectionKey;
  question_en: string;
  question_hi: string;
  answer_en: string;
  answer_hi: string;
  symptom_tags: string[];
  is_red_flag?: boolean;
}

export interface StructuredAccumulatorState {
  chief_complaint?: string;
  turns: StructuredTurnRecord[];
  all_symptom_tags: string[];
  completed_sections: SectionKey[];
  current_section: SectionKey;
  patient_demographics?: {
    name?: string;
    age?: string;
    gender?: string;
  };
}

export interface InterviewNextTurnResponse {
  question_en: string;
  question_hi: string;
  input_type: 'single_select' | 'multi_select' | 'free_text';
  options: Array<{
    id: string;
    text_en: string;
    text_hi: string;
    red_flag?: boolean;
    red_flag_reason?: string;
  }>;
  section: SectionKey;
  symptom_tags: string[];
  section_complete: boolean;
  interview_complete: boolean;
  audio_prompt_en?: string;
  audio_prompt_hi?: string;
  modelUsed?: string;
}

/**
 * Fallback questions if backend is temporarily unreachable
 */
function getDeterministicFallbackQuestion(
  mode: Department,
  state: StructuredAccumulatorState
): InterviewNextTurnResponse {
  const turnsCount = state.turns.length;

  if (turnsCount === 0) {
    return {
      question_en: "What is the main reason for your hospital visit today?",
      question_hi: "आज अस्पताल आने का आपका मुख्य कारण क्या है?",
      input_type: "single_select",
      options: [
        { id: "fever", text_en: "Fever & Body Shivers", text_hi: "बुखार एवं शरीर में कंपकंपी" },
        { id: "chest_pain", text_en: "Chest Pain or Heavy Pressure", text_hi: "सीने में दर्द या भारीपन", red_flag: true, red_flag_reason: "Suspected Acute Coronary Syndrome / Angina (Immediate ECG & Cardiac Triage)" },
        { id: "cough_breath", text_en: "Cough or Difficulty Breathing", text_hi: "खांसी या सांस लेने में तकलीफ" },
        { id: "stomach_pain", text_en: "Stomach Ache, Gas or Vomiting", text_hi: "पेट दर्द, गैस या उल्टी" },
        { id: "joint_pain", text_en: "Joint Pain, Backache or Body Weakness", text_hi: "जोड़ों का दर्द, कमर दर्द या कमजोरी" },
        { id: "other", text_en: "Other symptom / Let me speak", text_hi: "अन्य तकलीफ / बोलकर बताएं" }
      ],
      section: "chief_complaint",
      symptom_tags: ["primary_concern"],
      section_complete: false,
      interview_complete: false,
      audio_prompt_en: "Please select what troubles you the most today.",
      audio_prompt_hi: "कृपया बताएं कि आज आपको सबसे ज्यादा क्या तकलीफ है?"
    };
  }

  if (turnsCount === 1) {
    return {
      question_en: "How long have you been having this problem?",
      question_hi: "यह तकलीफ आपको कितने दिनों या समय से हो रही है?",
      input_type: "single_select",
      options: [
        { id: "dur_today", text_en: "Started suddenly today (< 24 hours)", text_hi: "आज अचानक शुरू हुआ (24 घंटे से कम)" },
        { id: "dur_few_days", text_en: "2 to 7 days (Past week)", text_hi: "2 से 7 दिन (पिछले एक हफ्ते से)" },
        { id: "dur_weeks", text_en: "1 to 4 weeks (About a month)", text_hi: "1 से 4 हफ्ते (लगभग एक महीने से)" },
        { id: "dur_chronic", text_en: "More than 1 to 3 months (Long term)", text_hi: "1 से 3 महीने या उससे अधिक समय से" }
      ],
      section: "chief_complaint",
      symptom_tags: ["timeline", "duration"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "How many days has it been?",
      audio_prompt_hi: "यह समस्या कितने दिनों से है?"
    };
  }

  if (turnsCount === 2) {
    return {
      question_en: "How severe is your discomfort, and does it spread anywhere else?",
      question_hi: "तकलीफ कितनी तेज है, और क्या यह शरीर के किसी अन्य हिस्से में फैलती है?",
      input_type: "single_select",
      options: [
        { id: "sev_mild", text_en: "Mild — Can easily manage daily work", text_hi: "हल्की — रोजमर्रा का काम कर पा रहे हैं" },
        { id: "sev_moderate", text_en: "Moderate — Disturbing sleep and routine", text_hi: "मध्यम — नींद व काम में बाधा आ रही है" },
        { id: "sev_severe_spread", text_en: "Severe and spreads to arm, jaw or back", text_hi: "बहुत तेज है और हाथ, जबड़े या पीठ में फैल रहा है", red_flag: true, red_flag_reason: "Suspected Acute Coronary Syndrome / Angina" },
        { id: "sev_severe_local", text_en: "Severe / Unbearable (stays in one spot)", text_hi: "असहनीय तेज दर्द (एक ही जगह पर)", red_flag: true, red_flag_reason: "Pain Scale 9-10/10 requires immediate analgesic triage" }
      ],
      section: "hpi",
      symptom_tags: ["severity", "radiation", "quality"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Is the discomfort mild, moderate, or severe?",
      audio_prompt_hi: "क्या तकलीफ हल्की है, मध्यम है या असहनीय है?"
    };
  }

  if (turnsCount === 3) {
    return {
      question_en: "Do you have any existing long-term medical conditions like BP or Sugar?",
      question_hi: "क्या आपको पहले से कोई पुरानी बीमारी जैसे ब्लड प्रेशर या शुगर है?",
      input_type: "single_select",
      options: [
        { id: "pmh_none", text_en: "No known long-term illness", text_hi: "कोई पुरानी बीमारी नहीं है" },
        { id: "pmh_htn_dm", text_en: "High Blood Pressure or Diabetes", text_hi: "हाई ब्लड प्रेशर या शुगर (मधुमेह)" },
        { id: "pmh_heart_kidney", text_en: "Heart disease, Asthma, or Kidney problem", text_hi: "हृदय रोग, दमा (अस्थमा) या गुर्दे की समस्या" },
        { id: "pmh_prior_surg", text_en: "Prior major surgery in the past", text_hi: "पूर्व में कोई बड़ा ऑपरेशन/सर्जरी हुई है" }
      ],
      section: "past_history",
      symptom_tags: ["comorbidities"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Do you have any chronic conditions?",
      audio_prompt_hi: "क्या आपको पहले से कोई बीमारी है?"
    };
  }

  if (turnsCount === 4) {
    return {
      question_en: "Are you taking regular medications, or do you have any drug allergy?",
      question_hi: "क्या आप नियमित दवाइयां ले रहे हैं, या किसी दवा से कोई एलर्जी है?",
      input_type: "single_select",
      options: [
        { id: "med_none", text_en: "No regular medications and No drug allergies (NKDA)", text_hi: "कोई नियमित दवा नहीं और कोई दवा एलर्जी नहीं" },
        { id: "med_regular", text_en: "Taking regular daily prescriptions (BP/Diabetes/Thyroid)", text_hi: "नियमित दवाइयां ले रहे हैं (बीपी/शुगर/थायराइड)" },
        { id: "med_allergy_penicillin", text_en: "Allergy to Penicillin / Sulfa / Painkillers", text_hi: "पेनिसिलिन, सल्फा या दर्द निवारक दवाओं से एलर्जी है" },
        { id: "med_ayurvedic", text_en: "Taking Ayurvedic, Homeopathic or herbal supplements", text_hi: "आयुर्वेदिक, होम्योपैथिक या हर्बल दवाइयां ले रहे हैं" }
      ],
      section: "drug_allergy",
      symptom_tags: ["medications", "drug_allergy"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Do you have any drug allergies or regular medicines?",
      audio_prompt_hi: "क्या किसी दवा से एलर्जी है?"
    };
  }

  if (turnsCount === 5) {
    return {
      question_en: "Does anyone in your direct family (parents or siblings) have heart disease or diabetes?",
      question_hi: "क्या आपके परिवार में माता-पिता या भाई-बहन को हृदय रोग या शुगर की बीमारी है?",
      input_type: "single_select",
      options: [
        { id: "fam_none", text_en: "No major hereditary illness in family", text_hi: "परिवार में कोई गंभीर अनुवांशिक बीमारी नहीं है" },
        { id: "fam_heart", text_en: "Heart attack or heart stent at early age in family", text_hi: "परिवार में कम उम्र में हार्ट अटैक या दिल की बीमारी" },
        { id: "fam_dm_htn", text_en: "Diabetes or Hypertension runs in parents", text_hi: "माता-पिता में शुगर या हाई बीपी की समस्या" },
        { id: "fam_asthma", text_en: "Asthma or severe allergies in family", text_hi: "परिवार में दमा (अस्थमा) या एलर्जी" }
      ],
      section: "family_history",
      symptom_tags: ["family_history"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Is there any history of heart disease or diabetes in your family?",
      audio_prompt_hi: "क्या परिवार में किसी को दिल की बीमारी या शुगर है?"
    };
  }

  if (turnsCount === 6) {
    return {
      question_en: "Do you smoke, consume alcohol, or have specific dietary restrictions?",
      question_hi: "क्या आप धूम्रपान (बीड़ी/सिगरेट), तंबाकू, शराब का सेवन करते हैं?",
      input_type: "single_select",
      options: [
        { id: "hab_none", text_en: "Non-smoker, Non-alcoholic (Vegetarian / Regular diet)", text_hi: "कोई नशा नहीं (शाकाहारी / सामान्य भोजन)" },
        { id: "hab_smoke", text_en: "Smoking / Bidi or Tobacco chewing habit", text_hi: "बीड़ी, सिगरेट या तंबाकू / गुटखा का सेवन" },
        { id: "hab_alcohol", text_en: "Occasional or regular alcohol consumption", text_hi: "शराब का सेवन करते हैं" },
        { id: "hab_stress", text_en: "High work stress and disturbed night sleep", text_hi: "काम का बहुत तनाव और रात में नींद न आना" }
      ],
      section: "personal_history",
      symptom_tags: ["habits", "lifestyle"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Do you have any tobacco, smoking or alcohol habits?",
      audio_prompt_hi: "क्या आप बीड़ी, सिगरेट या तंबाकू का सेवन करते हैं?"
    };
  }

  // AYUSH mode: Dashavidha Pariksha / Agni
  if (mode === 'ayush') {
    return {
      question_en: "How is your appetite, digestion, and daily bowel movement?",
      question_hi: "आपकी भूख, पाचन क्रिया और पेट साफ होने की स्थिति कैसी रहती है?",
      input_type: "single_select",
      options: [
        { id: "agni_sama", text_en: "Normal digestion, daily clear bowel (Samagni)", text_hi: "सामान्य पाचन, रोज पेट अच्छी तरह साफ होता है (समाग्नि)" },
        { id: "agni_manda", text_en: "Sluggish digestion, heaviness after food, constipation (Mandagni)", text_hi: "पाचन धीमा, खाने के बाद भारीपन व कब्ज (मंदाग्नि)" },
        { id: "agni_teekshna", text_en: "Excess burning hunger, acidity and loose motions (Tikshnagni)", text_hi: "तेज जलन वाली भूख, एसिडिटी और दस्त (तीक्ष्णाग्नि)" },
        { id: "agni_visham", text_en: "Irregular appetite, frequent gas and bloating (Vishamagni)", text_hi: "अनियमित भूख, गैस और पेट फूलना (विषमाग्नि)" }
      ],
      section: "dashavidha_pariksha",
      symptom_tags: ["agni", "digestion", "kostha"],
      section_complete: true,
      interview_complete: true,
      audio_prompt_en: "How is your digestion and appetite?",
      audio_prompt_hi: "आपकी भूख और पाचन शक्ति कैसी है?"
    };
  }

  // General ROS completion
  return {
    question_en: "Do you have any other associated symptoms like fever, weight loss, or swelling in feet?",
    question_hi: "क्या आपको बुखार, अचानक वजन कम होना या पैरों में सूजन जैसा कोई अन्य लक्षण है?",
    input_type: "single_select",
    options: [
      { id: "ros_none", text_en: "None of these (No fever, swelling, or weight loss)", text_hi: "इनमें से कोई नहीं (बुखार, सूजन या वजन घटना नहीं है)" },
      { id: "ros_fever", text_en: "Mild fever or night chills", text_hi: "हल्का बुखार या रात में ठंड लगना" },
      { id: "ros_swelling", text_en: "Swelling in feet or around eyes", text_hi: "पैरों में या आंखों के आसपास सूजन" },
      { id: "ros_fatigue", text_en: "Severe general fatigue and weakness", text_hi: "अत्यधिक कमजोरी व थकान महसूस होना" }
    ],
    section: "ros",
    symptom_tags: ["associated_symptoms", "ros"],
    section_complete: true,
    interview_complete: true,
    audio_prompt_en: "Do you have any other symptoms like fever or swelling?",
    audio_prompt_hi: "क्या आपको बुखार या पैरों में सूजन की शिकायत है?"
  };
}

/**
 * Calls the backend Gemini Conversational History Engine.
 */
export async function fetchNextInterviewTurn(params: {
  mode: Department;
  language: AppLanguage;
  department: string;
  structuredState: StructuredAccumulatorState;
}): Promise<InterviewNextTurnResponse> {
  try {
    const response = await fetch('/api/interview-next-turn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: params.mode,
        language: params.language,
        department: params.department,
        structured_state_json: params.structuredState,
      }),
    });

    if (!response.ok) {
      throw new Error(`Interview turn API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.question_en && data.options && Array.isArray(data.options)) {
      return {
        question_en: data.question_en,
        question_hi: data.question_hi || data.question_en,
        input_type: data.input_type || 'single_select',
        options: data.options.map((opt: any, idx: number) => ({
          id: opt.id || `opt_${idx}`,
          text_en: opt.text_en || opt.text || '',
          text_hi: opt.text_hi || opt.text_en || opt.text || '',
          red_flag: !!opt.red_flag,
          red_flag_reason: opt.red_flag_reason,
        })),
        section: data.section || 'chief_complaint',
        symptom_tags: Array.isArray(data.symptom_tags) ? data.symptom_tags : [],
        section_complete: !!data.section_complete,
        interview_complete: !!data.interview_complete,
        audio_prompt_en: data.audio_prompt_en || data.question_en,
        audio_prompt_hi: data.audio_prompt_hi || data.question_hi || data.question_en,
        modelUsed: data.modelUsed,
      };
    }

    throw new Error('Invalid JSON structure returned by interview turn endpoint');
  } catch (err) {
    console.warn('Backend interview turn call fallback:', err);
    return getDeterministicFallbackQuestion(params.mode, params.structuredState);
  }
}
