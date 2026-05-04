# API Reference

## Base URL

Local:

```text
http://localhost:3000
```

Production:

```text
https://your-project.vercel.app
```

## Conventions

- Content type for uploads: `multipart/form-data`
- All success responses are JSON
- Audio is processed in-memory only
- Audio files are not stored
- `ayat_id` may only be used when `surah_id` is also provided

## Errors

Common error shape:

```json
{
  "success": false,
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Audio file is required."
  }
}
```

Typical error codes:

- `FILE_REQUIRED`
- `UNSUPPORTED_AUDIO_TYPE`
- `FILE_TOO_LARGE`
- `INVALID_FIELD`
- `INVALID_LOOKUP_SCOPE`
- `EMPTY_TRANSCRIPT`
- `SURAH_NOT_FOUND`
- `AYAH_NOT_FOUND`
- `TRANSCRIPTION_NOT_CONFIGURED`
- `TRANSCRIPTION_FAILED`
- `NOT_FOUND`

## `GET /`

Basic status endpoint.

### Response

```json
{
  "name": "Quran Smart Checker API",
  "status": "ok"
}
```

### Curl

```bash
curl "http://localhost:3000/"
```

## `GET /health`

Health and dataset readiness endpoint.

### Response

```json
{
  "status": "ok",
  "quranLoaded": true,
  "totalAyahs": 6348
}
```

### Curl

```bash
curl "http://localhost:3000/health"
```

## `POST /api/transcribe`

Receives an audio file and returns only the OpenAI transcript.

### Request

`multipart/form-data`

Fields:

- `file` required

### Validation

- `file` is required
- max size is `15MB`
- allowed MIME types:
  - `audio/m4a`
  - `audio/mp4`
  - `audio/mpeg`
  - `audio/wav`
  - `audio/webm`
  - `audio/x-m4a`

### Success response

```json
{
  "success": true,
  "transcript": "الحمد لله رب العالمين"
}
```

### Curl

```bash
curl -X POST "http://localhost:3000/api/transcribe" \
  -F "file=@sample.m4a"
```

## `POST /api/check`

Receives audio, transcribes it, finds the best matching Quran ayah inside the requested scope, and returns a full word-level comparison.

### Request

`multipart/form-data`

Fields:

- `file` required
- `surah_id` optional
- `ayat_id` optional, but only valid if `surah_id` is also provided

### Matching behavior

1. Validate upload.
2. Send audio to OpenAI transcription.
3. Normalize transcript with the backend Arabic normalizer.
4. Match scope:
   - If `surah_id` and `ayat_id` are present: compare only that ayah.
   - If `surah_id` is present: search only that surah.
   - If neither is present: search all local Quran data.
5. Score candidates using deterministic word alignment.
6. Return the dominant ayah and detailed comparison output.
7. Return an explicit `tajwid` status block.

### Response

```json
{
  "success": true,
  "transcript": {
    "raw": "الحمد لله رب العلمين",
    "normalized": "الحمد لله رب العلمين",
    "words": ["الحمد", "لله", "رب", "العلمين"]
  },
  "detected": {
    "surah_id": 1,
    "ayat_id": 2,
    "id": 2,
    "confidence": 0.95
  },
  "target": {
    "clean_text": "الحمد لله رب العالمين",
    "display_text": "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
    "words": ["الحمد", "لله", "رب", "العالمين"]
  },
  "result": {
    "accuracy": 95,
    "missing_words": [],
    "extra_words": [],
    "incorrect_words": [
      {
        "expected": "العالمين",
        "actual": "العلمين",
        "target_index": 3,
        "user_index": 3,
        "similarity": 0.875
      }
    ],
    "matched_words": [
      {
        "word": "الحمد",
        "target_index": 0,
        "user_index": 0
      },
      {
        "word": "لله",
        "target_index": 1,
        "user_index": 1
      },
      {
        "word": "رب",
        "target_index": 2,
        "user_index": 2
      }
    ]
  },
  "tajwid": {
    "supported": false,
    "mode": "transcript_only",
    "status": "disabled",
    "mistakes": [],
    "message": "Audio tajwid analysis is disabled. Returning annotated rules present in the target ayah only.",
    "reason": "This backend can identify tajwid rule locations from the Quran text, but real tajwid mistake detection requires an external audio analysis worker.",
    "next_step": "Set TAJWID_ENABLED=true and configure TAJWID_WORKER_URL to enable audio-based tajwid analysis.",
    "annotations": {
      "total_rules": 2,
      "rules_present": [
        {
          "rule_id": "1:2:0",
          "rule": "madd",
          "word_index": 3,
          "word": "ٱلْعَٰلَمِينَ",
          "snippet": "ٰ"
        },
        {
          "rule_id": "1:2:1",
          "rule": "waqf",
          "word_index": 3,
          "word": "ٱلْعَٰلَمِينَ",
          "snippet": "ن",
          "note": "End-of-ayah stopping point."
        }
      ]
    },
    "worker": {
      "attempted": false,
      "enabled": false,
      "configured": false,
      "warnings": []
    }
  }
}
```

