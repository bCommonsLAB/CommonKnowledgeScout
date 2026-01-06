# Audio jobs without template (Transcript-only): analysis + options (2026-01-06)

## Observation (from production trace)

An audio job was started "without template" (user intent), but the stored job document contains:

- `parameters.template = "Besprechung"`
- `phases.template = true`
- `phases.ingest = true`

The callback pipeline then correctly tries to run the template phase and fails with:

> Template "Besprechung" not found in library ...

This means the system currently treats the audio flow as **extract → template → ingest** even when the user intends **extract only** (transcript markdown only).

## Likely root causes (multiple plausible)

1. The UI sends a human label (e.g. "Besprechung") instead of a template key (e.g. `wikientry`) and the backend treats it as a key.
2. The backend applies a default template name when the UI leaves the template empty.
3. Phases/policies defaults set `template=true` and `ingest=true` for audio, independent of `template` being empty.

All of these are consistent with the trace: template processing was initiated although the intent was "no template".

## Requirements (explicit)

- If the user starts an audio transcription **without selecting a template**, the system must:
  - produce the transcript markdown (Shadow‑Twin transcript artifact)
  - not attempt any template transformation
  - not run ingestion (unless explicitly requested elsewhere)
  - finish the job successfully (`status=completed`) with a meaningful `result.savedItemId`

## Options (3 variants)

### Variant A (strict, recommended): template is optional; no template → extract-only

Behavior:
- If `template` is missing/empty, force `phases.template=false` and `phases.ingest=false`.
- On callback completion, treat the transcript artifact as the final output and set `result.savedItemId` to the transcript file id.

Pros:
- Matches user intent and is deterministic.
- Avoids implicit behavior and prevents "template_not_found" failures.

Cons:
- Changes semantics: "audio" jobs without template no longer run ingest by default.

### Variant B (backwards compatible): template missing → use a library default template

Behavior:
- If `template` is missing/empty, pick a configured default (e.g. `wikientry`).

Pros:
- Keeps full pipeline running with minimal user input.

Cons:
- Violates the user's explicit intent ("no template").
- Requires a new per-library setting and a migration strategy.

### Variant C (aliasing): accept display names and map to keys

Behavior:
- Map "Besprechung" → `wikientry` (or another key) via aliases.

Pros:
- Robust UX if the UI sends human labels.

Cons:
- Hidden mapping can become another "shadow config".
- Still does not solve the "no template" intent unless combined with Variant A.

## Decision

Implement Variant A: "no template" must mean transcript-only. Add guardrails in the job start path so we never store a non-empty template when the UI did not select one.


