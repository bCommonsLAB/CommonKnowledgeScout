# Hand-off: B2d — Bilder/Assets ins Ziel spiegeln (Variante V2)

Datum: 2026-06-17
Branch: `claude/confident-maxwell-9sz7cq`
Vorgelagerte Analyse: `docs/analysis/wizard-transcript-only-assets-mirror.md`
Bezug: `docs/analysis/wizard-promotion-shadow-twin-angleichung.md` (B2a erledigt)

## 1. Auftrag

Variante **V2** umsetzen: Beim Promote von „Nur importieren und transkribieren"
(docType=transcript) die beim Extract erzeugten **Bilder/Assets** aus der
**Inbox-Quarantäne** in das **Ziel-Archiv** spiegeln — über den
`ShadowTwinService` des **Ziels**, sodass die FS/Mongo-Entscheidung an EINER
Stelle bleibt (keine Doppelprogrammierung).

## 2. Was bereits steht (committed auf dem Branch)

- 5a „Nur importieren und transkribieren" (Backend/Route/Client/UI).
- Jobworker-Anstoß bei Wizard-Analyse (`tickNow`).
- Befund A: Abschluss-Pfade vereinheitlicht → `src/lib/external-jobs/finalize-completion.ts`
  (extract-only macht jetzt den Submission-Rückfluss; Transkript fliesst zurück).
- B1: Original-PDF wird beim Promote aus der Inbox ins Ziel kopiert.
- B2a: Transkript wird als **Shadow-Twin der Ziel-PDF** abgelegt (kein Standalone,
  kein Ingest); Wizard-Wortlaut „Im Archiv speichern" statt „publizieren";
  Navigation ins Archiv statt Galerie.

Letzte Commits:
```
19762431 docs(analysis): B2d ... (Varianten + Empfehlung V2)
192685ff feat(submissions): Original kopieren + transcript-only als Shadow-Twin (B1/B2a)
62945fc3 refactor(external-jobs): Abschluss-Pfade vereinheitlichen (finalize-completion)
35dafab4 fix(wizard): Jobworker bei Wizard-Analyse sofort anstossen
```

## 3. Befund (wo liegen die Assets?)

- Extract läuft im **Inbox-Scope** (`providerScope='inbox'`). `resolveShadowTwinLibrary`
  → `null` → `getShadowTwinConfig(null)` = `primaryStore='filesystem'`,
  `persistToFilesystem=true`. Bilder werden also als **Dateien im Shadow-Twin-
  Dot-Folder des Inbox-Providers** abgelegt (Azure-Blob-Inbox).
- `job.result.savedItems` listet die erzeugten Inbox-Item-IDs (Transkript + Bilder).
- Submission kennt die Assets NICHT (`applyAnalysisResult` schreibt nur
  `markdownBody`+`metadata`). Der **Job** kennt sie via `correlation.options.submissionId`.
- Ziel-Store entscheidet das „Wie": FS-Ziel → Dateien im Ziel-Dot-Folder;
  **Mongo-Ziel (OneDrive-Test-Lib) → Mongo-Binary-Fragmente** (keine Dateien).

## 4. ZUERST prüfen (offene Punkte vor dem Coden)

1. **Fragment-API des `ShadowTwinService`**: Wie speist man Bild-Bytes ein?
   Kandidaten in `src/lib/shadow-twin/store/shadow-twin-service.ts`:
   - `upsertMarkdown({ ..., binaryFragments })` (Region ~Z. 293–360)
   - `uploadBinaryFragment` / die Methode mit Rückgabe `{ fragment, thumbnailFragment, markdown, artifactId }` (Region ~Z. 778–881).
   Klären: Übergabe (Blob/Base64), Varianten (`page-render`/`thumbnail`),
   Idempotenz/Dedup, ob FS-Ziel dabei den Dot-Folder nutzt.
2. **Asset-Enumeration**: Quelle der Liste wählen —
   (a) Inbox-Shadow-Twin-Ordner über `findShadowTwinFolder(parentId, name, inboxProvider)`
   (`src/lib/storage/shadow-twin.ts`) listen, oder
   (b) `job.result.savedItems` lesen → dafür Repo-Query „Job per submissionId"
   in `src/lib/external-jobs-repository.ts` ergänzen (existiert noch nicht; nur
   `listByUserEmail`/`listByUserWithFilters`). **Empfehlung: (a)** ist
   job-unabhängig und konsistent mit der Shadow-Twin-Logik.
3. **Bild-Referenzen im Transkript**: Wie referenziert der Extract Bilder
   (relative Namen `page_NNN.png` vs. Streaming-URLs)? Müssen Links beim Spiegeln
   auf Ziel-Fragment-URLs normalisiert werden, oder macht das der Renderer beim
   Lesen? (Blick in `src/lib/external-jobs/images.ts` + Service/Renderer.)
