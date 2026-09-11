---
name: erfassungs-composer-s4-s5
overview: "Detailkonzept für den Composer (Stationen S4 Beitragen und S5 Prüfen & Abgeben): Beitrag mit mehreren Anlagen und Zustand je Anlage, Composer als Paket @ks/capture, Abgeben sobald eine Anlage fertig ist, mobiler Pfad mit Kamera, Mikrofon und Wiederaufnahme, creation-wizard.tsx auf einen Orchestrator geschrumpft. Handover Teil 3 vom 11.09.2026, Vorhaben 3 (SHF). Owner-Entscheidungen 11.09.: nur Clerk, kein kontoloser Pfad, Zielbild eine Library je Organisation."
status: konzept
todos:
  - id: c0-freeze
    content: "Freeze-Tests: Publish-Weiche nach templateId charakterisieren (welcher Endpunkt bei pdfanalyse / event-finalize-de / event-publish-final / generisch), STANDARD_CAPTURE_FLOW-Snapshot, applyAnalysisResult-Merge, resolveCreatorRole. Typ-Baseline nach AGENTS.md (vorher/nachher-Vergleich)."
    status: pending
  - id: c1-anlagen-modell
    content: "SubmissionAttachment-Typ + reine Statusmaschine (erfasst → wird_ausgewertet → fertig | fehlgeschlagen; verworfen), Lese-Adapter binaryRefs → attachments, Backfill-Skript, Repo-Funktionen je Anlage. Tests ohne Mongo."
    status: pending
  - id: c2-routen-anlagen
    content: "POST /api/submissions/[id]/attachments (multipart + JSON), PATCH …/attachments/[attId] (Transkript korrigieren, erneut auswerten, verwerfen), POST /api/submissions/[id]/submit (draft → pending). Ein Analyse-Job je Anlage mit correlation.options.attachmentId, Rückfluss je Anlage statt pickAnalyzableSource."
    status: pending
  - id: c3-paket-capture
    content: "packages/capture (@ks/capture): CaptureRoot, Composer mit Eingabefeld/Mikro/Plus, AttachmentCard je Art, Zustandsanzeige, Polling über GET /api/submissions/[id]; spricht ausschließlich über InstanceApi (Unit-Test verbietet fremdes fetch wie im Explorer). Text- und Datei-Karten."
    status: pending
  - id: c4-diktat-kamera
    content: "DictationCard auf LiveSession (src/lib/live-transcription) mit Ticket-Client angemeldet/öffentlich; Foto-Karte mit capture=\"environment\"; Audio-/PDF-Karte mit Fortschritt."
    status: pending
  - id: c5-pruefen
    content: "ReviewStep generisch: Felder mit kind=content in Schema-Reihenfolge (ADR 0003 Nachtrag O1), sichere Felder oben, Rest aufklappbar; POST /api/submissions/[id]/propose erzeugt den Vorschlag aus allen fertigen Anlagen; Vorschlag wird angezeigt, nie stillschweigend übernommen."
    status: pending
  - id: c6-abgegeben-wiederaufnahme
    content: "SubmittedStep (veröffentlicht / liegt beim Moderator / Link merken); Entwurf-Wiederaufnahme: Submission-Id je (libraryId, Zugang) im localStorage, offene Uploads in IndexedDB (pending-uploads) mit Upload-Läufer, idempotente Anlagen-Ids."
    status: pending
  - id: c7-mobile-schale
    content: "Route /beitragen/[zugang] mit schlanker Schale (kein Dateibaum, kein Settings-Chrome), viewport mit viewportFit cover, Safe-Area, Aktionsleiste unten, 44-px-Ziele; Manifest + Service Worker nur für diese Route (Weg next-pwa/Serwist vorher 0,5 PT testen)."
    status: pending
  - id: c8-publish-registry
    content: "publish als zwölftes Preset in die Step-Registry; publish-strategy.ts entscheidet nach Schema-Konfiguration (submission | shadow-twin-overwrite | event-publish-final), nicht nach templateId; Session-Telemetrie in useWizardTelemetry; creation-wizard.tsx auf Orchestrator (Flow auflösen, Schritt rendern, abgeben) unter 400 Zeilen."
    status: pending
  - id: c9-einladungs-token
    content: "Einladungs-Token an Library, Zieltyp (docType) und Rolle binden; Ablauf und optionales Kontingent am Token; /beitragen/[zugang] löst das Token auf und verlangt eine Clerk-Session (Owner 11.09.: kein kontoloser Pfad, Write-Key nur für Angemeldete)."
    status: pending
  - id: c10-aufraeumen
    content: "wizard-file-compute.ts auf Anlagen-Route umstellen, pickAnalyzableSource entfernen, binaryRefs-Schreibpfad abschalten, Doku (umbauplan-generischer-erfassungs-wizard.md §8.1, STAND.md) nachziehen."
    status: pending
---

# Detailkonzept Composer — S4 Beitragen, S5 Prüfen & Abgeben

**Stand:** 2026-09-11, geprüft gegen `master` 6114f46 (v1.2.247).
**Vorarbeit:** [`docs/analysis/erfassungs-flow-wiederverwendung.md`](../analysis/erfassungs-flow-wiederverwendung.md)
(Einstufung je Station) und
[`docs/analysis/erfassungs-flow-bauweisen-vergleich.md`](../analysis/erfassungs-flow-bauweisen-vergleich.md)
(Empfehlung: in KnowledgeScout bauen, als Paket `@ks/capture`, C-fähig).
**Figma:** Screen-Landkarte https://www.figma.com/design/2Eb9gkeKcHzhY7kR1kPyKs —
Abnahme an T-S4.1 bis T-S5.2 (Abschnitt 8).

