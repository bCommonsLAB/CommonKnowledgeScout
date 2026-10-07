# Agent-Brief P3b: Reiter „Korrektur" am Audio-Transkript

Paket P3b des Plans [`von-menschen-gepruefte-veranstaltung.plan.md`](von-menschen-gepruefte-veranstaltung.plan.md).
Owner-Entscheidung 08.10.2026: **eigener Reiter am Transkript, gebaut wie der
Reiter „Transformation"**, nicht Teil der Werkbank.

## Ziel

Zwischen Transkript und Vorlage bestätigt ein Mensch zwei Dinge: welche
Hörfehler bei Namen, Zahlen und Fachbegriffen korrigiert werden, und welche
Person hinter einem Sprecher-Label steckt. Der Secretary liefert dafür nur
Vorschläge (P2, `POST /api/transcript/korrekturvorschlag`); geschrieben wird
erst nach Bestätigung, mit der Semantik aus Wunschliste 7
(`transkript_korrigieren`). Nach dem Schreiben gelten vorhandene
Transformationen als überholt.

Abnahme (aus dem Plan): Die Diskussion der Journalistenschulung wird ohne
Obsidian korrigiert und bestätigt; der Reiter „Transformation" zeigt
„überholt" und bietet „Neu generieren".

## Was es schon gibt (nicht neu bauen)

| Baustein | Ort | Verwenden für |
|---|---|---|
| Vorschlags-Endpunkt (P2) | Secretary `POST /api/transcript/korrekturvorschlag`, Vertrag in [`docs/_secretary-service-docu/transcript.md`](../_secretary-service-docu/transcript.md) | Vorschläge holen. Zusicherung: `alt` kommt genau einmal vor, `beleg` ∈ `einladung`, `folie <N>`, `selbstvorstellung`, `unsicher` |
| Secretary-Zugang aus Routen | `getSecretaryConfig()` in `src/lib/env.ts`, Muster `src/app/api/secretary/import-from-url/route.ts` | Proxy-Route, nie aus dem Client direkt |
| Ersetzungen anwenden | `wendeErsetzungenAn` in `src/lib/mcp/transkript-korrektur.ts` (`Ersetzung { alt, neu, alle? }`, Fehler `ErsetzungNichtGefundenError`, `ErsetzungNichtEindeutigError`) | Body-Ersetzung, alles oder nichts |
| Schreibweg der Brücke | `korrigiereTranskript` in `src/lib/mcp/transkript-korrektur-schreiben.ts` | Kern herauslösen (siehe Schritt 2); der Spiegel-Riegel bleibt MCP-spezifisch |
| Revisions-Stempel | `REVISED_BY_BRUECKE`, `revised_by/revised_at/revision_note` in `transkript-korrektur-typen.ts` | UI stempelt mit der E-Mail des Anwenders, nicht mit `claude/cowork` |
| Frontmatter | `parseFrontmatter`, `createMarkdownWithFrontmatter`, `patchFrontmatter` (einziger Serializer, Contract `frontmatter-single-serializer`) | `speakers` lesen, `speaker_names` schreiben |
| Sprecherliste | `speakers` flach im Transkript-Frontmatter (`src/lib/external-jobs/audio-speakers.ts`), Präfixe `**Stück n Sprecher X:**` je Absatz | Zuordnungsliste vorbelegen |
| Begleittexte im Ordner | `POST /api/library/[libraryId]/artifacts/batch-resolve` (`sources[]`), Transkript-Inhalt über `GET …/shadow-twins/content?sourceId&kind=transcript&targetLanguage` | Auswahl der Begleitdokumente |
| Reiter-Mechanik | [`file-preview-tab-architecture.md`](../architecture/file-preview-tab-architecture.md): Union `PreviewInfoTab` in `views/view-props.ts`, `useState` in `file-preview.tsx`, Trigger und Inhalt in `views/audio-view.tsx` | neuer Wert `'correction'` |
| Vorbild für den Reiter | Reiter „Transformation" in `audio-view.tsx` (Kopfzeile mit Hinweistext links, Knöpfe rechts, Inhalt im Rahmen) | gleiche Anmutung |

## Entscheidungen, die feststehen

1. **Nur Audio.** Der Reiter erscheint in `audio-view.tsx`, nur wenn ein
   Transkript vorhanden ist. Für PDF und Video gibt es ihn nicht.
