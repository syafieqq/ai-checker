# Tajwid Foundation

This project now includes the foundation layer for future audio-based tajwid checking.

## What Exists Now

- `data/quran_tajwid_rules.json`
  - per-ayah tajwid rule annotations
- `scripts/generate-tajwid-rules.ts`
  - regenerates the annotation dataset from `data/quran_texts.json`
- `src/services/tajwidAnnotations.ts`
  - loads and queries annotation data
- `src/services/tajwidOrchestrator.ts`
  - decides whether to call an external tajwid worker
- `src/services/tajwidFallback.ts`
  - returns safe fallback responses when audio analysis is unavailable
- `src/routes/tajwid.ts`
  - exposes tajwid capabilities and direct tajwid checking endpoints
- `worker/mock-server.ts`
  - mock audio-analysis worker for contract testing

## Supported Rule Families

Current rule families in the annotation layer:

- `madd`
- `ghunnah`
- `waqf`
- `basic_qalqalah`

Important:

- these annotations show where rules are present in the target ayah
- they do not prove the user recited them correctly
- real correctness still requires audio analysis

## Environment Variables

API:

```bash
TAJWID_ENABLED=false
TAJWID_WORKER_URL=
TAJWID_WORKER_TIMEOUT_MS=15000
```

When `TAJWID_ENABLED=false`, the API returns:

- detected rule locations
- transcript-based word checking
- a `tajwid.status` of `disabled`

When `TAJWID_ENABLED=true` and `TAJWID_WORKER_URL` is set:

- the API sends the audio and ayah payload to the worker
- if the worker succeeds, `tajwid.status` becomes `analyzed`
- if the worker fails, the API falls back safely to `unavailable`

## Mock Worker

Run the mock worker:

```bash
npm run worker:dev
```

Default URL:

```text
http://localhost:4001/analyze
```

Suggested local setup:

```bash
TAJWID_ENABLED=true
TAJWID_WORKER_URL=http://localhost:4001/analyze
```

The mock worker does not perform real audio analysis. It only validates the request contract and returns a mocked `analyzed` response.

## Regenerating Rule Annotations

```bash
npm run generate:tajwid-rules
```

This script uses heuristic text parsing over the display Quran text. It is good enough for foundation work, but not a final scholarly annotation source.

## New Endpoints

### `GET /api/tajwid/capabilities`

Returns whether audio tajwid analysis is enabled and which rule families are supported.

### `POST /api/tajwid/check`

Accepts:

- `file`
- `surah_id`
- `ayat_id`

Returns:

- transcript
- target ayah
- tajwid analysis object

## Next Real Step

Replace the mock worker with a real audio-analysis service that can:

- align recitation audio to expected words
- measure durations and pauses
- evaluate rule-specific acoustic features
- return real tajwid mistakes with confidence