**Leitplanken:** ADR 0003 ist die Richtung (`wizard-flow-entity.ts` bleibt die
Naht). ADR 0004 gilt: die Erfassung schreibt nie ins Ziel. ADR 0006 gilt für
alles Sichten. Keine stillen Fallbacks. Frontmatter bleibt flach. Nicht
angefasst ohne Entscheidung: `events/*` (Phase 6), Widerstandsmessung (O3).
Nicht Teil des Umfangs (Owner 11.09.): kontoloser Zugang, SPID/CIE,
Offline-First mit Store-App.

**Owner-Entscheidungen vom 11.09.** (ersetzen die zuvor benannten Varianten):

| Entscheidung (Konzept §8) | Entschieden | Wirkung auf dieses Konzept |
|---|---|---|
| 1 · Anmeldeweg | **Clerk, sonst nichts.** Der Einladungslink führt zur Clerk-Anmeldung (passwortlos per E-Mail-Code ist Clerk-Bordmittel), danach in den Composer. Kein SPID/CIE | `/beitragen/[zugang]` verlangt eine Clerk-Session; `InstanceApi` läuft über das Cookie |
| 3 · Zugang ohne Konto | **Nein.** Einen Write-Key gibt es nur für Angemeldete — als Einladungs-Token, der Library, Zieltyp und Rolle bindet | Der öffentliche Pfad (Abschnitt 3.2) entfällt; Scheibe C9 schrumpft auf das Token-Binding |
| Organisationen | **Zielbild: jede Organisation hat ihre eigene Library.** Ob schon in der ersten Ausbaustufe, ist offen | `attribution.organisation` ist dann aus der Library ableitbar, nicht frei einzugeben; S0 bleibt eigenes Konzept |

## 1. Datenmodell

### 1.1 Heute

`WizardSubmission` (`src/types/wizard-submission.ts:101-136`) trägt **eine**
Ergebnisfassung (`metadata`, `markdownBody`, `confidence`) und eine
Referenzliste `binaryRefs` (`:44-61`: hash, url, fileName, contentType, size,
itemId) **ohne Zustand je Referenz**. Die Analyse wählt die **erste**
analysierbare Quelle (`pickAnalyzableSource`,
`src/lib/submissions/submission-analysis-job.ts`) und schreibt ihr Ergebnis in
die Submission zurück (`applyAnalysisResult`, `submission-analysis.ts:48`).
Der Status ist einer für alles (`draft → pending → ready → publishing →
published`, `rejected`; `submission-status.ts:57-66`). Die Erfassung legt
heute immer `pending` an (`submission-capture.ts:9-10`), obwohl `draft` als
Initialstatus erlaubt ist (`INITIAL_STATUSES`, `:41-44`).

### 1.2 Ziel: Beitrag mit Anlagen

Eine neue eingebettete Entität **Anlage** (`SubmissionAttachment`) im
Submission-Dokument. Binärdaten bleiben Referenzen (ADR 0004-Invariante).

```ts
// src/types/submission-attachment.ts (neu)
export type AttachmentKind = 'text' | 'dictation' | 'image' | 'audio' | 'video' | 'pdf' | 'document' | 'url'
export type AttachmentState = 'erfasst' | 'wird_ausgewertet' | 'fertig' | 'fehlgeschlagen' | 'verworfen'

export interface SubmissionAttachment {
  id: string                       // client-erzeugte ULID — idempotente Wiederholung
  kind: AttachmentKind
  order: number
  rawText?: string                 // text, dictation (korrigierbares Transkript), url
  binary?: SubmissionBinaryRef     // image, audio, video, pdf, document; bei dictation optional der Mitschnitt
  result?: {                       // Auswertungsergebnis
    markdown?: string
    metadata?: Record<string, unknown>
    confidence?: Record<string, number>
    caption?: string               // image
  }
  jobId?: string
  state: AttachmentState
  error?: { code: string; message: string; at: string }
  createdAt: string
  updatedAt: string
}
```

Am Beitrag kommen dazu:

```ts
attachments: SubmissionAttachment[]
proposal?: {                        // Vorschlag aus allen fertigen Anlagen (S5)
  metadata: Record<string, unknown>
  markdownBody: string
  confidence: Record<string, number>
  basedOn: string[]                 // Anlagen-Ids, aus denen er entstand
  generatedAt: string
}
```

`metadata` und `markdownBody` bleiben die **vom Menschen bestätigte** Fassung
(was heute PATCH schreibt). Der `proposal` ist der Vorschlag daneben — er wird
angezeigt, nie stillschweigend übernommen (Konzept 5.2). Übernimmt der
Mensch, kopiert der Client die Felder in `metadata`; die Herkunft bleibt in
`proposal.basedOn`.

Zuschreibung (S2: Klarname, Organisation, Interessengruppe, in Vertretung,
anonym) und Sichtbarkeit (S7) sind **eigene Blöcke am Beitrag**, die der
Prüfen-Schirm zeigt. Sie werden in den Konzepten S2/S7 modelliert; dieses
Konzept reserviert nur die Felder `attribution` und `visibility`. Gilt das
Zielbild „eine Library je Organisation" (Owner 11.09.), kommt die Organisation
aus der Library-Mitgliedschaft und wird nicht frei eingegeben.

