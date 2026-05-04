# Quran Smart Checker API

API-only backend for uploading Quran recitation audio, transcribing it with OpenAI, normalizing the Arabic transcript, detecting the most likely ayah, and returning deterministic word-level feedback.

## Overview

- Built with `Hono` + `TypeScript`
- Deployable to `Vercel` on the Node.js runtime
- Uses the OpenAI Audio Transcriptions API for speech-to-text only
- Uses local Quran JSON files in `/data`
- No database
- No audio storage
- No frontend

## What It Returns

`POST /api/check` returns:

- Raw transcript from OpenAI
- Normalized Arabic transcript
- Dominant detected `surah_id` and `ayat_id`
- Clean target text and display text with harakat
- `matched_words`
- `missing_words`
- `extra_words`
- `incorrect_words`
- Accuracy score
- A `tajwid` status block

## Project Structure

```text
src/
  index.ts
  server.ts
  routes/
    health.ts
    transcribe.ts
    check.ts
    surahs.ts
    tajwid.ts
  services/
    openaiTranscription.ts
    quranData.ts
    quranMatcher.ts
    tajwidAnnotations.ts
    tajwidFallback.ts
    tajwidOrchestrator.ts
    tajwidRules.ts
  utils/
    arabic.ts
    errors.ts
    uploads.ts
  types.ts
data/
  quran_texts.json
  quran_texts_clean.json
  quran_tajwid_rules.json
scripts/
  generate-tajwid-rules.ts
tests/
  arabic.test.ts
  matcher.test.ts
  tajwid.test.ts
  tajwidAnnotations.test.ts
  tajwidOrchestrator.test.ts
docs/
  API.md
  TAJWID.md
worker/
  mock-server.ts
vercel.json
package.json
tsconfig.json
vitest.config.ts
.env.example
```

## Setup

```bash
npm install
cp .env.example .env
```

Set:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
TAJWID_ENABLED=false
TAJWID_WORKER_URL=
TAJWID_WORKER_TIMEOUT_MS=15000
```

`OPENAI_TRANSCRIPTION_MODEL` is optional. If omitted, the app defaults to `gpt-4o-mini-transcribe`.

## Run Locally

```bash
npm run dev
```

Local development runs the Node server from [src/server.ts](/Users/admin/Desktop/Ai-Checker/src/server.ts:1) on `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run worker:dev
npm run generate:tajwid-rules
npm run build
npm run test
npm run lint
npm run typecheck
```

## Deploy To Vercel

1. Import the repository into Vercel.
2. Set `OPENAI_API_KEY` in the project environment variables.
3. Optionally set `OPENAI_TRANSCRIPTION_MODEL`.
4. Deploy.

Vercel will detect the Hono entrypoint from [src/index.ts](/Users/admin/Desktop/Ai-Checker/src/index.ts:1). The included [vercel.json](/Users/admin/Desktop/Ai-Checker/vercel.json:1) sets function limits only; the runtime remains Node.js.

## API

### `GET /`

Response:

```json
{
  "name": "Quran Smart Checker API",
  "status": "ok"
}
```

Curl:

```bash
curl "http://localhost:3000/"
```

### `GET /health`

Response:

```json
{
  "status": "ok",
  "quranLoaded": true,
  "totalAyahs": 6348
}
```

Curl:

```bash
curl "http://localhost:3000/health"
```

### `POST /api/transcribe`

Uploads one audio file and returns only the transcript.

Curl:

```bash
curl -X POST "http://localhost:3000/api/transcribe" \
  -F "file=@sample.m4a"
```

Example response:

```json
{
  "success": true,
  "transcript": "الحمد لله رب العالمين"
}
```

### `POST /api/check`

Uploads one audio file, transcribes it, detects the dominant ayah, and compares the recitation at the word level.

Curl:

```bash
curl -X POST "http://localhost:3000/api/check" \
  -F "file=@sample.m4a" \
  -F "surah_id=1" \
  -F "ayat_id=2"
```

Example response:

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

### `GET /api/tajwid/capabilities`

Returns whether audio tajwid analysis is enabled and which rule families are available.

Curl:

```bash
curl "http://localhost:3000/api/tajwid/capabilities"
```

Example response:

```json
{
  "enabled": false,
  "mode": "transcript_only",
  "worker_configured": false,
  "supported_rules": ["madd", "ghunnah", "waqf", "basic_qalqalah"],
  "timeout_ms": 15000
}
```

### `POST /api/tajwid/check`

Checks tajwid for a specific ayah target and returns transcript plus tajwid analysis.

Curl:

```bash
curl -X POST "http://localhost:3000/api/tajwid/check" \
  -F "file=@sample.m4a" \
  -F "surah_id=1" \
  -F "ayat_id=2"
```

### `GET /api/surahs/:surah_id/ayahs`

Returns all ayahs for a surah using both clean and display text.

Curl:

```bash
curl "http://localhost:3000/api/surahs/1/ayahs"
```

Example response:

```json
{
  "surah_id": 1,
  "ayahs": [
    {
      "id": 1,
      "ayat_id": 1,
      "clean_text": "بسم الله الرحمن الرحيم",
      "display_text": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
    }
  ]
}
```

Full API details are in [docs/API.md](/Users/admin/Desktop/Ai-Checker/docs/API.md:1). Tajwid foundation details are in [docs/TAJWID.md](/Users/admin/Desktop/Ai-Checker/docs/TAJWID.md:1).

## Upload Validation

- File is required
- Allowed MIME types:
  - `audio/m4a`
  - `audio/mp4`
  - `audio/mpeg`
  - `audio/wav`
  - `audio/webm`
  - `audio/x-m4a`
- Max size: `15MB`

## iOS Integration Notes

- On iOS, record audio locally and upload the final file with `multipart/form-data`.
- Live speech-to-text on device can be used only as a preview for the user.
- Final checking should use the uploaded audio transcription result from this backend.
- If you want ayah-focused checking, send `surah_id` and optionally `ayat_id` with the upload.
- If you enable the tajwid worker later, the same upload can drive both word-level checking and audio tajwid analysis.
- Do not send API keys from the iOS client. The OpenAI key must stay server-side only.

## Important Limitations

- This MVP checks word-level recitation based on transcription.
- It does not truly detect tajweed or makhraj yet.
- The API now returns tajwid rule annotations for the detected target ayah.
- Real tajwid mistake detection still requires an external audio analysis worker.
- Tajweed requires audio-level phoneme analysis later.
- Live STT on iOS can be used only for preview.
- Final checking should use uploaded audio transcription result.

## Verification

These commands were run successfully in this repo:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```
# ai-checker