### Curl

```bash
curl -X POST "http://localhost:3000/api/check" \
  -F "file=@sample.m4a" \
  -F "surah_id=1" \
  -F "ayat_id=2"
```

### Another curl example without scope

```bash
curl -X POST "http://localhost:3000/api/check" \
  -F "file=@sample.m4a"
```

### Notes

- `confidence` is a backend match score from `0` to `1`
- `accuracy` is a percentage from `0` to `100`
- comparison is deterministic and does not ask OpenAI to judge correctness
- `tajwid.annotations` lists the rule spans currently known for the target ayah
- `tajwid.supported` remains `false` until a real audio-analysis worker returns an analyzed response

## `GET /api/tajwid/capabilities`

Returns the active tajwid-analysis mode and supported rule families.

### Response

```json
{
  "enabled": false,
  "mode": "transcript_only",
  "worker_configured": false,
  "supported_rules": ["madd", "ghunnah", "waqf", "basic_qalqalah"],
  "timeout_ms": 15000
}
```

### Curl

```bash
curl "http://localhost:3000/api/tajwid/capabilities"
```

## `POST /api/tajwid/check`

Runs tajwid analysis for a known ayah target.

### Request

`multipart/form-data`

Fields:

- `file` required
- `surah_id` required
- `ayat_id` required

### Response

```json
{
  "success": true,
  "transcript": {
    "raw": "الحمد لله رب العالمين",
    "normalized": "الحمد لله رب العالمين",
    "words": ["الحمد", "لله", "رب", "العالمين"]
  },
  "target": {
    "id": 2,
    "surah_id": 1,
    "ayat_id": 2,
    "clean_text": "الحمد لله رب العالمين",
    "display_text": "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
    "words": ["الحمد", "لله", "رب", "العالمين"]
  },
  "tajwid": {
    "supported": false,
    "mode": "transcript_only",
    "status": "disabled",
    "mistakes": [],
    "message": "Audio tajwid analysis is disabled. Returning annotated rules present in the target ayah only.",
    "reason": "This backend can identify tajwid rule locations from the Quran text, but real tajwid mistake detection requires an external audio analysis worker.",
    "next_step": "Set TAJWID_ENABLED=true and configure TAJWID_WORKER_URL to enable audio-based tajwid analysis.",
    "annotations": {
      "total_rules": 2,
      "rules_present": [
        {
          "rule_id": "1:2:0",
          "rule": "madd",
          "word_index": 3,
          "word": "ٱلْعَٰلَمِينَ",
          "snippet": "ٰ"
        }
      ]
    },
    "worker": {
      "attempted": false,
      "enabled": false,
      "configured": false,
      "warnings": []
    }
  }
}
```

### Curl

```bash
curl -X POST "http://localhost:3000/api/tajwid/check" \
  -F "file=@sample.m4a" \
  -F "surah_id=1" \
  -F "ayat_id=2"
```

## `GET /api/surahs/:surah_id/ayahs`

Returns all ayahs for one surah using both clean and display text.

### Path params

- `surah_id` required integer

### Response

```json
{
  "surah_id": 1,
  "ayahs": [
    {
      "id": 1,
      "ayat_id": 1,
      "clean_text": "بسم الله الرحمن الرحيم",
      "display_text": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
    },
    {
      "id": 2,
      "ayat_id": 2,
      "clean_text": "الحمد لله رب العالمين",
      "display_text": "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ"
    }
  ]
}
```

### Curl

```bash
curl "http://localhost:3000/api/surahs/1/ayahs"
```

## Arabic Normalization

The backend uses `normalizeArabic(text: string): string`.

It:

- removes harakat and Quranic marks
- removes tatweel
- removes BOM
- normalizes:
  - `أ`, `إ`, `آ`, `ٱ` -> `ا`
  - `ى` -> `ي`
  - `ؤ` -> `و`
  - `ئ` -> `ي`
- removes punctuation
- normalizes whitespace
- trims

`splitWords(text: string): string[]` first normalizes, then splits on whitespace.

## Security Notes

- OpenAI API keys stay server-side only
- uploads are size-checked before processing
- the app returns safe JSON errors
- CORS is enabled for API consumption
- uploaded audio is not stored
- full audio content is not logged

## Important MVP Limitations

- This MVP checks word-level recitation based on transcription.
- It does not truly detect tajweed or makhraj yet.
- The `tajwid` response section now includes rule annotations and worker status.
- Real tajwid correctness still depends on audio analysis, not transcript text alone.
- Tajweed requires audio-level phoneme analysis later.
- Live STT on iOS can be used only for preview.
- Final checking should use uploaded audio transcription result.