### 1.3 Verhältnis zu `binaryRefs` und Migration

- `binaryRefs` wird zur **abgeleiteten Sicht**: `attachments.filter(a => a.binary).map(a => a.binary)`.
  Konsumenten (`promotion-assets`, `submission-media`, `pickAnalyzableSource`)
  lesen in C1 über einen Adapter `readAttachments(submission)`, der für
  Altdokumente ohne `attachments` aus `binaryRefs` Anlagen erzeugt:
  `state = markdownBody.length > 0 ? 'fertig' : 'erfasst'`, `kind` aus
  `contentType` (`resolveAnalyzableMedia`, `submission-media.ts:39`).
- Ein einmaliges Skript `scripts/backfill-submission-attachments.ts` schreibt
  die Ableitung persistent; danach (C10) fällt der Adapter, der Schreibpfad
  für `binaryRefs` wird abgeschaltet. Bis dahin schreiben beide Wege.
- `version` bleibt der Änderungszähler; Fassungen (S8b) sind nicht Teil dieses Konzepts.

### 1.4 Frontmatter bei der Promotion

Das veröffentlichte Dokument bekommt keine verschachtelten Anlagen. Wie heute
spiegelt `promotion-assets` Binärdateien neben das Markdown; Textanlagen
gehen in den Body. Herkunft flach: `anlagen_anzahl`, `anlagen_arten`
(kommagetrennt). Mehr nicht — die Belegspur ist Thema von S8b.

## 2. Zustände und Übergänge

### 2.1 Anlage

```
erfasst ──► wird_ausgewertet ──► fertig
   │               │
   │               └──► fehlgeschlagen ──► wird_ausgewertet   (erneut auswerten)
   └──► fertig      (text: sofort; dictation: beim Stopp)
jeder Zustand ──► verworfen   (Mensch entfernt die Karte; nie Hard-Delete vor der Abgabe)
```

Reine Statusmaschine nach dem Muster `submission-status.ts` (explizite
Übergangstabelle, `assertAttachmentTransition`, kein stiller Default).

Was je Art sofort sichtbar ist und was im Hintergrund läuft (Konzept 4.2):

| Art | sofort | Hintergrund | Übergang nach `fertig` |
|---|---|---|---|
| text | Text | nichts | beim Anlegen |
| dictation | Text wächst beim Sprechen (LiveSession) | optional Feinschliff-Job | beim Stopp; Feinschliff ersetzt `rawText` nur nach Bestätigung |
| image | Bild | Beschriftung/OCR-Job | Job-Rückfluss |
| audio, video, pdf, document | Kachel mit Dateiname und Balken | Extraktions-Job (`providerScope='inbox'`) | Job-Rückfluss |
| url | Kachel mit Adresse | `import-from-url` | Job-Rückfluss |

### 2.2 Beitrag

- Der Composer legt beim **ersten** Anlegen einer Anlage eine Submission in
  `draft` an (heute: `pending` beim Publish). `draft` ist der persistierte
  Entwurf und die Grundlage der Wiederaufnahme.
- **Weiter zum Prüfen** ist erlaubt, sobald **eine** Anlage `fertig` ist —
  nicht erst, wenn alle es sind. Regel als reine Funktion
  `canProceedToReview(attachments)`.
- **Abgeben** (`draft → pending`) ist erlaubt, wenn mindestens eine Anlage
  `fertig` ist und der Mensch den Prüfen-Schirm gesehen hat. Anlagen in
  `wird_ausgewertet` dürfen dabei offen bleiben.
- **Späte Ergebnisse** nach der Abgabe: der Job-Rückfluss schreibt nur in die
  Anlage (`result`, `state`), nie in `metadata`/`markdownBody` des
  abgegebenen Beitrags. Der Wartekorb zeigt „neue Auswertung liegt vor" — der
  Moderator entscheidet. Kein stilles Nachmergen.
- **Gescheiterte Auswertung**: die Anlage bleibt als Rohdatei am Beitrag
  (`fehlgeschlagen` mit `error`), der Beitrag bleibt abgebbar, im Wartekorb
  sichtbar mit „erneut auswerten". Ein Beitrag ohne eine einzige fertige
  Anlage ist nicht abgebbar — auch nicht, wenn nur Rohdateien vorliegen.
- Ab `pending` gilt die heutige Maschine unverändert (`ready`, `publishing`,
  `published`, `rejected`).

## 3. Schnittstellen

### 3.1 Angemeldeter Pfad (Cookie, gleiche Origin)

| Route | neu / geändert | Zweck |
|---|---|---|
| `POST /api/submissions` | geändert | erzeugt bei `status: 'draft'` einen leeren Entwurf mit `wizardId`, `docType`, `detailViewType`; `parseCaptureBody` akzeptiert `status` (nur `draft`/`pending`, wie `INITIAL_STATUSES`) und ein optionales `attachments`-Array für Text-Anlagen |
| `POST /api/submissions/[id]/attachments` | neu | multipart (`file` → Inbox-Provider → `binary` → Job → `wird_ausgewertet`) oder JSON (`kind: text \| dictation \| url`); antwortet mit der Anlage inkl. `jobId`; idempotent über die client-erzeugte `id` |
| `PATCH /api/submissions/[id]/attachments/[attId]` | neu | `rawText` korrigieren (dictation), `action: 'retry' \| 'discard'` |
| `POST /api/submissions/[id]/propose` | neu | erzeugt `proposal` aus allen fertigen Anlagen — ein Inbox-Job mit `correlation.options.submissionId` + `proposal: true`; Rückfluss schreibt nur `proposal` |
| `POST /api/submissions/[id]/submit` | neu | `draft → pending` (Abgeben); prüft `canProceedToReview` serverseitig, 409 sonst |
| `GET /api/submissions/[id]` | geändert | liefert `attachments` und `proposal`; trägt `version` für Polling (Client fragt alle 3 s, solange eine Anlage `wird_ausgewertet` ist) |
| `POST /api/submissions/[id]/analyze` | geändert | wird zu „alle Anlagen in `erfasst` auswerten" — ein Job je Anlage mit `correlation.options.attachmentId`; `pickAnalyzableSource` entfällt |

