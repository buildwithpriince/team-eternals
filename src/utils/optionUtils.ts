import { QuestionOption } from '../types';

/**
 * Checks whether an option is an exclusive/placeholder/catch-all option
 * (e.g. "None", "Not sure", "No known history", "NKDA", "None of the above").
 */
export function isExclusiveOption(
  option: Partial<QuestionOption> | null | undefined
): boolean {
  if (!option) return false;

  // 1. Explicit boolean flag takes highest precedence
  if (typeof option.exclusive === 'boolean') {
    return option.exclusive;
  }

  const id = (option.id || '').toLowerCase();
  const en = (option.text_en || '').toLowerCase().trim();
  const hi = (option.text_hi || '').trim();

  // 2. Identification by standard ID naming conventions
  if (
    id.includes('none') ||
    id.includes('not_sure') ||
    id.includes('notsure') ||
    id.includes('no_known') ||
    id.includes('no_history') ||
    id.includes('nkda') ||
    id === 'surg_no' ||
    id === 'rf_none' ||
    id === 'pmh_none' ||
    id === 'alg_none' ||
    id === 'hab_none' ||
    id === 'fam_none' ||
    id === 'ros_none' ||
    id === 'oushadha_none' ||
    id === 'assoc_none' ||
    id === 'chest_none_assoc' ||
    id === 'med_none'
  ) {
    return true;
  }

  // 3. English phrase detection for catch-all / none / not sure
  const enExclusivePattern =
    /^(none|none of these|none of the above|not sure|no known|no other|no past|no chronic|no surgeries|no tobacco|no regular|no drug|no major|nothing|n\/a|not taking|no medicine)/i;
  if (enExclusivePattern.test(en)) {
    return true;
  }

  // 4. Hindi phrase detection for catch-all / none / not sure
  const hiExclusiveKeywords = [
    'कोई नहीं',
    'कोई पुरानी बीमारी नहीं',
    'कोई एलर्जी नहीं',
    'कुछ नहीं',
    'कोई लक्षण नहीं',
    'कोई नशा नहीं',
    'पता नहीं',
    'कोई ऑपरेशन नहीं',
    'कोई दवा नहीं',
    'कोई गंभीर बीमारी नहीं',
    'कोई नियमित दवा नहीं',
    'इनमें से कोई नहीं',
    'इनमें से कोई गंभीर लक्षण नहीं',
    'अन्य कोई परेशानी नहीं',
  ];
  if (hiExclusiveKeywords.some((kw) => hi.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Generic multi-select toggle logic for interview questions:
 * 1. When an EXCLUSIVE option is clicked:
 *    - If already selected -> deselects it (returns []).
 *    - If not selected -> deselects ALL other options (both regular and any other exclusive option);
 *      only that one exclusive option remains checked (returns [clickedOption.id]).
 * 2. When a REGULAR (non-exclusive) option is clicked:
 *    - Automatically deselects ANY exclusive option previously selected.
 *    - Toggles the clicked regular option (adds if absent, removes if present).
 *    - Regular options coexist freely, but never alongside an exclusive one.
 */
export function toggleMultiSelectOption(
  allOptions: QuestionOption[],
  currentSelectedIds: string[],
  clickedOption: QuestionOption
): string[] {
  const isClickedExclusive = isExclusiveOption(clickedOption);

  if (isClickedExclusive) {
    if (currentSelectedIds.includes(clickedOption.id)) {
      // Toggle off if already selected
      return [];
    }
    // Automatically deselect all other options; only this exclusive option is selected
    return [clickedOption.id];
  } else {
    // Regular option clicked:
    // 1. Remove all exclusive options from the active selection
    const nonExclusiveSelected = currentSelectedIds.filter((id) => {
      const opt = allOptions.find((o) => o.id === id);
      return opt ? !isExclusiveOption(opt) : !isExclusiveOption({ id });
    });

    // 2. Toggle the regular option
    if (nonExclusiveSelected.includes(clickedOption.id)) {
      return nonExclusiveSelected.filter((id) => id !== clickedOption.id);
    } else {
      return [...nonExclusiveSelected, clickedOption.id];
    }
  }
}

/**
 * Resolves multi-select option IDs from voice matching results, enforcing
 * strict mutual exclusivity between exclusive options and regular options.
 */
export function resolveMultiSelectVoiceIds(
  allOptions: QuestionOption[],
  currentSelectedIds: string[],
  matchedOptions: QuestionOption[]
): string[] {
  if (!matchedOptions || matchedOptions.length === 0) {
    return currentSelectedIds;
  }

  // If any matched option is exclusive, it takes absolute precedence and deselects all others
  const exclusiveMatched = matchedOptions.find((o) => isExclusiveOption(o));
  if (exclusiveMatched) {
    return [exclusiveMatched.id];
  }

  // Otherwise, all matched options are regular. Deselect any previously selected exclusive options.
  const nonExclusivePrev = currentSelectedIds.filter((id) => {
    const opt = allOptions.find((o) => o.id === id);
    return opt ? !isExclusiveOption(opt) : !isExclusiveOption({ id });
  });

  const newRegularIds = matchedOptions
    .filter((o) => !isExclusiveOption(o))
    .map((o) => o.id);

  return Array.from(new Set([...nonExclusivePrev, ...newRegularIds]));
}