2. **Zwei Listen, eine Bestätigung.** Ersetzungen und Sprecher-Zuordnung
   sind getrennte Listen mit je annehmen, ablehnen, ändern; ein Knopf
   „Bestätigen und schreiben" schreibt beides in einem Zug, alles oder nichts.
3. **Sprecher-Zuordnung schreibt zweifach:** Im Body wird jedes Präfix
   `**Stück n Sprecher X:**` durch `**Name:**` ersetzt (eine `Ersetzung` mit
   `alle: true` je Label); im Frontmatter bleibt `speakers` (die Labels,
   Herkunft) und es kommt flach `speaker_names` dazu, eine Liste von Strings
   der Form `Stück 1 Sprecher A: Dr. Anna Mahlknecht`. Nicht zugeordnete Labels
   bleiben im Body stehen und fehlen in `speaker_names`. Keine verschachtelten
   Objekte (Frontmatter-Regel in `AGENTS.md`).
4. **Namen nur, wenn belegt.** Vorschläge mit `beleg: unsicher` sind in der
   Liste vorab abgewählt und so markiert; der Mensch kann sie trotzdem
   annehmen. Ein frei eingetippter Name im Feld „ändern" ist erlaubt, wird
   aber als `beleg: mensch` gestempelt (nur in der Antwort, nicht im Frontmatter).
5. **Schreibweg Mongo zuerst.** Das Transkript in MongoDB ist die führende
   Fassung. Der UI-Weg prüft `updatedAt` des Transkript-Records
   (`readTranscriptRecord`) als optimistischen Riegel: Der Client schickt den
   Stand, den er gelesen hat; weicht er ab, Antwort 409 mit Hinweis „neu
   laden". Danach Spiegel-Export nur, wenn `persistToFilesystem` gesetzt ist,
   über `ShadowTwinService.upsertMarkdown` ohne `skipFilesystemMirror`. Kein
   `ifVersion` und kein Drift-Guard des Spiegels im UI-Weg; das bleibt die
   Sache der Brücke.
6. **Überholt wird abgeleitet, nicht gespeichert.** Eine Transformation gilt
   als überholt, wenn `revised_at` des Transkripts jünger ist als
   `generated_at` der Transformation. Der Reiter „Transformation" zeigt dann
   neben dem Titel „überholt (Transkript korrigiert am …)" und den vorhandenen
   Knopf „Neu generieren". Kein neues Frontmatter-Feld, keine Re-Transformation
   von selbst (kostet Geld).
7. **Keine Korrektur ohne Vorschlag ist trotzdem möglich:** Die Listen lassen
   sich auch leer von Hand füllen (eine Zeile hinzufügen). Der Secretary-Aufruf
   ist optional, nicht Voraussetzung.

## Schritte (je Schritt ein Commit, Reihenfolge einhalten)

### Schritt 1: Vorschlags-Route

`POST /api/library/[libraryId]/sources/[sourceId]/transcript-correction/suggest`
(Pfad an die Konventionen in
[`api-route-conventions.md`](../architecture/api-route-conventions.md)
anpassen, Params awaiten, Clerk, Library über `LibraryService` mit E-Mail).
Body: `{ begleitSourceIds: string[], zielsprache?: string }`. Die Route lädt
das Audio-Transkript und die Transkripte der Begleitquellen aus MongoDB
(Server-seitig, nicht vom Client durchgereicht), ruft den Secretary mit
`getSecretaryConfig()` und gibt `ersetzungen`, `sprecher`, `verworfen`,
`modell`, `tokens`, `dauer_ms` unverändert zurück. Secretary-Fehlercodes
(`MISSING_TRANSKRIPT`, `INPUT_TOO_LARGE`, `NO_MODEL_CONFIGURED`, …) werden mit
Status und Code durchgereicht, nicht in „Unerwarteter Fehler" verwandelt
(Contract `no-silent-fallbacks`). Grenze 600.000 Zeichen vorab prüfen und mit
Zahl melden.

### Schritt 2: Schreibweg für die Oberfläche