Fortschritt läuft über **Polling des Beitrags**, nicht über den SSE-Stream.
Der Stream (`/api/external/jobs/stream`, an die Clerk-Session gebunden,
`route.ts:9-14`) wäre mit Anmeldepflicht nutzbar, bricht aber im Wackelnetz
und braucht Wiederverbindungslogik; Polling mit Backoff ist auf dem Telefon
der robustere Weg. SSE bleibt Option für später.

Der Job-Rückfluss (`applyAnalysisResult`) wird auf die Anlage umgestellt:
`extractAttachmentIdFromJob` neben `extractSubmissionIdFromJob`; ohne
`attachmentId` verhält sich der Rückfluss wie heute (Altjobs), mit
`attachmentId` schreibt er in `attachments[].result` und setzt `fertig` oder
`fehlgeschlagen` — nie beides still.

### 3.2 Kein öffentlicher Pfad — Einladungs-Token für Angemeldete

Owner-Entscheidung 11.09.: **Beitragen setzt eine Clerk-Anmeldung voraus.**
Ein Write-Key existiert nur für Angemeldete und ist ein **Einladungs-Token**,
der Library, Zieltyp und Rolle bindet. Damit entfallen die zuvor geplanten
Routen unter `/api/public/submissions/*` und die Verallgemeinerung der
öffentlichen Secretary-Routen; die Testimonial-Kette
(`testimonialWriteKey` + `eventFileId`) bleibt unverändert, bis Testimonials
auf den Composer gezogen sind.

Was das Token trägt und wie es zum Bestand passt:

| Bestandteil | Bestand | Ergänzung |
|---|---|---|
| Token, Einlösung, Mitgliedschaft `pending → active` | `library-members-repo.ts:66-108`, `:137-169`; Route `api/libraries/invites/[token]/accept` | Token bekommt `docType` (Zieltyp) und optional einen Einladungssatz; beides landet nach dem Einlösen in der Session-Route `/beitragen/[zugang]` |
| Rolle | `contributor` (erfasst, sieht eigenen Beitrag, publiziert nicht) | keine |
| Kontingent, Ablauf, Widerruf | Widerruf = Mitglied entfernen; Ablauf und Kontingent fehlen | `expiresAt` und optional `quota` am Token; Kontingent wird beim Anlegen einer Anlage verbraucht (Kosten entstehen bei der Auswertung) |
| Rate-Limit | je Nutzer prozesslokal für Realtime-Tickets | später persistent (Bauweisen-Vergleich, Abschnitt 6) |

Der Beitrag eines Contributors landet **zwingend** in `pending`; `promote`
bleibt Owner und Co-Creator vorbehalten (`resolveCreatorRole`,
`submission-capture.ts:34-42`).

### 3.3 Was entfällt

- `wizard-file-compute.ts` (multipart-Create + Warten auf den Job) geht in die
  Anlagen-Route auf (C10).
- `pickAnalyzableSource` und die Einschränkung „erste Quelle" (C2).
- Die Wizard-Aufrufe von `events/publish-final` (`creation-wizard.tsx:2730`,
  `:2825`) bleiben bis Phase 6; das Konzept macht sie zu einer
  Publish-Strategie im Schema (4.2), damit sie ohne Kern-Änderung fallen können.
- `events/finalize` hat keinen Aufrufer und kann in Phase 6 ohne Ersatz gehen.

## 4. Komponentenschnitt

### 4.1 Paket `@ks/capture`

Neues Workspace-Paket `packages/capture`, nach dem Muster von
`packages/module-explorer` (Root-Barrel serverseitig, React unter `/react`)
und `packages/embed` (Bündel-Prüfung gegen `next/`-Reste).

| Datei | Zweck | Zeilen (Ziel) |
|---|---|---|
| `src/react/capture-root.tsx` | Orchestrator: Flow auflösen (`resolveWizardFlow`), Schritt rendern, abgeben. Kennt kein Schema-Feld | ≤ 150 |
| `src/react/composer/composer.tsx` | T-S4.1/4.3: Eingabefeld, Mikro, Plus, Kartenstrom | ≤ 150 |
| `src/react/composer/attachment-card.tsx` | eine Karte je Art mit Zustand, Fehler, „erneut", „entfernen" | ≤ 150 |
| `src/react/composer/dictation-card.tsx` | T-S4.2: `LiveSession` aus `src/lib/live-transcription`, Pegel, Stopp, korrigierbarer Text | ≤ 150 |
| `src/react/review/review-step.tsx` | T-S5.1: Felder `kind=content` in Schema-Reihenfolge, sichere oben, Rest aufklappbar; Zuschreibung und Sichtbarkeit als eingebettete Blöcke | ≤ 200 |
| `src/react/submitted-step.tsx` | T-S5.2 | ≤ 80 |
| `src/react/hooks/use-submission-draft.ts` | Entwurf anlegen, Id merken, wiederaufnehmen | ≤ 120 |
| `src/react/hooks/use-attachment-polling.ts` | Polling mit Backoff, solange etwas läuft | ≤ 80 |
| `src/react/hooks/use-pending-uploads.ts` | IndexedDB-Warteschlange für noch nicht hochgeladene Dateien | ≤ 150 |
| `src/capture-api.ts` | einziger Zugang zur API über `InstanceApi`; kein `fetch` außerhalb (Unit-Test wie `instance-api.ts:11-13`) | ≤ 150 |
| `src/attachment-state.ts` | reine Statusmaschine der Anlage, `canProceedToReview` | ≤ 80 |

