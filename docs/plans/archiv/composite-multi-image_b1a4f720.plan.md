---
name: composite-multi-image
overview: "Neues, paralleles Sammel-Konzept fuer Bilder (`kind: composite-multi`). Mehrere Bilddateien werden als virtuelle Sammelquelle persistiert (Markdown mit Wiki-Embeds), beim Analyse-Run laedt der Worker alle Bild-Binaries und ruft den (vom User parallel zu bauenden) Multi-Image-Endpoint des Secretary auf. Bestehende `composite-transcript`-Logik fuer Text-/Audio-/Video-Quellen bleibt UNVERAENDERT (coexist)."
todos:
  - id: s1-build-fn
    content: "src/lib/creation/composite-multi.ts: `buildCompositeMultiReference()` analog zu `buildCompositeReference`, aber `kind: composite-multi`. Bilder erscheinen in Quellen-Liste (mit Reihenfolge) UND als Wiki-Embeds (`![[page_009.jpeg]]`). Frontmatter: `_source_files: [...]`, `kind: composite-multi`, `createdAt`. Akzeptiert nur Bild-Quellen (Validierung: alles muss `isImageMediaFromName`==true)."
    status: pending
  - id: s1-build-tests
    content: "tests/unit/creation/composite-multi-build.test.ts: Markdown-Output enthaelt richtigen Frontmatter (kind, _source_files), Quellen-Liste in der richtigen Reihenfolge, Wiki-Embeds. Validierung: wirft, wenn Nicht-Bild-Quelle dabei ist (klare Fehlermeldung)."
    status: pending
  - id: s2-resolve-fn
    content: "src/lib/creation/composite-multi.ts: `resolveCompositeMulti()` parst `_source_files`, laedt fuer jeden Bild-Namen das Binary via `provider.getBinary()`. Gibt strukturiertes Ergebnis zurueck: `{ contextMarkdown: string, imageBinaries: Array<{ name, buffer, mimeType }>, unresolvedSources: string[] }`. `contextMarkdown` enthaelt eine kurze Quellen-Tabelle, KEINE base64-Daten (die kommen separat als Buffer)."
    status: pending
  - id: s2-resolve-tests
    content: "tests/unit/creation/composite-multi-resolve.test.ts: Mock-Provider liefert Binaries fuer 3 Bilder; Funktion gibt 3 imageBinaries + 0 unresolved zurueck. Edge-Case: ein Bild fehlt im Verzeichnis -> 1 unresolved + 2 imageBinaries. Edge-Case: leeres _source_files -> wirft."
    status: pending
  - id: s3-api-route
    content: "src/app/api/library/[libraryId]/composite-multi/route.ts: POST-Endpoint analog zu composite-transcript-route. Body: `{ sourceItems, filename, targetLanguage? }` — `filename` kommt aus dem UI-Dialog. Validation: 2..10 Items (Secretary-Limit), alle Bild-MIME-Type, Filename muss valider .md-Dateiname sein. Erzeugt Markdown via `buildCompositeMultiReference()` und persistiert es im Storage neben den Quellen."
    status: pending
  - id: s3-api-tests
    content: "tests/unit/api/composite-multi-route.test.ts: Auth-Pfad (401), Validation (400 bei <2 Items, 400 bei >10 Items, 400 bei Nicht-Bild, 400 bei ungueltigem Filename), Happy-Path (200, Datei im Storage)."
    status: pending
  - id: s4-adapter-erweitern
    content: "src/lib/secretary/image-analyzer.ts: `callImageAnalyzerTemplate` um `files?: Array<{ file, fileName, mimeType }>` erweitern (zusaetzlich zum bestehenden `file`-Feld fuer Single-Image-Backwards-Compat). Im FormData fuer jedes Bild ein `formData.append('files', blob, fileName)` setzen. Single-Pfad bleibt durch das `file`-Feld unveraendert; ein Aufruf mit `files`-Array nutzt das neue Multi-Image-Feature des Secretary-Endpoints."
    status: pending
  - id: s4-adapter-tests
    content: "tests/unit/secretary/image-analyzer-multi.test.ts: Aufruf mit `files`-Array konstruiert FormData mit N `files`-Eintraegen (richtige Reihenfolge, Filenames, MIME-Types). Aufruf mit Legacy-`file`-Feld konstruiert wie bisher genau ein `file`-Feld (Backwards-Compat). Fehler-Pfad: 4xx-Response wird zu HttpError mit Body."
    status: pending
  - id: s5-loader-erweitern
    content: "src/lib/external-jobs/phase-shadow-twin-loader.ts: zusaetzlich zu `kind: composite-transcript` auch `kind: composite-multi` erkennen. Bei composite-multi: NICHT in Text-Markdown flatten (das liefe auf `/transformer/template`), sondern Marker setzen, sodass die Job-Pipeline den Multi-Image-Pfad waehlt."
    status: pending
  - id: s5-job-pipeline
    content: "src/app/api/external/jobs/[jobId]/start/route.ts: Image-Analyzer-Pfad (Zeilen ~1236-1495) erweitern: wenn die Quelle eine Markdown-Datei mit `kind: composite-multi` ist, statt einer einzelnen `provider.getBinary(sourceItemId)`-Ladung die `resolveCompositeMulti()`-Funktion aufrufen, alle Binaries laden und an `callImageAnalyzerTemplate({ files: [...] })` weiterreichen (Multi-Pfad des erweiterten Adapters). ALTERNATIV: eigener job_type 'image_composite' (im Plan-Verlauf entscheiden)."
    status: pending
  - id: s5-pipeline-tests
    content: "Tests fuer Pipeline-Integration: Composite-Multi-Markdown als Quelle laeuft durch Image-Pfad und liefert ein Shadow-Twin-Ergebnis am Composite-MD selbst (NICHT an einem Einzelbild)."
    status: pending
  - id: s6-ui-multiselect
    content: "src/components/library/file-list.tsx: Toolbar-Aktion 'Sammelanalyse erstellen' (oder 'Bilder zusammen analysieren'), aktiv wenn `selectedTransformationItems.length >= 2 && alle == Bild`. Aufruf der composite-multi API; nach Erfolg: Datei oeffnen / Toast."
    status: pending
  - id: s7-preview-grid
    content: "src/components/library/markdown-preview.tsx (oder file-preview.tsx): Bei `kind: composite-multi` Grid der eingebetteten Bilder anzeigen (analog zur Mehrbild-Vorschau auf dem User-Mockup). Wikilink-Resolver wiederverwenden, der bereits im composite-transcript-Pfad existiert."
    status: pending
  - id: s8-e2e-manual
    content: "Manuelles Test-Szenario dokumentieren: 3 Page-Renderings (page_009..page_011 von CORTINA) selektieren -> 'Sammelanalyse' -> composite-multi-MD erscheint im Verzeichnis -> 'Analysieren'-Button -> Job laeuft -> Steckbrief im Markdown-Output enthaelt Konfigurationstabellen aus allen 3 Bildern."
    status: pending