Kern aus `korrigiereTranskript` herauslösen, ohne die Brücke zu brechen:
`wendeKorrekturAn({ record, ersetzungen, sprecher, revision })` liefert
`{ markdownNeu, belege, speakerNames }` (reine Funktion, testbar), und
`schreibeTranskriptKorrektur` macht den Mongo-Write plus optionalen
Spiegel-Export. `korrigiereTranskript` nutzt beides und behält Spiegel-Riegel,
`ifVersion` und `REVISED_BY_BRUECKE`. Bestehende Tests in
`tests/unit/mcp/` müssen unverändert grün bleiben.

Route `POST …/transcript-correction/apply` mit Body
`{ ersetzungen: Ersetzung[], sprecher: { label, name }[], begruendung, ifUpdatedAt }`.
Stempel: `revised_by` = E-Mail des Anwenders, `revised_at` = jetzt,
`revision_note` = `begruendung`. Antwort wie `KorrekturErgebnis` plus
`speakerNames` und die Liste der nun überholten Transformationen.

### Schritt 3: Reiter „Korrektur"

- `PreviewInfoTab` um `'correction'` erweitern (beide Stellen laut
  Tab-Architektur), Trigger „Korrektur" in `audio-view.tsx` nach „Transkript",
  nur sichtbar mit Transkript.
- Inhalt in einer eigenen Datei `views/audio-correction-tab.tsx` (unter
  200 Zeilen; Listen in `audio-correction-lists.tsx` auslagern). Aufbau wie
  der Reiter „Transformation": Kopfzeile links „Hörfehler und Sprecher
  bestätigen, dann schreiben", rechts die Knöpfe.
- Block 1 „Begleitdokumente": Checkbox-Liste der Quellen desselben Ordners,
  die ein Transkript haben (PDF, Markdown), vorbelegt mit allen PDFs; darunter
  „Vorschläge holen" (ruft Schritt 1, zeigt Modell, Tokens, Dauer und
  `verworfen` aufklappbar).
- Block 2 „Ersetzungen": je Zeile Checkbox, `alt` → `neu` (editierbar),
  `zeile`, `kontext`, `beleg`, `begruendung`; „Zeile hinzufügen".
- Block 3 „Sprecher": je Label aus `speakers` eine Zeile mit Vorschlag
  `name` (editierbar), `beleg`, `begruendung`; Checkbox vorab aus bei
  `unsicher`.
- Fußzeile: „Vorschau" (ruft `apply` mit `nurVorschau: true`, zeigt Diff der
  betroffenen Zeilen) und „Bestätigen und schreiben". Nach Erfolg: Transkript
  neu laden, Toast mit Zahl der Ersetzungen und zugeordneten Sprecher, Hinweis
  auf überholte Transformationen mit Sprung in den Reiter „Transformation".
- Bei 409: Meldung „Das Transkript wurde inzwischen geändert, bitte neu laden",
  keine stille Wiederholung.

### Schritt 4: „überholt" im Reiter Transformation

Ableitung nach Entscheidung 6 in `audio-view.tsx` (oder einem kleinen Hook
`use-transformation-stale.ts`): Badge neben „Story-Inhalte und Metadaten …",
Text „überholt, Transkript korrigiert am <Datum>". Keine Änderung am Pipeline-Sheet.

### Schritt 5: Tests und Doku

- Unit: `wendeKorrekturAn` (Ersetzungen plus Sprecher, `speaker_names`,
  Fehler bei nicht eindeutigem `alt`, nicht zugeordnete Labels bleiben),
  Suggest-Route (Secretary-Mock, Fehlercode-Durchreichung), Apply-Route
  (409 bei veraltetem `ifUpdatedAt`, alles oder nichts), Ableitung „überholt".
- Bestehende Tests der Brücke (`tests/unit/mcp/transkript-*`) bleiben grün.
- Doku: Abschnitt „Korrektur" in
  [`file-preview-tab-architecture.md`](../architecture/file-preview-tab-architecture.md)
  (Referenzzeile), Plan-Stand im Abschnitt „Stand" des Plans fortschreiben.

## Contracts und Regeln

- Routing-Index in `CLAUDE.md`: `src/components/library/**` →
  `contracts-ui`; `src/lib/mcp/**` bleibt vertragstreu zur Brücke
  (`tools-transkript-korrigieren.ts` ändert sein Verhalten nicht).
- `no-silent-fallbacks`: kein stilles Weglassen von Vorschlägen, keine
  geratenen Namen, Fehlercodes durchreichen.
