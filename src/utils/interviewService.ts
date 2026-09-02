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
 * Intelligent Adaptive Clinical Rules Engine.
 * Generates context-aware SOCRATES intake questions dynamically tailored
 * to the patient's specific chief complaint, department, and past turn history.
 */
export function getDeterministicFallbackQuestion(
  mode: Department,
  state: StructuredAccumulatorState
): InterviewNextTurnResponse {
  const turnsCount = state.turns.length;
  const cc = (state.chief_complaint || state.turns[0]?.answer_en || '').toLowerCase();

  // Turn 0: Opening Chief Complaint
  if (turnsCount === 0) {
    if (mode === 'ayush') {
      return {
        question_en: "What is the primary health concern or imbalance bringing you to the AYUSH OPD today?",
        question_hi: "आज आयुष ओपीडी में आने का आपका मुख्य कारण या स्वास्थ्य समस्या क्या है?",
        input_type: "single_select",
        options: [
          { id: "ayush_joint_vata", text_en: "Joint Pain, Stiffness & Sciatica (Vata Dosha)", text_hi: "जोड़ों का दर्द, जकड़न व साइटिका (वात विकार)" },
          { id: "ayush_acidity_pitta", text_en: "Acidity, Heartburn & Indigestion (Pitta / Amlapitta)", text_hi: "खट्टी डकारें, सीने में जलन व एसिडिटी (पित्त / अम्लपित्त)" },
          { id: "ayush_cough_kapha", text_en: "Chronic Cough, Congestion & Sinusitis (Kapha)", text_hi: "पुरानी खांसी, कफ, एलर्जी व साइनस (कफ विकार)" },
          { id: "ayush_skin_allergy", text_en: "Skin Allergies, Psoriasis or Eczema (Kustha Roga)", text_hi: "त्वचा पर चकत्ते, खुजली, सोरायसिस या दाद" },
          { id: "ayush_stress_sleep", text_en: "Anxiety, Sleep Disorder & Stress (Manasa Roga)", text_hi: "तनाव, अनिद्रा (नींद न आना) व घबराहट" },
          { id: "chest_pain", text_en: "Severe Chest Pain or Heavy Pressure", text_hi: "सीने में तेज दर्द या भारीपन", red_flag: true, red_flag_reason: "Suspected Acute Coronary Syndrome (Immediate Emergency Referral Required)" },
          { id: "ayush_metabolic_sugar", text_en: "Diabetes, Weight Gain & Liver support (Prameha / Medoroga)", text_hi: "शुगर (मधुमेह), मोटापा या फैटी लिवर की समस्या" },
          { id: "ayush_general_wellness", text_en: "Immunity Boost & Rejuvenation (Rasayana Chikitsa)", text_hi: "रोग प्रतिरोधक क्षमता (इम्युनिटी) व रसायन स्वास्थ्य" }
        ],
        section: "chief_complaint",
        symptom_tags: ["ayush_chief_complaint"],
        section_complete: false,
        interview_complete: false,
        audio_prompt_en: "Please select what troubles you the most today.",
        audio_prompt_hi: "कृपया बताएं कि आज आपको सबसे ज्यादा क्या तकलीफ है?",
        modelUsed: "Adaptive AYUSH Intake Engine"
      };
    }

    return {
      question_en: "What is the main reason for your hospital visit today?",
      question_hi: "आज अस्पताल आने का आपका मुख्य कारण क्या है?",
      input_type: "single_select",
      options: [
        { id: "fever", text_en: "Fever & Body Shivers", text_hi: "बुखार एवं शरीर में कंपकंपी" },
        { id: "cough_breath", text_en: "Cough or Breathing Trouble", text_hi: "खांसी या सांस लेने में तकलीफ" },
        { id: "stomach_pain", text_en: "Stomach Pain, Acidity or Vomiting", text_hi: "पेट दर्द, एसिडिटी या उल्टी" },
        { id: "body_joint_pain", text_en: "Body Ache, Joint or Back Pain", text_hi: "बदन दर्द, जोड़ों या कमर का दर्द" },
        { id: "chest_pain", text_en: "Chest Pain or Heavy Pressure", text_hi: "सीने में दर्द या भारीपन", red_flag: true, red_flag_reason: "Suspected Acute Coronary Syndrome / Angina (Immediate ECG & Cardiac Triage)" },
        { id: "headache_dizzy", text_en: "Headache or Dizziness", text_hi: "सिरदर्द या चक्कर आना" },
        { id: "skin_issue", text_en: "Skin Rash, Itching or Allergy", text_hi: "त्वचा पर दाने, खुजली या एलर्जी" },
        { id: "injury_wound", text_en: "Recent Injury, Cut or Fall", text_hi: "चोट, घाव या गिरने से दर्द" },
      ],
      section: "chief_complaint",
      symptom_tags: ["primary_concern"],
      section_complete: false,
      interview_complete: false,
      audio_prompt_en: "Please select what troubles you the most today.",
      audio_prompt_hi: "कृपया बताएं कि आज आपको सबसे ज्यादा क्या तकलीफ है?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 1: Duration & Onset (SOCRATES: Timing / Duration)
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
      audio_prompt_hi: "यह समस्या कितने दिनों से है?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 2: Character / Severity / Radiation (SOCRATES: Character & Radiation)
  if (turnsCount === 2) {
    if (cc.includes('chest') || cc.includes('heart') || cc.includes('सीने') || cc.includes('dil')) {
      return {
        question_en: "How does the chest pain feel, and does it spread to your arm, neck, or back?",
        question_hi: "सीने में दर्द कैसा महसूस होता है, और क्या यह बाएं हाथ, जबड़े या पीठ में फैलता है?",
        input_type: "single_select",
        options: [
          { id: "chest_radiating", text_en: "Heavy crushing pressure spreading to left arm / jaw", text_hi: "भारी दबाव व दर्द जो बाएं हाथ या जबड़े में फैल रहा है", red_flag: true, red_flag_reason: "Suspected Acute Coronary Syndrome (Immediate ECG & Cardiac Triage)" },
          { id: "chest_sharp", text_en: "Sharp stabbing pain when taking a deep breath or coughing", text_hi: "गहरी सांस लेने या खांसने पर सुई जैसा तेज चुभन वाला दर्द" },
          { id: "chest_burning", text_en: "Burning sensation in upper chest after eating (Acidity / GERD)", text_hi: "खाने के बाद सीने में खट्टी जलन (एसिडिटी)" },
          { id: "chest_dull", text_en: "Mild dull muscular ache in chest wall", text_hi: "सीने की मांसपेशियों में हल्का मीठा दर्द" }
        ],
        section: "hpi",
        symptom_tags: ["chest_pain_character", "radiation", "severity"],
        section_complete: false,
        interview_complete: false,
        audio_prompt_en: "Does the chest pain spread to your arm or jaw?",
        audio_prompt_hi: "क्या सीने का दर्द हाथ या जबड़े की तरफ फैलता है?",
        modelUsed: "Adaptive Cardiac Engine"
      };
    }

    if (cc.includes('stomach') || cc.includes('pet') || cc.includes('acidity') || cc.includes('पेट')) {
      return {
        question_en: "Where exactly is the stomach pain, and how severe is it?",
        question_hi: "पेट में दर्द ठीक किस जगह पर है, और यह कितना तेज है?",
        input_type: "single_select",
        options: [
          { id: "abd_upper_burn", text_en: "Upper abdomen burning with nausea / empty stomach", text_hi: "पेट के ऊपरी हिस्से में जलन, उल्टी जैसा लगना" },
          { id: "abd_lower_right", text_en: "Sharp severe pain in lower right side (Appendicitis sign)", text_hi: "पेट के निचले दाहिने हिस्से में असहनीय तेज दर्द", red_flag: true, red_flag_reason: "Suspected Acute Appendicitis / Acute Abdomen" },
          { id: "abd_cramps", text_en: "Cramping and twisting pain with loose motions / gas", text_hi: "मरोड़ वाला दर्द और दस्त या पेट में गैस" },
          { id: "abd_mild", text_en: "Mild diffuse discomfort, manageable", text_hi: "हल्का सामान्य दर्द, सहन करने योग्य" }
        ],
        section: "hpi",
        symptom_tags: ["abdominal_pain_location", "severity"],
        section_complete: false,
        interview_complete: false,
        audio_prompt_en: "Where exactly is the stomach pain located?",
        audio_prompt_hi: "पेट में दर्द किस तरफ ज्यादा है?",
        modelUsed: "Adaptive GI Engine"
      };
    }

    if (cc.includes('fever') || cc.includes('बुखार') || cc.includes('thand')) {
      return {
        question_en: "What type of fever are you experiencing?",
        question_hi: "बुखार किस प्रकार का है?",
        input_type: "single_select",
        options: [
          { id: "fever_high_chills", text_en: "High fever (102°F+) with shivering and chills", text_hi: "तेज बुखार (102°F से अधिक) कंपकंपी और ठंड के साथ" },
          { id: "fever_continuous", text_en: "Continuous fever with severe body ache and headache", text_hi: "लगातार बना रहने वाला बुखार, सिरदर्द व बदन दर्द" },
          { id: "fever_evening", text_en: "Mild fever mostly rising in the evenings with night sweats", text_hi: "हल्का बुखार जो अक्सर शाम को बढ़ता है व पसीना आता है" },
          { id: "fever_intermittent", text_en: "Comes and goes every few hours after paracetamol", text_hi: "दवा लेने पर उतर जाता है फिर कुछ घंटों बाद आ जाता है" }
        ],
        section: "hpi",
        symptom_tags: ["fever_grade", "chills"],
        section_complete: false,
        interview_complete: false,
        audio_prompt_en: "Is the fever mild or very high with chills?",
        audio_prompt_hi: "क्या बुखार तेज ठंड लगकर आ रहा है?",
        modelUsed: "Adaptive Febrile Engine"
      };
    }

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
      audio_prompt_hi: "क्या तकलीफ हल्की है, मध्यम है या असहनीय है?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 3: Associated Symptoms & Red Flags (SOCRATES: Associated Symptoms)
  if (turnsCount === 3) {
    if (cc.includes('chest') || cc.includes('heart') || cc.includes('सीने') || cc.includes('dil')) {
      return {
        question_en: "Are you having profuse cold sweating, breathlessness, or dizziness with the chest discomfort?",
        question_hi: "क्या सीने में तकलीफ के साथ ठंडा पसीना, सांस फूलना या चक्कर आ रहे हैं?",
        input_type: "single_select",
        options: [
          { id: "chest_sweating_dyspnea", text_en: "Yes — Cold profuse sweating and shortness of breath", text_hi: "हां — अत्यधिक ठंडा पसीना और सांस लेने में कठिनाई", red_flag: true, red_flag_reason: "Cardiogenic / Acute Coronary Syndrome Warning Sign" },
          { id: "chest_palpitations", text_en: "Fast racing heartbeats (Palpitations)", text_hi: "दिल की धड़कन बहुत तेज चलना (घबराहट)" },
          { id: "chest_cough", text_en: "Dry or phlegmy cough with mild chest tightness", text_hi: "खांसी और सीने में जकड़न" },
          { id: "chest_none_assoc", text_en: "No sweating, no breathlessness, no palpitations", text_hi: "नहीं — न पसीना है, न सांस फूल रही है" }
        ],
        section: "hpi",
        symptom_tags: ["diaphoresis", "dyspnea", "palpitations"],
        section_complete: true,
        interview_complete: false,
        audio_prompt_en: "Do you have sweating or difficulty breathing?",
        audio_prompt_hi: "क्या पसीना या सांस फूलने की शिकायत है?",
        modelUsed: "Adaptive Cardiac Engine"
      };
    }

    if (cc.includes('cough') || cc.includes('breath') || cc.includes('khasi') || cc.includes('saans')) {
      return {
        question_en: "Do you have breathlessness at rest, wheezing, or blood in sputum?",
        question_hi: "क्या बैठे-बैठे सांस फूल रही है, सीने से सीटी की आवाज या बलगम में खून आ रहा है?",
        input_type: "single_select",
        options: [
          { id: "resp_hemoptysis", text_en: "Blood in sputum or severe breathlessness at rest", text_hi: "बलगम में खून आना या बैठे-बैठे सांस फूलना", red_flag: true, red_flag_reason: "Suspected Hemoptysis / Severe Respiratory Distress" },
          { id: "resp_wheeze", text_en: "Wheezing whistle sound with chest tightness", text_hi: "सांस लेते समय सीने से सीटी जैसी आवाज आना" },
          { id: "resp_phlegm", text_en: "Thick yellow/green phlegm with fever", text_hi: "गाढ़ा पीला/हरा बलगम और बुखार" },
          { id: "resp_dry", text_en: "Dry throat tickle cough without phlegm", text_hi: "गले में खराश वाली सूखी खांसी (बिना बलगम)" }
        ],
        section: "hpi",
        symptom_tags: ["dyspnea", "hemoptysis", "wheezing"],
        section_complete: true,
        interview_complete: false,
        audio_prompt_en: "Is there any blood in cough or wheezing?",
        audio_prompt_hi: "क्या खांसी में खून या सांस लेने में घरघराहट है?",
        modelUsed: "Adaptive Respiratory Engine"
      };
    }

    return {
      question_en: "Do you have any associated symptoms like vomiting, dizziness, or fever?",
      question_hi: "क्या आपको उल्टी, चक्कर आना, कमजोरी या बुखार जैसा कोई अन्य लक्षण है?",
      input_type: "single_select",
      options: [
        { id: "assoc_vomit_black", text_en: "Vomiting blood or black dark stools", text_hi: "उल्टी में खून आना या काला मल होना", red_flag: true, red_flag_reason: "Suspected Upper GI Bleed" },
        { id: "assoc_dizzy_faint", text_en: "Severe dizziness, blackouts, or sudden fainting", text_hi: "चक्कर आकर अंधेरा छाना या बेहोशी", red_flag: true, red_flag_reason: "Syncope / Hemodynamic Instability" },
        { id: "assoc_mild_nausea", text_en: "Mild nausea or loss of appetite", text_hi: "जी मिचलाना या भूख कम लगना" },
        { id: "assoc_none", text_en: "No other associated symptoms (None of these)", text_hi: "इनमें से कोई अन्य लक्षण नहीं है" }
      ],
      section: "hpi",
      symptom_tags: ["associated_symptoms"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Do you have any vomiting or dizziness?",
      audio_prompt_hi: "क्या उल्टी या चक्कर आने की शिकायत है?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 4: Past Medical & Surgical History
  if (turnsCount === 4) {
    return {
      question_en: "Do you have any existing long-term medical conditions like BP, Diabetes, or prior Heart issues?",
      question_hi: "क्या आपको पहले से कोई पुरानी बीमारी जैसे ब्लड प्रेशर, शुगर (डायबिटीज) या दिल की बीमारी है?",
      input_type: "single_select",
      options: [
        { id: "pmh_none", text_en: "No known long-term illness", text_hi: "कोई पुरानी बीमारी नहीं है" },
        { id: "pmh_htn_dm", text_en: "High Blood Pressure or Diabetes", text_hi: "हाई ब्लड प्रेशर या शुगर (मधुमेह)" },
        { id: "pmh_heart_stent", text_en: "Prior Heart Attack, Heart Stent, or Bypass Surgery", text_hi: "पूर्व में हार्ट अटैक, स्टेंट या बाईपास सर्जरी हुई है", red_flag: true, red_flag_reason: "Known Ischemic Heart Disease with Acute Symptoms" },
        { id: "pmh_prior_surg", text_en: "Asthma, Kidney disease, or prior major surgery", text_hi: "दमा, गुर्दे की बीमारी या पूर्व में कोई बड़ा ऑपरेशन" }
      ],
      section: "past_history",
      symptom_tags: ["comorbidities", "past_history"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Do you have high BP, diabetes, or prior heart conditions?",
      audio_prompt_hi: "क्या आपको पहले से बीपी, शुगर या दिल की बीमारी है?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 5: Medications & Drug Allergy
  if (turnsCount === 5) {
    return {
      question_en: "Are you taking regular medications, or do you have any drug allergy?",
      question_hi: "क्या आप नियमित दवाइयां ले रहे हैं, या किसी दवा से कोई एलर्जी है?",
      input_type: "single_select",
      options: [
        { id: "med_none", text_en: "No regular medications and No drug allergies (NKDA)", text_hi: "कोई नियमित दवा नहीं और कोई दवा एलर्जी नहीं" },
        { id: "med_regular", text_en: "Taking regular daily prescriptions (BP/Diabetes/Thyroid/Blood Thinners)", text_hi: "नियमित दवाइयां ले रहे हैं (बीपी/शुगर/थायराइड/खून पतला करने वाली)" },
        { id: "med_allergy_penicillin", text_en: "Allergy to Penicillin / Sulfa / Painkillers (NSAIDs)", text_hi: "पेनिसिलिन, सल्फा या दर्द निवारक दवाओं से एलर्जी है" },
        { id: "med_ayurvedic", text_en: "Taking Ayurvedic, Homeopathic or herbal supplements", text_hi: "आयुर्वेदिक, होम्योपैथिक या हर्बल दवाइयां ले रहे हैं" }
      ],
      section: "drug_allergy",
      symptom_tags: ["medications", "drug_allergy"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Do you have any drug allergies or regular medicines?",
      audio_prompt_hi: "क्या किसी दवा से एलर्जी है या रोज दवा लेते हैं?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 6: Family History
  if (turnsCount === 6) {
    return {
      question_en: "Does anyone in your direct family (parents or siblings) have heart disease or diabetes?",
      question_hi: "क्या आपके परिवार में माता-पिता या भाई-बहन को हृदय रोग या शुगर की बीमारी है?",
      input_type: "single_select",
      options: [
        { id: "fam_none", text_en: "No major hereditary illness in family", text_hi: "परिवार में कोई गंभीर अनुवांशिक बीमारी नहीं है" },
        { id: "fam_heart", text_en: "Heart attack or heart stent at early age in parents/siblings", text_hi: "परिवार में कम उम्र में हार्ट अटैक या दिल की बीमारी" },
        { id: "fam_dm_htn", text_en: "Diabetes or Hypertension runs in family", text_hi: "माता-पिता में शुगर या हाई बीपी की समस्या" },
        { id: "fam_asthma", text_en: "Asthma or severe allergies in family", text_hi: "परिवार में दमा (अस्थमा) या एलर्जी" }
      ],
      section: "family_history",
      symptom_tags: ["family_history"],
      section_complete: true,
      interview_complete: false,
      audio_prompt_en: "Is there any history of heart disease or diabetes in your family?",
      audio_prompt_hi: "क्या परिवार में किसी को दिल की बीमारी या शुगर है?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 7: Personal History & Habits
  if (turnsCount === 7) {
    return {
      question_en: "Do you smoke, consume alcohol, or chew tobacco?",
      question_hi: "क्या आप धूम्रपान (बीड़ी/सिगरेट), तंबाकू, गुटखा या शराब का सेवन करते हैं?",
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
      audio_prompt_hi: "क्या आप बीड़ी, सिगरेट या तंबाकू का सेवन करते हैं?",
      modelUsed: "Adaptive Clinical Engine"
    };
  }

  // Turn 8: AYUSH Dashavidha Pariksha / General Review of Systems (Final Turn)
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
      audio_prompt_hi: "आपकी भूख और पाचन शक्ति कैसी है?",
      modelUsed: "Adaptive AYUSH Engine"
    };
  }

  // General ROS completion
  return {
    question_en: "Do you have any other associated symptoms like fever, unexplained weight loss, or swelling in feet?",
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
    audio_prompt_hi: "क्या आपको बुखार या पैरों में सूजन की शिकायत है?",
    modelUsed: "Adaptive Clinical Engine"
  };
}

/**
 * Calls the backend Gemini Conversational History Engine with a strict client-side timeout.
 * If the server takes longer than 3.5s or fails, it immediately falls back to the deterministic engine.
 */
export async function fetchNextInterviewTurn(params: {
  mode: Department;
  language: AppLanguage;
  department: string;
  structuredState: StructuredAccumulatorState;
}): Promise<InterviewNextTurnResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
        modelUsed: data.modelUsed || 'Gemini 3.7 Flash',
      };
    }

    throw new Error('Invalid JSON structure returned by interview turn endpoint');
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Backend interview turn call fallback to adaptive clinical engine:', err);
    return getDeterministicFallbackQuestion(params.mode, params.structuredState);
  }
}

