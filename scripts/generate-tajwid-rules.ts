import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { QuranAyah, TajwidAyahAnnotations, TajwidRuleAnnotation, TajwidRuleName } from '../src/types.js';

const INPUT_PATH = path.resolve(process.cwd(), 'data', 'quran_texts.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'data', 'quran_tajwid_rules.json');

const SHADDA = '\u0651';
const SUKUN = '\u0652';
const QALQALAH_LETTERS = new Set(['ق', 'ط', 'ب', 'ج', 'د']);

const buildRuleId = (ayah: QuranAyah, index: number): string => {
  return `${ayah.surah_id}:${ayah.ayat_id}:${index}`;
};

const pushRule = (
  rules: TajwidRuleAnnotation[],
  ayah: QuranAyah,
  rule: TajwidRuleName,
  wordIndex: number,
  word: string,
  charStart: number,
  charEnd: number,
  expected: TajwidRuleAnnotation['expected'],
  metadata?: TajwidRuleAnnotation['metadata'],
) => {
  rules.push({
    rule_id: buildRuleId(ayah, rules.length),
    rule,
    word_index: wordIndex,
    word,
    char_start: charStart,
    char_end: charEnd,
    expected,
    ...(metadata ? { metadata } : {}),
  });
};

const addMaddRules = (rules: TajwidRuleAnnotation[], ayah: QuranAyah, word: string, wordIndex: number) => {
  const patterns = [
    { regex: /َا/gu, label: 'fatha_alif', spanShift: 1 },
    { regex: /ُو/gu, label: 'damma_waw', spanShift: 1 },
    { regex: /ِي/gu, label: 'kasra_ya', spanShift: 1 },
    { regex: /ٰ/gu, label: 'dagger_alif', spanShift: 0 },
  ] as const;

  for (const pattern of patterns) {
    for (const match of word.matchAll(pattern.regex)) {
      const rawIndex = match.index ?? 0;
      const charIndex = Math.min(word.length - 1, rawIndex + pattern.spanShift);
      pushRule(
        rules,
        ayah,
        'madd',
        wordIndex,
        word,
        charIndex,
        charIndex,
        {
          mode: 'relative_duration',
          target_ratio_min: 1.8,
          target_ratio_max: 3.2,
        },
        {
          trigger: pattern.label,
          snippet: word.slice(charIndex, charIndex + 1),
          note: 'Approximate madd annotation generated from script heuristics.',
        },
      );
    }
  }
};

const addGhunnahRules = (rules: TajwidRuleAnnotation[], ayah: QuranAyah, word: string, wordIndex: number) => {
  for (let index = 0; index < word.length - 1; index += 1) {
    const char = word[index];
    const next = word[index + 1];
    if ((char === 'ن' || char === 'م') && next === SHADDA) {
      pushRule(
        rules,
        ayah,
        'ghunnah',
        wordIndex,
        word,
        index,
        index + 1,
        {
          mode: 'nasalization',
          target_ratio_min: 1.2,
          target_ratio_max: 2.6,
        },
        {
          trigger: 'shaddah_on_mim_or_nun',
          snippet: word.slice(index, index + 2),
          note: 'Approximate ghunnah annotation generated from shaddah on mim or nun.',
        },
      );
    }
  }
};

const addQalqalahRules = (rules: TajwidRuleAnnotation[], ayah: QuranAyah, word: string, wordIndex: number) => {
  for (let index = 0; index < word.length - 1; index += 1) {
    const char = word[index];
    const next = word[index + 1];

    if (char && next === SUKUN && QALQALAH_LETTERS.has(char)) {
      pushRule(
        rules,
        ayah,
        'basic_qalqalah',
        wordIndex,
        word,
        index,
        index + 1,
        {
          mode: 'release_burst',
          target_strength: 'medium',
        },
        {
          trigger: 'qalqalah_letter_with_sukun',
          snippet: word.slice(index, index + 2),
          note: 'Approximate qalqalah annotation for letters with sukun.',
        },
      );
    }
  }
};

const addWaqfRule = (rules: TajwidRuleAnnotation[], ayah: QuranAyah, words: string[]) => {
  const wordIndex = Math.max(0, words.length - 1);
  const word = words[wordIndex] ?? ayah.text;
  const endIndex = Math.max(0, word.length - 1);

  pushRule(
    rules,
    ayah,
    'waqf',
    wordIndex,
    word,
    endIndex,
    endIndex,
    {
      mode: 'pause',
      preferred_stop: true,
      min_pause_ms: 120,
    },
    {
      trigger: 'end_of_ayah',
      snippet: word.slice(endIndex),
      note: 'End-of-ayah stopping point.',
    },
  );
};

const dedupeRules = (rules: TajwidRuleAnnotation[]): TajwidRuleAnnotation[] => {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = `${rule.rule}:${rule.word_index}:${rule.char_start}:${rule.char_end}:${rule.metadata?.trigger ?? ''}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const main = async () => {
  const raw = await readFile(INPUT_PATH, 'utf8');
  const ayahs = JSON.parse(raw) as QuranAyah[];
  const annotations: TajwidAyahAnnotations[] = ayahs.map((ayah) => {
    const words = ayah.text.split(/\s+/).filter(Boolean);
    const rules: TajwidRuleAnnotation[] = [];

    words.forEach((word, wordIndex) => {
      addMaddRules(rules, ayah, word, wordIndex);
      addGhunnahRules(rules, ayah, word, wordIndex);
      addQalqalahRules(rules, ayah, word, wordIndex);
    });

    addWaqfRule(rules, ayah, words);

    return {
      id: ayah.id,
      surah_id: ayah.surah_id,
      ayat_id: ayah.ayat_id,
      rules: dedupeRules(rules),
    };
  });

  await writeFile(OUTPUT_PATH, `${JSON.stringify(annotations, null, 2)}\n`, 'utf8');

  const totalRules = annotations.reduce((count, ayah) => count + ayah.rules.length, 0);
  console.log(`Generated ${annotations.length} ayah annotation records with ${totalRules} tajwid rules.`);
};

await main();