- Frontmatter flach, nur über den zentralen Serializer.
- Dateien unter 200 Zeilen, kein `any`, Commit-Messages auf Deutsch.
- `pnpm test`, `pnpm lint`, vollständiger `tsc` mit Vorher-Nachher-Vergleich
  (Anleitung in `AGENTS.md`), vor dem Merge `bash scripts/welle-pre-merge-check.sh`.

## Prüffall

Library „Dachverband für Soziales" (`3559f1ee-0c99-4356-869a-75c1e31c2179`),
Ordner `events/Journalisten Schulung`. Vorbereitung: Die Diskussion (Teil 4)
hat seit 06.10. ein Sprecher-Transkript ohne `speakers`; einmal über
„Transkript neu generieren" mit Schalter „Sprecher erkennen" neu erzeugen
(Secretary auf `127.0.0.1:5001`, ~0,30 USD, rund 8 Minuten; Stücke über
10 Minuten können in den KS-Watchdog laufen, siehe Plan-Stand, Befund
07.10.; der Heartbeat im Secretary ist bestellt, aber zurückgestellt).
Begleitdokumente: der Flyer (`26-09-25 Flyer Journalistenschulung_.pdf`) und
die beiden Folien-PDFs. Soll:

- Vorschläge enthalten die beiden Referentinnen mit `beleg: einladung` oder
  `selbstvorstellung`; Publikumsfragen bleiben Label.
- Nach „Bestätigen und schreiben": Body mit Namen als Präfix, Frontmatter mit
  `speakers`, `speaker_names`, `revised_by` (E-Mail), `revised_at`,
  `revision_note`; `generated_*` unverändert.
- Reiter „Transformation" zeigt „überholt"; „Neu generieren" führt zu einer
  Transformation ohne falsche Zuordnung (das ist bereits P4, nur
  Sichtprüfung).
- Zweiter Klick auf „Bestätigen" mit veraltetem Stand liefert 409.

Lokal aus einem Worktree: `.env` kopieren, `NEXT_PUBLIC_APP_URL` und
`INTERNAL_SELF_BASE_URL` auf den Port setzen und **einen eigenen
`JOBS_WORKER_POOL_ID`** vergeben, sonst zieht die Worktree-Instanz Jobs
anderer Sessions (Befund 07.10.).

## Stop-Bedingungen

Zusätzlich zu `AGENTS.md` §4: Wenn `korrigiereTranskript` sich nicht ohne
Verhaltensänderung der Brücke zerlegen lässt, stoppen und melden, statt die
Brücke anzupassen. Wenn der Secretary auf `korrekturvorschlag` mit
`NO_MODEL_CONFIGURED` antwortet, ist das Umfeld das Problem (Use-Case
`chat_completion` zuordnen), nicht der Code.

## Hand-off am Ende (Pflicht)

Wie in `AGENTS.md` §5: Pre-Merge-Check, nächste Welle (P4 Vorlage und
Abnahme, `template-samples/vortrag-session-de.md`), Modellempfehlung,
Start-Prompt, Kosten.

## Empfehlung

Opus mit hohem Thinking (UI plus Schreibsemantik mit Nebenläufigkeit), neuer
Agent, Schätzung 10 bis 15 USD.

## Start-Prompt (kopierbar)

```
Lies CLAUDE.md, AGENTS.md, docs/STAND.md, docs/plans/von-menschen-gepruefte-veranstaltung.plan.md
und docs/plans/AGENT-BRIEF-P3b-korrektur-reiter.md. Baue P3b nach dem Brief in
fünf Schritten mit je einem Commit auf einem neuen Branch von master
(claude/p3b-korrektur-reiter): Vorschlags-Route, Schreibweg fuer die
Oberflaeche (Kern aus korrigiereTranskript herausloesen, Bruecke unveraendert),
Reiter „Korrektur" in audio-view.tsx nach dem Vorbild des Reiters
„Transformation", Ableitung „ueberholt" im Reiter Transformation, Tests und
Doku. Entscheidungen 1 bis 7 im Brief sind bindend. pnpm test, pnpm lint,
vollstaendiger tsc mit Vorher-Nachher-Vergleich. Commit-Messages auf Deutsch,
PR gegen master mit Hand-off-Block.
```
