# Hand-off — Wizard-Generalisierung & Inbox-Flow

> Übergabe lokale Session → Cloud-Session. Stand 2026-06-02.
> Branch: `claude/knowledge-scout-wizard-ux-yjOwS` (gepusht).

## 1. Was in dieser Session entstand (alles committet)

**Entscheidungen**
- **O1 (Feld-Bindung) entschieden:** generisch, schema-getrieben (nicht
  rollenbasiert). Dokumentiert in `docs/adr/0003-...` (Nachtrag 2026-06-02).
- **Inbox-Flow-Entscheidungen** (für ADR-0004): Abnahme nur **inhaltliche**
  Pflichtfelder; **Confidence**-Hervorhebung; Freigabe nur `co-creator`/`owner`;
  Excel + Write-Key/QR = spätere Scheiben; Aufbewahrung pro Library (Default 30 T).

**Code (gebaut + getestet)**
- `src/lib/creation/wizard-flow.ts` — reine Wizard-Logik aus dem Monolithen
  gelöst (Step-Filter, `canProceed`, Renderer-Auflösung, Kompatibilität).
  Tests: `tests/unit/creation/wizard-flow.test.ts`, `wizard-concepts.test.ts`.
- `src/lib/detail-view-types/content-fields.ts` — **B6**: `contentRequiredFields`
  (Registry-requiredFields ohne technische Felder). Test: `content-fields.test.ts`.
- `src/lib/creation/editable-fields.ts` — **Phase 3a-1**: `editableContentFields`
  (Schema-Felder ohne System-Felder), im Wizard als generischer Fallback
  verdrahtet. Beweis-Test: `editable-fields.test.ts` (== handgeschriebene
  editDraft.fields für alle 5 Vorlagen).

**Doku** (`docs/wizards/`): `README.md`, 5 Wizard-Konzepte (event, testimonial,
dialograum, pc-steckbrief, event-final), Flow `dokument-upload-analyse-publizieren.md`
+ `-bestandsaufnahme.md`, `abnahme-inbox-plan.md`.

**Prüfstand:** Kitchen-Sink-Library in lokale **Dev-DB** geseedet (nur lokal,
nicht in der Cloud verfügbar). Helfer: `scripts/seed-test-library.ts`,
`scripts/inspect-test-library.ts`, `scripts/list-libraries.ts`.

## 2. Vor jedem Merge (Pflicht)

```bash
bash scripts/welle-pre-merge-check.sh
```
Im Cloud-Agent zusätzlich: `pnpm test` + `pnpm lint` (kein `pnpm build`).

## 3. Nächste Schritte (Auswahl, noch offen)

| Option | Inhalt | Risiko |
|---|---|---|
| **Phase 3a-2** | Render-Hinweise generisch (Bild/Textfläche/Array) aus `edit-draft-step.tsx` ins Schema verlagern | **UI-sichtbar → lokal im Browser prüfen** |
| **Phase 3a-3** | Renderer-Drift beheben: Wizard-Preview alle 8 Typen (statt 4 + `session`-Fallback) | **UI-sichtbar → lokal im Browser prüfen** |
| **Inbox W1** | Submission-Datenmodell + MongoDB-Repo + Azure-Blob-Inbox (kein UI) | mittel; braucht lokale DB zum echten Test |
| **Inbox W4** | Abnahme-UI (nutzt B6 + Confidence) | nach W1/W2 |

⚠️ **Cloud-Grenze:** Die Cloud kann **nicht seeden, keine DB/keinen Browser
betreiben**. 3a-2/3a-3 (UI) und Inbox-DB-Arbeit am besten **lokal** verifizieren.
Reine Logik + Tests (z.B. Inbox-Repo-Logik, weitere reine Funktionen) sind
cloud-tauglich.

## 4. Empfehlung Modell & Agent

- **Modell:** Sonnet mit „think" reicht für 3a-2/3a-3 und W1 (klar abgegrenzt,
  testgetrieben). Opus nur, falls das Inbox-Datenmodell größer/architektonisch wird.
- **Agent-Typ:** **neuer Agent** (frischer Kontext). Pflichtlektüre zu Beginn:
  `.cursorrules`, alle `.cursor/rules/*.mdc` mit `alwaysApply`, `AGENTS.md`,
  `docs/adr/0003`, `docs/adr/0004`, dieses Hand-off, `docs/wizards/abnahme-inbox-plan.md`.

## 5. Start-Prompt für die Cloud-Session (kopierbar)

> Branch `claude/knowledge-scout-wizard-ux-yjOwS` (auschecken + pullen).
> Pflichtlektüre: `.cursorrules`, `.cursor/rules/*.mdc` (alwaysApply), `AGENTS.md`,
> `docs/wizards/HANDOFF.md`, `docs/adr/0003` + `0004`,
> `docs/wizards/abnahme-inbox-plan.md`.
> Ziel: **Inbox W1** umsetzen — Submission-Datenmodell + MongoDB-Repo (CRUD +
> Status-Übergänge als reine Funktionen) + Azure-Blob-Inbox-Referenzen, gemäß
> `abnahme-inbox-plan.md`. **Keine** Provider-Schreibzugriffe (ADR-0004-Invariante).
> Tests schreiben (Vitest), `pnpm test` + `pnpm lint` grün. Kein `pnpm build`.
> Regeln: Code englisch, Kommentare/Commits deutsch; Dateien ≤200 Zeilen; kein
> `any`/kein leeres `catch`; keine Silent Fallbacks. Auf demselben Branch
> committen, **keinen PR ohne Auftrag**.
> (3a-2/3a-3 sind UI-sichtbar → lokal verifizieren, nicht in der Cloud.)

## 6. Kosten-Schätzung

- Inbox W1 (reines Datenmodell + Repo + Tests): grob **2–4 USD** (Sonnet, kein Build).
- Phase 3a-2/3a-3 besser lokal (Browser-Verifikation nötig).