`src/lib/live-transcription/**` wandert nicht sofort ins Paket; `@ks/capture`
importiert es in C4 über einen schmalen Adapter (`LiveSession`,
`openRecordingStore`). Der Umzug ins Paket ist eine spätere Scheibe.

Regel aus der Landkarte, im Test verankert: `@ks/capture` importiert nichts
aus `@shf/*`; ein Countdown auf dem Composer wäre ein Testfehler.

### 4.2 `creation-wizard.tsx` schrumpft

Heute 3.302 Zeilen: State, Navigation, API, Telemetrie, Frontmatter-Bau,
Testimonial-Suche, drei Speicherpfade. Ziel: Orchestrator unter 400 Zeilen.

1. **`publish` in die Step-Registry** (`engine/step-registry.tsx:34-46`, das
   zwölfte Preset). Der Renderer bekommt die Strategie über den
   `StepRenderContext`, nicht über `templateId`.
2. **`publish-strategy.ts`** (`src/lib/creation/`): entscheidet nach
   Schema-Konfiguration `schema.publish.strategy ∈ { 'submission',
   'shadow-twin-overwrite', 'event-publish-final' }`. `submission` ist der
   Default und der einzige Weg für den Standard-Flow; die beiden anderen
   tragen die heutigen Sonderfälle (`creation-wizard.tsx:1816`, `:2462-2465`)
   bis Phase 6. Fehlt die Angabe bei einem Alt-Template, wird sie aus der
   heutigen Weiche **einmalig abgeleitet und ins Template geschrieben** (Skript),
   nicht zur Laufzeit geraten.
3. **Sonderfälle ins Schema**: `detailViewType === 'book'` → Bild-Scope
   (`:1457`), `audio-transcript-de` → Diktat-Direkt-Entwurf (`:1122`, `:1148`),
   `event-finalize-de` als Finalize-Default (`:1571`, `:1736`, `:1986`) werden
   Schema-Eigenschaften (`imageScope`, `directDraft`, `finalizeTemplate`).
4. **Telemetrie** (`:170-251`, `:267-288`, `:581-609`, `:1108`) → Hook
   `useWizardTelemetry` in `src/hooks/creation/`.
5. **Frontmatter-Bau** bleibt in `wizard-capture.ts` (U4.0), der Kern ruft nur.

Der Standard-Flow (`wizard-flow-entity.ts:69-111`) ändert sich so:
`supportedSources` bekommt `text`, `dictation`, `image`, `audio`, `pdf`,
`url`; die Schritte werden `Collect → SelectType (nur ohne Vorgabe) → Review
→ Submit`. `welcome` bleibt als optionaler Schritt für Flows ohne
Einladungssatz. `resolveWizardFlow` bleibt die Naht. Die elf migrierten
Presets und die Alt-Flows laufen weiter über die Registry; nur der
Standard-Flow rendert durch `@ks/capture`.

### 4.3 Montage in der Next-App

| Route | Wer | Schale | `InstanceApi` |
|---|---|---|---|
| `/beitragen/[zugang]` | Einladungslink; Clerk-Session Pflicht (nach dem Einlösen des Tokens) | schlank, mobil, ohne Dateibaum | Cookie |
| `/library/create/[typeId]` | angemeldete Owner/Co-Creator/Contributor | heutige Schale | Cookie |

`[zugang]` ist das Einladungs-Token; die Seite löst es serverseitig auf,
verlangt eine Clerk-Session (sonst Umleitung zur Anmeldung und zurück) und
montiert dieselbe `CaptureRoot` mit `docType` und Einladungssatz aus dem Token.

## 5. Mobil

### 5.1 Eine Ansicht, nicht zwei

Frage des Owners (11.09.): Ist die mobile Ansicht eine zweite View, die beim
Verkleinern des Browsers umschaltet, oder immer nur eine View für Desktop und
Mobil? **Für den Composer: eine View, mobile-first entworfen, die auf dem
Desktop nur breiter wird.** Der Beitragspfad ist eine einspaltige Folge
(Eingabefeld, Kartenstrom, Prüfen, Bestätigung); auf einem großen Bildschirm
bekommt dieselbe Spalte eine Maximalbreite (rund 640 px) und wird zentriert —
so, wie ein Chat-Eingabefeld auf dem Desktop aussieht. Kein Umschalten, keine
zweite Komponente; Tailwind-Breakpoints in derselben Komponente entscheiden
Randabstände, Position der Aktionsleiste (unten fixiert vs. unter der Spalte)
und Kartenbreite. Der Browser schaltet beim Verkleinern von selbst um, weil
das reine CSS-Medienabfragen sind.

Wo dieselbe Regel **nicht** reicht:

| Fläche | Desktop | Mobil | Bauweise |
|---|---|---|---|
| Composer, Prüfen, Abgegeben (T-S4.1–T-S5.2) | eine Spalte, zentriert, max. 640 px | eine Spalte, volle Breite, Aktionsleiste unten | **eine View**, Breakpoints nur für Abstände |
| Wartekorb, Beitrag prüfen (M-S8.1, M-S8.2) | zwei Bereiche nebeneinander: Original neben Transkript | gestapelt, Reiter oder Akkordeon | eine Route, **zwei Layouts** derselben Bausteine per Breakpoint |
| Themenübersicht, Meine Beiträge (T-S3.1, T-S11.1) | Liste mit Nebenspalte | Liste allein | eine View, Nebenspalte per Breakpoint ausgeblendet |
| Beamer-Ansicht (M-S10.2) | groß, ohne Bedienelemente | kommt nicht vor | **eigene Route** — eine echte zweite Ansicht, weil andere Aufgabe |
| Galerie, Werkbank, Settings (Bestand) | Desktop-first mit Seitenleisten | heute faktisch nicht mobil | nicht Teil dieses Konzepts; der Composer bekommt deshalb seine eigene schlanke Schale |

**Für Figma heißt das:** die Screens T-S4.1 bis T-S5.2 in Telefonbreite
(390 × 844) ausarbeiten, das ist der maßgebliche Entwurf. Dazu je Screen ein
Desktop-Rahmen (1280 breit), der dieselbe Spalte zentriert zeigt — kein
zweiter Entwurf, sondern der Nachweis, dass die Spalte trägt. Auto-Layout mit
„fill container" und einer Maximalbreite am Spaltenrahmen bildet genau das
Verhalten ab, das später Tailwind erzeugt. Nur für den Wartekorb (M-S8.2)
lohnt ein zweiter Rahmen mit dem Nebeneinander. Die Screen-Landkarte hat die
Telefonrahmen schon; was fehlt, ist die Ausarbeitung und die wenigen
Desktop-Spiegel.

**Bestand als Vorlage, nicht neu erfinden.** Drei Schirme existieren heute
und decken zusammen fast den ganzen Beitragspfad ab. Sie werden in
Telefonbreite abfotografiert (Chrome-Gerätemodus 390 × 844), im Archivordner
unter `Screenshots/` abgelegt und sind die Vorlage für T-S4.1 bis T-S5.2:

| Bestandsschirm | Route | Was davon in den Composer wandert | Screen |
|---|---|---|---|
| Öffentlicher Testimonial-Recorder (`src/components/public/testimonial-recorder.tsx`) | `/public/testimonial?libraryId=…&eventFileId=…&writeKey=…` | ein Schirm: Name, Einwilligung, Diktat mit Mitlauf-Text, Speichern — das ist der Composer im Kleinen | T-S4.1, T-S4.2 |
| Standard-Flow des Wizards, Schritt „Quelle wählen" (`collect-source-step.tsx`) | `/library/create/standard-capture` | Diktat-Textfeld mit Oszilloskop (`DictationTextarea mode="live"`), Datei-Upload, URL-Import, Fortschritt der Audio-Auswertung | T-S4.2, T-S4.3 |
| Wizard, Schritte „Prüfen und ergänzen" und „Speichern" (`edit-draft-step.tsx`, Publish-Step) | derselbe Lauf, zwei Schritte weiter | Felder aus dem Schema, Confidence-Markierung, Wartekorb-Hinweis | T-S5.1, T-S5.2 |
| Meine Beiträge (`my-submissions-client.tsx`) | `/library/my-submissions` | Liste mit Zustand, Analyse anstoßen | T-S11.1 |
| Wartekorb (`inbox-client.tsx`) | `/library/inbox` | Liste, Freigeben, Zurückweisen | M-S8.1, M-S8.2 |

Was keiner dieser Schirme zeigt und deshalb in Figma neu entsteht: der
Kartenstrom mit Zustand je Anlage (T-S4.3), der Fehlerfall einer Anlage, die
Wiederaufnahme, und die Aktionsleiste am unteren Rand.

### 5.2 Bausteine

- **Kamera und Mikrofon direkt.** Foto: `<input type="file" accept="image/*"
  capture="environment">` (heute 0 Treffer für `capture=`). Mikrofon: eigener
  Knopf → `LiveSession` (getUserMedia), nicht im Dateidialog. Audio-Datei:
  `accept="audio/*"`.
- **Ein Daumen, eine Spalte.** Aktionsleiste `position: fixed` unten mit
  `padding-bottom: env(safe-area-inset-bottom)`; `viewport`-Export in der
  Schale mit `viewportFit: 'cover'` (heute keiner, `layout.tsx:53-56`); Ziele
  mindestens 44 px, `touch-manipulation`. Kein Breakpoint-Nachrüsten im
  Monolithen — der Composer ist von Anfang an einspaltig.
- **Wiederaufnahme nach Abbruch.** Drei Schichten:
  1. Der Entwurf ist serverseitig (`draft`), seine Id liegt im `localStorage`
     unter `(libraryId, zugang)`. Beim Öffnen: Id lesen → `GET` → Karten
     wiederherstellen.
  2. Noch nicht hochgeladene Dateien liegen in IndexedDB (`pending-uploads`,
     Muster `recording-store.ts:60`) mit der client-erzeugten Anlagen-Id; ein
     Upload-Läufer versucht sie erneut. Weil die Id idempotent ist, entstehen
     keine Dubletten.
  3. Diktat: `LiveSession` schreibt den Mitschnitt schon nach IndexedDB und
     hat Lückenerkennung (`gap-controller.ts`, `gap-recovery.ts`). Beim
     Wiederkommen bietet die Diktat-Karte „Aufnahme nachtranskribieren" über
     den Batch-Endpunkt an. Die Outbox bleibt, was sie ist (RAM, 120 s) — sie
     ist nicht der Entwurf.