isProject: false
---

# Composite Multi-Image: Bild-Sammelanalyse als paralleles Konzept

## Ziel

Mehrere Bilder zusammen analysieren lassen, sodass ein Vision-LLM **alle Bilder gleichzeitig** im selben Prompt sieht. Use-Case: Bett-Steckbrief CORTINA verteilt sich uber `page_009__cortina.jpeg`, `page_010__cortina.jpeg`, `page_011__cortina.jpeg` — Konfigurationstabellen, Massbilder und Holzart-Auswahl auf verschiedenen Seiten ergeben EIN Datenblatt.

## Architektur-Entscheidung

Nach Diskussion mit dem Anwender:

- **`image_only`**: Bestehende `composite-transcript`-Logik bleibt unveraendert. Wir bauen eine **parallele**, schmale Logik nur fuer reine Bild-Sammlungen.
- **`coexist`**: Zwei `kind`-Werte im Frontmatter nebeneinander:
  - `kind: composite-transcript` — heutiges Sammel-Transkript fuer Text/Audio/Video/Office (unveraendert)
  - `kind: composite-multi` — neue Bild-Sammelanalyse
- Mixed-Content (PDF + Bilder im selben Composite) ist **nicht** Teil dieses Plans. Der CORTINA-Use-Case ist rein bildbasiert. Mixed-Content kann in einem Folge-Plan vereinheitlicht werden (s.u. „Offen fuer spaeter").

## Warum nicht voll vereinheitlichen?

- Die heutige `resolveCompositeTranscript`-Funktion erzeugt **Text-Markdown** mit `<source>`-Bloecken und schickt es an den Text-Endpoint `/transformer/template`. Bilder sind heute nur Datei-Namen-Erwaehnungen, keine Pixel.
- Eine vollstaendige Vereinigung wuerde bedeuten:
  - resolver muss zwei Output-Kanaele (Text + Binaries) liefern
  - phase-template muss zwischen Text- und Vision-Endpoint verzweigen
  - kind-Migration der existierenden composite-transcript-Dateien
  - Mehr Risiko, mehr Test-Last
- Der parallele Ansatz hier liefert den CORTINA-Use-Case ohne Risiko fuer den bestehenden Sammel-Transkript-Workflow.

## Datenfluss

```
[User selektiert N Bilder im Archiv]
        |
        v
[POST /api/library/.../composite-multi]
        |
        v
[buildCompositeMultiReference -> Markdown im Storage]
        |   kind: composite-multi
        |   _source_files: [page_009.jpeg, page_010.jpeg, ...]
        |
        v
[User klickt 'Analysieren' am Composite-MD]
        |
        v
[Job-Pipeline: Image-Analyzer-Pfad in start/route.ts]
        |
        v
[loader erkennt kind: composite-multi]
        |
        v
[resolveCompositeMulti -> { contextMarkdown, imageBinaries[] }]
        |
        v
[callImageAnalyzerTemplate({ files: [...] }) -> /api/image-analyzer/process (Multi-Pfad)]
        |
        v
[Markdown-Antwort -> Shadow-Twin am Composite-MD]
```

## Designentscheidungen

- **Frontmatter-Schluessel**: `kind: composite-multi` (deutlich abgrenzbar von `composite-transcript`).
- **Nur Bilder erlaubt**: Validierung in `buildCompositeMultiReference` und der API-Route. Wirft hart, wenn Nicht-Bild dabei ist (kein silent skip).
- **Max. 10 Bilder pro Composite**: Hartes Limit aus der Secretary-Spec (`ImageAnalyzerProcessor.MAX_IMAGES_PER_REQUEST`). Validierung sowohl im UI (Toolbar deaktiviert sich >10) als auch in der API-Route (400-Antwort) als auch im Build-Helfer (wirft).
- **Filename**: User wird im UI-Dialog nach dem Namen gefragt (Wahl aus Q vom Anwender). Default-Vorschlag im Dialog: `<gemeinsamer-praefix>_zusammenstellung.md` falls erkennbar, sonst `zusammenstellung.md`. Kollisions-Check bei API: 409-Antwort, wenn Datei mit dem Namen existiert.
- **Quellen-Reihenfolge**: Reihenfolge in der Dateiliste (wie sie sortiert ist), nicht Klick-Reihenfolge. Begruendung: deterministisch und vom User leicht steuerbar via Sortierwechsel der Liste vor der Selektion. Reihenfolge wird in `_source_files` festgehalten und ist Teil des Secretary-Cache-Keys (siehe Doku).
- **Speicherort**: Im Quellverzeichnis neben den Bildern (analog composite-transcript).
- **Resultat-Speicherung**: Shadow-Twin am Composite-MD selbst (Anker = Sammeldatei). Einzelbild-Twins bleiben unveraendert.
- **Provider-Hinweis**: Multi-Image-Calls funktionieren laut Secretary-Doku nur mit Provider `openrouter`. Andere Provider werfen `ProcessingError`. Wir dokumentieren das im Adapter-Header und reichen den Fehler 1:1 durch (kein silent fallback).
- **useCache-Default**: `false` (gleicher Schutz wie Single-Image-Pfad nach jetziger Aenderung in start/route.ts).

## Schritte (Reihenfolge zwingend, wenn nicht anders markiert)

### S1 + S2: Composite-Multi-Modul (autark, ohne Server-Abhaengigkeiten)

`src/lib/creation/composite-multi.ts`:
- `buildCompositeMultiReference(options)` — Markdown-Erzeugung, ohne Storage-Calls
- `resolveCompositeMulti(options)` — Binary-Loading via Provider, im Speicher

Tests: Mocks fuer Provider; keine Mongo-Calls noetig.

### S3: API-Route (autark)

`src/app/api/library/[libraryId]/composite-multi/route.ts`:
- POST-Endpoint mit Body `{ sourceItems: [...], targetLanguage? }`
- Auth via Clerk wie bei composite-transcript-Route
- Persistierung via `provider.upsertMarkdown()` oder vergleichbar

### S4: Secretary-Adapter erweitern (entblockiert)

Spec `docs/_secretary-service-docu/image-analyzer.md` (Stand 2026-04-27) klaert:

- **Endpoint bleibt** `POST /api/image-analyzer/process` — Multi-Image ist eine **Erweiterung** des bestehenden Endpoints, kein neuer Pfad.
- **Form-Feld**: `files` (repeatable). Pro Bild ein `formData.append('files', blob, fileName)`.
- **Backwards-Compat**: Das alte `file`-Feld bleibt funktional; `file` und `files` koennen sogar kombiniert werden.
- **Limit**: Max. 10 Bilder pro Request.
- **Provider**: Nur `openrouter` unterstuetzt Multi-Image.

Konsequenz fuer den Code:

- Wir bauen **keinen** neuen Adapter `image-analyzer-multi.ts`.
- Wir erweitern `callImageAnalyzerTemplate` um einen optionalen `files`-Parameter. Bei vorhandenem `files` wird statt `file` (Single-Path) das Multi-Path benutzt. Single-Path bleibt unveraendert.

### S5: Pipeline-Integration

- Loader erkennt `kind: composite-multi` und markiert den Job entsprechend
- Im Image-Analyzer-Pfad in `start/route.ts`: bei composite-multi statt eines einzelnen Binarys die Resolution-Funktion aufrufen und Multi-Image-Adapter nutzen.
- Entscheidung in S5 zu treffen: eigener `job_type: 'image_composite'` oder Re-use von `job_type: 'image'`/`'markdown'` mit Sub-Logik?

### S6 + S7: UI

- Multi-Select-Toolbar-Aktion in `file-list.tsx`
- Vorschau-Grid in `markdown-preview.tsx` / `file-preview.tsx`

### S8: Manuelles E2E

User-Test mit CORTINA-Page-Renderings.

## Stop-Bedingungen

- Secretary-Multi-Image-Endpoint **geklaert** (siehe S4-Beschreibung). Kein Block mehr.
- Wenn S5-Implementierung > 200 LOC Diff erzeugen wuerde -> aufteilen in 5a/5b
- Wenn `phase-shadow-twin-loader.ts`-Aenderung den `composite-transcript`-Pfad bricht (Tests rot) -> Aenderung ruecknehmen, paralleler Pfad statt Erweiterung
- Wenn Multi-Image-Aufruf gegen den Secretary mit `ProcessingError "multi-image not supported"` antwortet -> der Library-Provider ist nicht `openrouter`. Klare Fehlermeldung an den User, kein retry / kein silent fallback.

## Offen fuer spaeter (NICHT Teil dieses Plans)

- Mixed-Content (z.B. PDF-Quelle + Bilder als ergaenzende Vision-Inputs)
- Zusammenfuehrung von `composite-transcript` + `composite-multi` zu einem einzigen `composite-source`-Konzept (erfordert Migration bestehender Composites + grundsaetzliche Architektur-Diskussion)
- Reorder-UI fuer Composite-Multi (Drag-and-drop Bild-Reihenfolge nach Erstellung)
- Loeschen einzelner Quellen aus einem Composite-Multi nach Erstellung

## Tests pro Schritt (Pflicht-Liste)

- S1: Unit-Tests fuer `buildCompositeMultiReference` (Output-Format, Validierung)
- S2: Unit-Tests fuer `resolveCompositeMulti` (Mock-Provider, Edge-Cases)
- S3: Route-Tests (Auth, Validation, Happy-Path)
- S4: Adapter-Tests (FormData-Konstruktion, Fehler-Mapping) — sobald Endpoint klar
- S5: Pipeline-Tests (Composite-Multi durchlaeuft Image-Pfad)
- S6: Komponenten-Test (Toolbar-Sichtbarkeit, Click-Handler)
- S7: Snapshot-Test fuer Grid-Vorschau
- S8: Manuelles E2E (siehe `s8-e2e-manual`)

## Notizen

- AGENTS.md fordert Audit-File bei Modul-Refactors. Hier liegt KEIN Refactor vor (composite-transcript bleibt unveraendert), daher kein Audit unter `docs/refactor/composite-multi-image/` noetig. Sollte sich das aendern (z.B. spaetere Vereinigung) -> Audit-File nachholen.
- `useCache` im Multi-Image-Adapter folgt dem Pattern aus `secretary-request.ts`: Default `false`, Opt-In ueber Job-Optionen.
