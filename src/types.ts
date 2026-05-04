export interface QuranAyah {
  id: number;
  surah_id: number;
  ayat_id: number;
  text: string;
}

export interface QuranAyahEntry {
  id: number;
  surah_id: number;
  ayat_id: number;
  clean_text: string;
  display_text: string;
  normalized_text: string;
  words: string[];
}

export interface MatchedWord {
  word: string;
  target_index: number;
  user_index: number;
}

export interface MissingWord {
  word: string;
  target_index: number;
}

export interface ExtraWord {
  word: string;
  user_index: number;
}

export interface IncorrectWord {
  expected: string;
  actual: string;
  target_index: number;
  user_index: number;
  similarity: number;
}

export interface WordComparisonResult {
  accuracy: number;
  score: number;
  exact_match_count: number;
  missing_words: MissingWord[];
  extra_words: ExtraWord[];
  incorrect_words: IncorrectWord[];
  matched_words: MatchedWord[];
}

export interface MatchOptions {
  surah_id?: number;
  ayat_id?: number;
}

export interface BestMatchResult {
  ayah: QuranAyahEntry;
  confidence: number;
  comparison: WordComparisonResult;
}

export type TajwidRuleName = 'madd' | 'ghunnah' | 'waqf' | 'basic_qalqalah';

export interface TajwidRuleAnnotation {
  rule_id: string;
  rule: TajwidRuleName;
  word_index: number;
  word: string;
  char_start: number;
  char_end: number;
  expected: Record<string, string | number | boolean>;
  metadata?: {
    trigger?: string;
    note?: string;
    snippet?: string;
  };
}

export interface TajwidAyahAnnotations {
  id: number;
  surah_id: number;
  ayat_id: number;
  rules: TajwidRuleAnnotation[];
}

export interface TajwidRulePresenceSummary {
  rule_id: string;
  rule: TajwidRuleName;
  word_index: number;
  word: string;
  snippet: string;
  note?: string;
}

export interface TajwidDetectedMistake {
  rule: TajwidRuleName;
  rule_id: string;
  word: string;
  word_index: number;
  status: 'incorrect' | 'warning';
  message: string;
  confidence?: number;
  metrics?: Record<string, string | number | boolean>;
}

export interface TajwidWorkerRequest {
  request_id: string;
  surah_id: number;
  ayat_id: number;
  ayah_id: number;
  expected_clean_text: string;
  expected_display_text: string;
  transcript_normalized: string;
  target_words: string[];
  rules: TajwidRuleAnnotation[];
}

export interface TajwidWorkerResponse {
  status: 'analyzed' | 'unavailable';
  mode: 'audio_analysis';
  worker_version: string;
  overall_score?: number;
  alignment_confidence?: number;
  mistakes: TajwidDetectedMistake[];
  warnings: string[];
  message?: string;
}

export interface TajwidWorkerMeta {
  attempted: boolean;
  enabled: boolean;
  configured: boolean;
  url?: string;
  worker_version?: string;
  alignment_confidence?: number;
  warnings: string[];
}

export interface TajwidAnalysis {
  supported: boolean;
  mode: 'transcript_only' | 'audio_analysis';
  status: 'disabled' | 'unsupported' | 'unavailable' | 'analyzed';
  overall_score?: number;
  mistakes: TajwidDetectedMistake[];
  message: string;
  reason: string;
  next_step: string;
  annotations: {
    total_rules: number;
    rules_present: TajwidRulePresenceSummary[];
  };
  worker: TajwidWorkerMeta;
}

export interface TajwidCapabilities {
  enabled: boolean;
  mode: 'transcript_only' | 'audio_analysis';
  worker_configured: boolean;
  supported_rules: TajwidRuleName[];
  timeout_ms: number;
}

export interface CheckResponse {
  success: true;
  transcript: {
    raw: string;
    normalized: string;
    words: string[];
  };
  detected: {
    surah_id: number;
    ayat_id: number;
    id: number;
    confidence: number;
  };
  target: {
    clean_text: string;
    display_text: string;
    words: string[];
  };
  result: {
    accuracy: number;
    missing_words: MissingWord[];
    extra_words: ExtraWord[];
    incorrect_words: IncorrectWord[];
    matched_words: MatchedWord[];
  };
  tajwid: TajwidAnalysis;
}