4. **Idempotenz**: Re-Promote darf keine Fragmente duplizieren (Service ist i.d.R.
   deterministisch — verifizieren).

## 5. Umsetzungs-Skizze (V2)

- `src/lib/submissions/promotion-transcript.ts`: im transcript-Pfad nach dem
  Transkript-Write einen **Asset-Schritt** über eine INJIZIERTE Funktion
  (`mirrorAssets?: (...) => Promise<...>`) aufrufen — `promotion.ts` bleibt
  storage-agnostisch (gleiches Muster wie `writeTranscriptArtifact`).
- `src/lib/submissions/promote-actions.ts`: Injektion bauen —
  Inbox-Shadow-Twin der Quell-PDF finden + Bytes lesen (`getInboxProvider`),
  dann je Asset über den **Ziel**-`ShadowTwinService` (gleicher wie B2a) als
  Fragment ablegen. FS/Mongo entscheidet der Service.
- Tests: `tests/unit/submissions/promotion.test.ts` (Asset-Schritt mit Mock-
  Injektion: wird aufgerufen, idempotent, leitet Bytes durch).

## 6. Wichtige Code-Anker

- `src/lib/external-jobs/extract-only.ts` — `runExtractOnly` (Bild-Erzeugung im
  Inbox-Scope; `processAllImageSources`; `result.savedItems`).
- `src/lib/external-jobs/images.ts` — `processAllImageSources`.
- `src/lib/shadow-twin/store/shadow-twin-service.ts` — Fragment-/Markdown-APIs.
- `src/lib/shadow-twin/artifact-writer.ts` — `writeArtifact` (Dot-Folder).
- `src/lib/storage/shadow-twin.ts` — `findShadowTwinFolder`, `generateShadowTwinFolderName`.
- `src/lib/submissions/promotion-transcript.ts` — `promoteTranscriptOnly` (B2a).
- `src/lib/submissions/promote-actions.ts` — `writeTranscriptArtifact`-Injektion (B2a).
- `src/lib/storage/inbox/inbox-provider-entry.ts` — `getInboxProvider`.

## 7. Regeln / Definition of Done

- Code engl., Kommentare/Commits dt., Dateien ≤200 Z. (sonst splitten), kein
  `any`/leeres `catch`, keine Silent-Fallbacks, UI kennt kein Storage-Backend.
- Pro Scheibe `pnpm test` + `pnpm lint` grün.
- Auf dem Branch committen, kein PR ohne Auftrag.
- KEINE Doppelung der FS/Mongo-Fragment-Logik — über den `ShadowTwinService` gehen.

## 8. Empfehlung Modell / Agent

- Modell: **Sonnet, Thinking medium-high** (klar abgegrenzt, aber storage-nah).
- Agent: **neuer Agent** (frischer Kontext); Analyse-Doc + dieses Hand-off zuerst lesen.

## 9. Start-Prompt (kopierbar)

> Lies `docs/wizards/b2d-assets-mirror-handover.md` und
> `docs/analysis/wizard-transcript-only-assets-mirror.md`. Branch
> `claude/confident-maxwell-9sz7cq`. Setze **B2d Variante V2** um: beim Promote von
> transcript-only (docType=transcript) die beim Extract erzeugten Bilder/Assets aus
> der Inbox-Quarantäne ins Ziel-Archiv spiegeln — über den `ShadowTwinService` des
> Ziels (FS/Mongo an einer Stelle, KEINE Doppelung). Kläre zuerst die offenen Punkte
> aus §4 (Fragment-API, Asset-Enumeration via `findShadowTwinFolder`, Bildlink-
> Normalisierung, Idempotenz) und dokumentiere die Mikro-Entscheidung kurz, bevor du
> codest. Halte `promotion.ts` storage-agnostisch (injizierte `mirrorAssets`-Funktion,
> Muster wie `writeTranscriptArtifact`). Regeln: Code engl., Kommentare/Commits dt.,
> ≤200 Z., kein any/leeres catch, keine Silent-Fallbacks. Nach jeder Scheibe
> `pnpm test` + `pnpm lint` grün, dann committen (kein PR). Reihenfolge: B2d-1
> Asset-Enumeration → B2d-2 Spiegeln über Service (FS+Mongo, idempotent) → B2d-3
> Bildlink-Normalisierung (falls nötig).

## 10. Kosten-Schätzung

Mittel: ~1–2 Scheiben mit Service-Inspektion + Tests; grob 1.5–3 USD je nach
Iterationen (kein `pnpm build` nötig).
