const DIACRITICS_REGEX = /[ًٌٍَُِّْٰۭۡۢۘۖۚۛۗ۞۩۝]/g;
const TATWEEL_REGEX = /ـ/g;
const BOM_REGEX = /\ufeff/g;
const NON_WORD_REGEX = /[^\p{Letter}\p{Number}\s]/gu;

export const normalizeArabic = (text: string): string => {
  return text
    .replace(BOM_REGEX, '')
    .replace(DIACRITICS_REGEX, '')
    .replace(TATWEEL_REGEX, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(NON_WORD_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const splitWords = (text: string): string[] => {
  const normalized = normalizeArabic(text);
  return normalized.length === 0 ? [] : normalized.split(/\s+/).filter(Boolean);
};
