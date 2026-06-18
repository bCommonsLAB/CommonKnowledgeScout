# Analyse: Wizard-Promotion an das Shadow-Twin-Modell angleichen (Befund B2)

Status: Entscheidung getroffen — V1, transcript-only zuerst
Datum: 2026-06-17
Bezug: `docs/architecture/shadow-twin.md`, ADR-0004, Befund B (B1 erledigt)

## 0. Praezisierung (User, 2026-06-17) — WICHTIG

„Nur importieren und transkribieren" (transcript-only) ist ein **Ausnahmefall**
und entspricht NUR dem **Extract-Schritt** eines External Jobs:

- Datei ins Archiv (PDF = Traeger) + **Transkript als Shadow-Twin** der PDF.
- **Keine** Transformation, **keine** Publikation, **kein** RAG-Ingest.
- Summary-Button „Im Archiv öffnen" zeigt auf das **Archiv** (Datei-Browser am
  Ordner), NICHT auf den Explorer/die Galerie.

Der **Normalfall** (Dokumententyp gewaehlt) macht Transformation **und**
Publikation (heutiges Verhalten) — bleibt vorerst unveraendert.

Gate: `submission.docType === 'transcript'` (deterministisch im Wizard gesetzt,
`creation-wizard.tsx` transcriptOnly-Zweig). Damit entfaellt B2b (RAG-Keying)
fuer transcript-only komplett.

## 1. Problem / Befund

Die Wizard-Promotion (`promoteSubmission`) schreibt das erfasste Markdown als
**eigenstaendige `<slug>.md`-Datei** in den Zielordner und ingestet diese unter
**eigener fileId**. Der Owner sieht im Archiv lose:

```
godaddy_peter2.pdf            (B1: Original liegt jetzt dort)
slug-kurz-slug-optional.md    (Standalone-Transkript — FALSCH)
```

Erwartung (Architektur-Doc) ist dagegen, dass die **PDF der Traeger** ist und das
Transkript ein **Shadow-Twin-Artefakt** der PDF — als Datei nur, wenn
`persistToFilesystem` aktiv ist, sonst nur in Mongo.

## 2. Soll-Modell (Quelle: `docs/architecture/shadow-twin.md`)

```
godaddy_peter2.pdf            ← Traeger (fileId, RAG-Key)
.godaddy_peter2.pdf/          ← Dot-Folder (nur wenn persistToFilesystem)
└── godaddy_peter2.de.md      ← Transkript-Artefakt {base}.{lang}.md
```

- Transkript = `kind='transcript'`, Inhalt „typically without frontmatter".
- RAG-Ingestion ist auf die **Quell-fileId (PDF)** gekeyt (Doc Z. 47).
- Store-Wahl (Mongo vs. Filesystem) trifft `ShadowTwinService` anhand
  `getShadowTwinConfig(library)` — UI/Promotion kennt das Backend nicht.

## 3. Divergenz im Code (Ist)

| Aspekt | Archiv-Pfad (kanonisch) | Wizard-Promotion (Ist) |
| --- | --- | --- |
| Schreiben | `persistShadowTwinToMongo` / `writeArtifact` als Artefakt der Quelle (`src/lib/external-jobs/storage.ts`) | `provider.uploadFile(<slug>.md)` Standalone (`src/lib/submissions/promotion.ts`) |
| Store-Wahl | `ShadowTwinService` (Mongo/FS je Config) | keine — immer Datei |
| RAG-Key | Quell-fileId | Standalone-md-fileId |

## 4. Verifizierte Fakten

- **RAG-Keying:** `IngestionService.upsertMarkdown(userEmail, libraryId, fileId, …)`
  loescht/setzt Vektoren per `fileId` (`deleteVectorsByFileId(libraryKey, fileId)`).
  Frontmatter wird im Markdown selbst geparst. → Re-Keying = einfach die
  **Ziel-PDF-fileId** uebergeben.
- **Artefakt-Inhalt:** `applyAnalysisResult` (`submission-analysis.ts`) schreibt
  Body → `submission.markdownBody` (reines Transkript, **ohne** Frontmatter) und
  merged Frontmatter → `submission.metadata`. Bei „transcript only" ist die
  Analyse-Metadata leer (`policies.metadata='ignore'`), darum bleiben die
  **Stufe-A-Platzhalter** (`{{slug|…}}`) in `metadata` — das ist die Ursache des
  Platzhalter-Bugs (separat, siehe §8).
- **Inbox-Scope** (`providerScope='inbox'`) hat bewusst **keinen** Mongo-Shadow-Twin
  (`storage.ts` Z. 178–187). Der Uebergang Inbox→Ziel ist also ein **Neu-Anlegen**
  im Ziel-Provider, kein Mongo-Move.
- **Config-Defaults:** `getShadowTwinConfig` → `primaryStore` Default `filesystem`,
  `persistToFilesystem` = (Flag || primaryStore==='filesystem').

## 5. Varianten

