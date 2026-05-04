import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  TajwidAyahAnnotations,
  TajwidRuleAnnotation,
  TajwidRulePresenceSummary,
} from '../types.js';
import { AppError } from '../utils/errors.js';
import { SUPPORTED_TAJWID_RULES } from './tajwidRules.js';

interface TajwidAnnotationStore {
  byAyahId: Map<number, TajwidAyahAnnotations>;
  bySurahAyat: Map<string, TajwidAyahAnnotations>;
  totalAyahs: number;
  totalRules: number;
}

const tajwidRulesPath = path.resolve(process.cwd(), 'data', 'quran_tajwid_rules.json');

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isTajwidRuleName = (value: unknown): value is TajwidRuleAnnotation['rule'] => {
  return typeof value === 'string' && SUPPORTED_TAJWID_RULES.includes(value as TajwidRuleAnnotation['rule']);
};

const validateRule = (value: unknown, index: number): TajwidRuleAnnotation => {
  if (!isPlainObject(value)) {
    throw new Error(`Invalid tajwid rule at index ${index}.`);
  }

  const {
    rule_id,
    rule,
    word_index,
    word,
    char_start,
    char_end,
    expected,
    metadata,
  } = value;

  if (
    typeof rule_id !== 'string' ||
    !isTajwidRuleName(rule) ||
    typeof word_index !== 'number' ||
    typeof word !== 'string' ||
    typeof char_start !== 'number' ||
    typeof char_end !== 'number' ||
    !isPlainObject(expected)
  ) {
    throw new Error(`Invalid tajwid rule structure at index ${index}.`);
  }

  if (metadata !== undefined && !isPlainObject(metadata)) {
    throw new Error(`Invalid tajwid rule metadata at index ${index}.`);
  }

  return {
    rule_id,
    rule,
    word_index,
    word,
    char_start,
    char_end,
    expected: Object.fromEntries(
      Object.entries(expected).filter(([, item]) => {
        return ['string', 'number', 'boolean'].includes(typeof item);
      }),
    ) as Record<string, string | number | boolean>,
    ...(metadata === undefined
      ? {}
      : {
          metadata: {
            ...(typeof metadata.trigger === 'string' ? { trigger: metadata.trigger } : {}),
            ...(typeof metadata.note === 'string' ? { note: metadata.note } : {}),
            ...(typeof metadata.snippet === 'string' ? { snippet: metadata.snippet } : {}),
          },
        }),
  };
};

const buildTajwidAnnotationStore = (): TajwidAnnotationStore => {
  try {
    const raw = readFileSync(tajwidRulesPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('Expected an array of tajwid annotations.');
    }

    const byAyahId = new Map<number, TajwidAyahAnnotations>();
    const bySurahAyat = new Map<string, TajwidAyahAnnotations>();
    let totalRules = 0;

    parsed.forEach((item, index) => {
      if (!isPlainObject(item)) {
        throw new Error(`Invalid tajwid ayah record at index ${index}.`);
      }

      const { id, surah_id, ayat_id, rules } = item;
      if (
        typeof id !== 'number' ||
        typeof surah_id !== 'number' ||
        typeof ayat_id !== 'number' ||
        !Array.isArray(rules)
      ) {
        throw new Error(`Invalid tajwid ayah structure at index ${index}.`);
      }

      const annotation: TajwidAyahAnnotations = {
        id,
        surah_id,
        ayat_id,
        rules: rules.map((rule, ruleIndex) => validateRule(rule, ruleIndex)),
      };

      totalRules += annotation.rules.length;
      byAyahId.set(annotation.id, annotation);
      bySurahAyat.set(`${annotation.surah_id}:${annotation.ayat_id}`, annotation);
    });

    return {
      byAyahId,
      bySurahAyat,
      totalAyahs: byAyahId.size,
      totalRules,
    };
  } catch {
    throw new AppError(500, 'Failed to load tajwid annotations.', 'TAJWID_DATA_ERROR', {
      expose: false,
    });
  }
};

const store = buildTajwidAnnotationStore();

export const getTajwidAnnotationsByAyahId = (
  ayahId: number,
): TajwidAyahAnnotations | undefined => {
  return store.byAyahId.get(ayahId);
};

export const getTajwidAnnotationsBySurahAyat = (
  surahId: number,
  ayatId: number,
): TajwidAyahAnnotations | undefined => {
  return store.bySurahAyat.get(`${surahId}:${ayatId}`);
};

export const summarizeTajwidAnnotations = (
  annotations?: TajwidAyahAnnotations,
): { total_rules: number; rules_present: TajwidRulePresenceSummary[] } => {
  const rules = annotations?.rules ?? [];

  return {
    total_rules: rules.length,
    rules_present: rules.map((rule) => ({
      rule_id: rule.rule_id,
      rule: rule.rule,
      word_index: rule.word_index,
      word: rule.word,
      snippet:
        rule.metadata?.snippet ??
        rule.word.slice(
          Math.max(0, rule.char_start),
          Math.min(rule.word.length, rule.char_end + 1),
        ),
      ...(rule.metadata?.note ? { note: rule.metadata.note } : {}),
    })),
  };
};

export const getTajwidDatasetStats = () => ({
  totalAyahs: store.totalAyahs,
  totalRules: store.totalRules,
});