- **Wackelnetz ist der Normalfall.** Jeder Schreibaufruf ist über die
  Anlagen-Id wiederholbar; Polling mit Backoff; ein Banner „offline, wird
  gesendet, sobald Netz da ist"; „Abgeben" wird in die Warteschlange gelegt,
  wenn Uploads offen sind, und ausgeführt, sobald `canProceedToReview` hält.
- **Kein Dateibaum, kein Ordner** auf `/beitragen`.
- **PWA** nur für den Erfassungspfad: Manifest, Service Worker mit
  App-Shell-Cache, keine API-Antworten cachen. Welcher Weg (`next-pwa`,
  Serwist, eigener Worker) mit `transpilePackages` und dem Docker-Build
  verträglich ist, kostet vorab einen halben Tag (C7).

## 6. Tests

### 6.1 Was vor dem Umbau eingefroren wird (C0)

| Test (neu) | friert ein |
|---|---|
| `tests/unit/creation/publish-strategy-legacy.test.ts` | für `pdfanalyse`, `event-finalize-de`, `event-publish-final`, generisch: welcher Endpunkt mit welchem Body gerufen wird (`fetch` gemockt) |
| `tests/unit/creation/standard-capture-flow.test.ts` | Snapshot von `STANDARD_CAPTURE_FLOW` und die Reihenfolge in `resolveWizardFlow` |
| `tests/unit/submissions/analysis-flowback.test.ts` | `applyAnalysisResult`: Frontmatter → `metadata` (Analyse gewinnt je Feld), Body → `markdownBody`, Fehler bei leerem Artefakt |
| erweitert: `submission-capture.test.ts` | `resolveCreatorRole` für alle vier Rollen und `null` |

Bereits vorhanden und weiter grün zu halten: `submission-status.test.ts`,
`submission-capture.test.ts`, `capture-multipart.test.ts`, `promotion*.test.ts`,
`wizard-step-registry.test.tsx`, `file-flow.test.ts`, `wizard-capture.test.ts`,
`creation-wizard-persistence-mapping.test.ts`, die API-Tests
`submissions-*-route.test.ts` und die Komponententests unter
`tests/unit/components/submissions/`.

### 6.2 Neue Tests je Scheibe

| Scheibe | Tests (ohne Mongo, ohne Netz) |
|---|---|
| C1 | Statusmaschine der Anlage (jeder erlaubte und jeder verbotene Übergang), `readAttachments` für Alt- und Neudokumente, `canProceedToReview` |
| C2 | Routen mit gemocktem Repo: multipart → Anlage `wird_ausgewertet` + Job; JSON text → `fertig`; `submit` 409 ohne fertige Anlage; Rückfluss mit `attachmentId` schreibt nur in die Anlage; Rückfluss nach Abgabe fasst `metadata` nicht an |
| C3 | `capture-api` ohne fremdes `fetch`; Composer rendert je Art die richtige Karte; Zustand sichtbar |
| C4 | Diktat-Karte: Text wächst mit Segmenten, Stopp → `fertig`; Foto-Input trägt `capture="environment"` |
| C5 | Review: nur `kind=content`, Schema-Reihenfolge, sichere Felder oben; Vorschlag übernimmt nichts ohne Klick |
| C6 | Wiederaufnahme: Id im localStorage → Karten aus `GET`; pending-uploads-Läufer wiederholt idempotent |
| C8 | Registry kennt zwölf Presets; `publish-strategy` liefert für jede Schema-Angabe genau einen Weg und wirft bei unbekannter |
| C9 | Einladungs-Token mit `docType`, Ablauf, Kontingent; `/beitragen/[zugang]` ohne Session → Umleitung; Kontingent bei Anlage verbraucht |

Typ-Gate nach `AGENTS.md`: `npx tsc --noEmit` vollständig, vorher/nachher
verglichen — jede neue Zeile ist die eigene. Kein `pnpm build` im Cloud-Agent.

## 7. Schnitt in PRs

Eine PR je Scheibe, je Scheibe für sich lauffähig; Limits nach `AGENTS.md`
(max. 1.000 Zeilen je Commit, 5.000 je PR, 15 Commits). Reihenfolge und
Abhängigkeiten:

| Scheibe | PT | setzt voraus | für sich lauffähig, weil |
|---|---|---|---|
| C0 Freeze-Tests + Typ-Baseline | 0,5–1 | — | nur Tests |
| C1 Anlagen-Modell + Adapter + Backfill | 1–1,5 | C0 | Adapter liefert Alt-Dokumente unverändert |
| C2 Routen Anlagen, Abgeben, Job je Anlage | 1,5–2 | C1 | alte Routen bleiben; neue kommen dazu |
| C3 Paket `@ks/capture`, Composer Text/Datei | 2 | C2 | montiert unter `/library/create/standard-capture` hinter Flag |
| C4 Diktat-Karte, Kamera | 1–1,5 | C3 | |
| C5 Review generisch + `propose` | 2 | C3 | |
| C6 Abgegeben + Wiederaufnahme | 1,5 | C5 | |
| C7 Mobile Schale `/beitragen`, PWA-Grundlage | 1–1,5 | C6 | |
| C8 `publish` in Registry, Strategie im Schema, Kern schrumpft | 1,5–2 | C0 | unabhängig vom Paket; nur Alt-Flows |
| C9 Einladungs-Token an Library und Zieltyp binden (Ablauf, Kontingent) | 1–2 | C7 | |
| C10 Aufräumen | 0,5–1 | alle | |
| **Summe** | **14–20** | | |

