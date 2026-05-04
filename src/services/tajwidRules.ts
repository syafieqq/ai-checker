import type { TajwidRuleName } from '../types.js';

export const SUPPORTED_TAJWID_RULES: TajwidRuleName[] = [
  'madd',
  'ghunnah',
  'waqf',
  'basic_qalqalah',
];

export const DEFAULT_TAJWID_WORKER_TIMEOUT_MS = 15_000;