### V1 — `ShadowTwinService` im Promotion-Pfad (empfohlen)
Promotion kopiert das Original (B1) und registriert das Transkript ueber denselben
Service wie das Archiv:
`ShadowTwinService.create({ library: ZielLibrary, sourceId: ZielPdfId,
sourceName, parentId: Zielordner }).upsertMarkdown({ kind:'transcript',
targetLanguage, markdown: submission.markdownBody })`. RAG-Ingest auf `ZielPdfId`.
Standalone-md entfaellt.
- Pro: nutzt exakt die kanonische Logik (Mongo/FS/Persist), keine 2. Implementierung.
- Contra: Promotion braucht jetzt die Ziel-`library` + Provider (heute nur schmaler
  `PromotionProvider`).

### V2 — Inbox-Shadow-Twin nach Ziel „re-home"
Kompletten Dot-Folder inkl. Binary-Fragmente cross-provider aus der Inbox kopieren
und Schluessel auf `ZielPdfId` umschreiben.
- Pro: vollstaendig inkl. Assets (Seiten-Bilder) in einem Schritt.
- Contra: rekursive Cross-Provider-Kopie + ID-Rekey; deutlich hoeheres Risiko;
  fuer einseitige PDFs Overkill.

### V3 — Minimal: nur Dateikonvention via `writeArtifact`
Transkript als `{base}.{lang}.md` in den Dot-Folder schreiben, ohne `primaryStore`/
Mongo zu beachten.
- Pro: kleinster Eingriff.
- Contra: ignoriert `primaryStore='mongo'`/`persistToFilesystem` → Verstoss gegen
  Storage-Abstraktion + erneute Doppellogik. **Nicht empfohlen.**

## 6. Empfehlung

**V1** fuer das Transkript (B2a–c). Assets (V2-Anteil) als spaetere Scheibe **B2d**,
nur fuer mehrseitige Medien mit Bild-Fragmenten — fuer den aktuellen PDF-Fall (kein
Bild) nicht noetig.

## 7. Slice-Schnitt (transcript-only zuerst)

- **B2a** — Promotion erkennt `docType==='transcript'` und legt statt einer
  Standalone-`<slug>.md` das **Transkript als Shadow-Twin der Ziel-PDF** ab:
  - Original kopieren (B1, erledigt) → Ziel-PDF-fileId als `sourceId`.
  - Transkript schreiben ueber die kanonischen Primitive: `writeArtifact`
    (Filesystem, Dot-Folder `.{pdf}/{base}.de.md`) bzw. `ShadowTwinService`
    (Mongo) — Wahl per `getShadowTwinConfig(library)`.
  - **Kein** RAG-Ingest, **kein** Standalone-Markdown (Ausnahmefall, §0).
  - `promote-actions.ts` injiziert die Schreib-Funktion (haelt `promotion.ts` rein).
- **B2-UI** — `creation-wizard.tsx`: bei transcript-only `publishTargetSlug`
  weglassen → „Im Archiv öffnen" navigiert in den Datei-Browser (Archiv), nicht
  in die Galerie; Meldung „Im Archiv gespeichert." statt „Veröffentlicht."
- **Normalfall (spaeter)** — Transformation+Publikation ebenfalls auf das
  Shadow-Twin-Modell ziehen (eigene Analyse/Scheiben): inkl. RAG-Keying auf die
  Quell-fileId und Binary-Fragmente (Seiten-Bilder).

Jede Scheibe: `pnpm test` + `pnpm lint` gruen, dann User-Test.

## 8. Offene Entscheidungen

1. **`kind` generisch:** Transcript-only → `transcript`. Voller Template-Flow →
   `transformation` + `templateName` (Contract-Pflicht, `shadow-twin-contracts.mdc`
   §1). Promotion muss `kind` aus der Submission ableiten. **Vorschlag:** B2 zuerst
   nur fuer transcript-only (was wir testen); Transformation-Pfad danach.
2. **`targetLanguage`:** Quelle? Secretary-Sprache vs. Default `de`. **Vorschlag:**
   `de` als dokumentierter Default, bis Sprach-Signal vorliegt.
3. **Platzhalter-Bug (`metadata`):** Da das Transkript **ohne** Frontmatter abgelegt
   wird, verschwindet das Symptom fuer das Transkript-Artefakt. Die `metadata`-
   Platzhalter gehoeren konzeptionell zu einer **Transformation**, nicht zum
   Transkript — separat zu loesen (eigener Befund).

## 9. fileId-Stabilitaet pro Backend

- Ziel-PDF wird **einmal** kopiert und danach **nicht** verschoben → fileId stabil.
- OneDrive: ID stabil solange nicht verschoben/umbenannt.
- Nextcloud/Filesystem: ID haengt am Pfad → nur stabil, wenn Datei am Platz bleibt.
  Genau deshalb keying auf die kopierte Ziel-PDF (kein spaeterer Move noetig).

## 10. Risiken / Tests

- Promotion bekommt mehr Abhaengigkeiten (Service/Library) → Pure-Logik vs. I/O
  trennen, Service injizierbar halten (testbar wie `upsertMarkdown` heute).
- Idempotenz: erneutes Promote darf Artefakt nur upserten (Service ist idempotent
  per ArtifactKey), Original nicht duplizieren (B1 deckt das ab).
- Tests: Transkript-Artefakt mit `kind='transcript'` + Ziel-fileId; kein
  Standalone-md mehr; RAG-Ingest-Key = Ziel-PDF.