C8 kann parallel zu C3–C7 laufen, weil es nur die Alt-Flows berührt. Bei
Zeitnot fällt zuerst C7-PWA (Manifest, Worker), dann C6-Schicht 2
(pending-uploads); C0, C1, C2, C3, C5 sind nicht verhandelbar.

## 8. Abnahmekriterien an den Figma-Screens

**T-S4.1 Beitrag beginnen.** Öffnet ein Eingeladener seinen Link, sieht er ein
Eingabefeld, darunter Mikrofon und Plus, darüber den Satz aus der Einladung,
keinen Willkommens-Schritt, keine Typwahl. Tippt er Text und bestätigt,
erscheint sofort eine Textkarte mit Zustand „fertig". Serverseitig existiert
eine Submission `draft` mit einer Anlage `text/fertig`.

**T-S4.2 Diktat läuft.** Nach Tipp auf das Mikrofon erscheint eine
Diktat-Karte mit Pegel; der Text wächst, während gesprochen wird; Stopp setzt
die Karte auf „fertig", der Text bleibt korrigierbar. Bricht die Verbindung
ab, zeigt die Karte die Lücke und bietet Nachtranskription an; nichts geht
still verloren.

**T-S4.3 Anlagen gemischt.** Ein Foto (Kamera direkt), ein Diktat und ein PDF:
das Foto ist sofort sichtbar, das PDF als Kachel mit Balken „wird
ausgewertet", das Diktat „fertig". „Weiter" ist aktiv, sobald eine Karte
fertig ist. Schlägt die PDF-Auswertung fehl, zeigt die Karte „nicht lesbar"
mit „erneut" und „entfernen", und „Weiter" bleibt aktiv.

**Unterbrochen (Konzept §6, Bildschirm 7).** App schließen, wieder öffnen:
dieselben Karten mit demselben Zustand; eine noch nicht hochgeladene Datei
wird nachgeladen, ohne Dublette.

**T-S5.1 Prüfen & Abgeben.** Die Felder des Zielschemas mit `kind=content`
erscheinen in Schema-Reihenfolge, vorbelegt aus dem Vorschlag, unsichere Felder
markiert (Confidence), Titel und Datum oben, Rest aufklappbar. Der Vorschlag
ist als Vorschlag gekennzeichnet; Ändern ändert nur die bestätigte Fassung.
Zuschreibung und Sichtbarkeit sind sichtbar (Inhalt aus S2/S7). „Als Entwurf
behalten" lässt den Beitrag in `draft`.

**T-S5.2 Abgegeben.** Nach „Abgeben" steht der Beitrag in `pending`; die
Bestätigung sagt „liegt beim Moderator" (Contributor) oder
„veröffentlicht" (Owner nach `promote`), zeigt „Weiteres beitragen" und den
Link, unter dem der Beitrag wiederzufinden ist. Eine Anlage, die danach fertig
wird, ändert die abgegebene Fassung nicht, sondern erscheint im Wartekorb als
„neue Auswertung liegt vor".

**M-S4.4 In Vertretung erfassen** (Moderation) benutzt denselben Composer mit
Banner „im Namen von" — der Unterschied ist ein Feld in `attribution`, kein
zweiter Schirm. Abnahme im Konzept S2.

**Querschnitt.** `@ks/capture` importiert nichts aus `@shf/*`; kein `fetch`
außerhalb von `capture-api.ts`; `pnpm test` und `pnpm lint` grün; `tsc`
vollständig ohne neue Fehler; `creation-wizard.tsx` nach C8 unter 400 Zeilen.

## 9. Offen (nicht in diesem Konzept entschieden)

- Ob „eine Library je Organisation" schon in der ersten Ausbaustufe kommt
  (Owner 11.09.: Zielbild ja, Zeitpunkt offen) — entscheidet, ob
  `attribution.organisation` aus der Library kommt oder ein Feld am Beitrag ist.
- Mehrsprachigkeit der Auswertung: `SUBMISSION_ANALYSIS_DEFAULTS.targetLanguage`
  ist fix `de` (`submission-analysis-job.ts`); entscheidet das Vorabtreffen.
- Wo die Testimonials (`src/components/public/testimonial-recorder.tsx`,
  `api/public/testimonials`) auf den Composer gezogen werden — eigene Scheibe.
- Umzug von `src/lib/live-transcription` ins Paket.
- Service Worker im Next-Build und persistentes Rate-Limit: später klären
  (Bauweisen-Vergleich, Abschnitt 6).

## Verweise

- `docs/wizards/umbauplan-generischer-erfassungs-wizard.md` (U4–U6, Ist-Code-Karte)
- `docs/wizards/abnahme-inbox-plan.md` (Datenmodell Submission, W1–W5)
- `docs/adr/0003-wizard-schema-template-trennen.md` (Nachtrag O1: generische Bindung)
- `docs/adr/0004-capture-publish-entkopplung-inbox-modell.md`
- `docs/adr/0008-deployment-ziele.md` (Einsatz P5, `pwa` als Flag)
- `packages/module-explorer`, `packages/embed` als Paket-Vorbilder
