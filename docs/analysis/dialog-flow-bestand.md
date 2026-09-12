# Dialog-Flow: der übersehene Bestand — Aufnahme, Einstufung, Korrekturen

**Stand:** 2026-09-12, geprüft gegen `master` 6114f46 (v1.2.247) und die
Prod-Datenbank `common-knowledge-scout-prod` (nur lesend).
**Auftrag:** Archiv `24.09 KnowledgeScout/2026-09-10 Konzept Erfassungs-Flow
generisch und mobil/2026-09-12 Handover an Claude Code - Dialog-Flow Bestand.md`.
**Nicht gebaut.** Dieses Dokument ist das Ergebnis; Code wurde nicht geändert.

**Ablage:** Der Handover nennt `docs/analyse/`. Die Analyse vom 11.09. liegt
in `docs/analysis/` (Branch `claude/clever-hypatia-8ar4yd`, noch nicht auf
`master`); dieses Dokument liegt im selben Ordner.

**Zugangsmodell laut Owner (12.09., während der Analyse):** Der QR-Code
existiert nur während der Sitzung und in Anwesenheit der Moderatorin. Am Ende
wird alles unter ihrem Konto und mit ihrer Identität gespeichert. Gibt eine
Person ihren Namen an, verifiziert die Moderatorin das in Präsenz. Teil 1.3
prüft den Code an genau diesem Modell.

## 0. Kurzfassung

1. **Der Flow ist gebaut, aber die Gast-Tür ist zu.** Die API-Schicht des
   Testimonial-Pfads läuft ohne Konto (`/api/public/testimonials`,
   `/api/public/secretary/*`). Die Seite davor, `/public/testimonial`, steht
   nicht in der Liste der öffentlichen Routen (`src/middleware.ts:39-52`) und
   wird anonymen Besucher:innen als 404 maskiert — live geprüft am 12.09.
   Der QR-Code in der Event-Ansicht zeigt zudem bevorzugt auf den
   Login-Wizard, nicht auf den Gast-Recorder (`session-detail.tsx:663`).
   **Heute erreicht kein Gast den Flow über den Browser.**
2. **Die Nennungsstufen sind nicht live.** `author_is_named`,
   `author_nickname` usw. stehen nur im Repo-Snapshot `testimonial-creation-de`.
   Diese Vorlage liegt in keiner Library. Live läuft `event-testimonial-creation-de`
   mit den drei Fragen plus `speakerName`. Und selbst wo die Felder gemappt
   werden, wertet kein Renderer `author_is_named` als Schalter aus
   (`testimonial-detail.tsx:56`).
3. **Die Entscheidung vom 11.09. schaltet den Pfad nicht ab.** Das
   Composer-Konzept sagt ausdrücklich: die Testimonial-Kette bleibt, bis
   Testimonials auf den Composer gezogen sind. Der Pfad steht aber quer zu
   ADR 0004: er schreibt direkt in den Ziel-Provider, nicht in die Inbox.
4. **Der Dialog-Fall ist zu über 80 Prozent Konfiguration und Reparatur**, nicht
   Neubau. Neu sind vier Stücke: der kollektive Abschluss im Raum, das
   Gruppenbild auf der Ergebnisseite (Feld plus Upload-Schritt plus
   Medien-Vertrag), die Stimmung als Moderations-Oberfläche und der Widerruf
   durch die beitragende Person. Grob 8 bis 13 Personentage, unabhängig von
   den 45 bis 65 der SHF-Plattformseite.
5. **Von den sechs D-Screens braucht das Klickmodell zwei nicht** (D-S4.5,
   D-S8b.3), zwei gibt es im Kern schon (D-S4.4, D-S6.1, D-S10.1), und zwei
   fehlen, die die Kolping-Gespräche verlangen (Ernte-Screen in einem Zug,
   kollektiver Abschluss). Abschnitt 3.

## 1. Bestandsaufnahme mit Belegen (Teil 1)

### 1.1 Templates: MongoDB gegen Repo-Snapshots

Primäre Quelle ist MongoDB, Collection `templates`, `_id = <libraryId>:<name>`
(`src/lib/repositories/template-repo.ts:18`, `:34`, `:44`). `template-samples/`
ist Snapshot, keine Laufzeitquelle (`template-samples/README.md:7-9`, `:20`);
Import per `POST /api/templates/import` aus `root/templates/*.md`
(`src/app/api/templates/import/route.ts:54-77`).

**Was in MongoDB liegt** (Prod, 12.09.; die Dev-Variable der `.env` zeigt auf
dieselbe Datenbank):

| Vorlage | Libraries (Id-Anfang) | Stand | Abweichung vom Snapshot |
|---|---|---|---|
| `event-testimonial-creation-de` | `ID_OnedriveTest`, `f0850ba2`, `4387593f`, `913ecb14` (cast) | 15.01. / 18.02. / 24.02. | **`creation`-Block identisch** in allen vier; Schrittfolge Welcome → collectSource → generateDraft → editDraft(q1, q2, q3, speakerName, source_event_file_id) → previewDetail; Quellen `spoken` + `text`; **kein `publish`-Schritt** |
| `event-finalize-de` | dieselben vier | 15.01. / 18.02. / 24.02. | Mongo-Feinschliff kennt nur `title, teaser, slug, originalFileId`; Snapshot zusätzlich `date, location, year, tags, topics`; Mongo trägt `detailViewType: session` als Metadatum |
| `cast-event-creation-de` | `4387593f`, `913ecb14` (cast) | 18.02. / 26.02. | Mongo setzt `ingestOnFinish: true` an jedem Schritt außer Publish; sonst gleiche Schrittfolge (sieben Schritte, `folder`-Quelle, `testimonialWriteKey`) |
| `event-creation-de` | `ID_OnedriveTest`, `f0850ba2` | 15.01. | Mongo hat **fünf** Schritte (ohne selectFolderArtifacts, ohne generateDraft) und `followWizards` mit `testimonialTemplateId`/`finalizeTemplateId`; Snapshot hat sieben Schritte und kein `followWizards` |
| `dialograum-creation-de`, `dialograum-creation-de-test`, `testimonial-creation-de`, `dialograum-ergebnis-de` | **keine** | — | existieren nur als Snapshot im Repo; laut Git seit **02.01.2026** (`6e5c9c0e`), unverändert |

Die Library-Namen zu `ID_OnedriveTest`, `f0850ba2` und `4387593f` konnten
nicht aufgelöst werden (die Abfrage der `libraries`-Collection wurde vom
Werkzeug-Wächter blockiert); `913ecb14` ist laut Handover `cast`.

Folge für den Vorbefund des Handovers: Die „drei Nennungsstufen je Person"
sind ein Repo-Stand, kein Live-Stand. Live gibt es genau **ein** Namensfeld
(`speakerName`), und die Discovery für die Finalisierung liest ausschließlich
dieses Feld (`src/lib/testimonials/testimonial-discovery.ts:101`, `:171`,
`:224`). Ein Testimonial aus `testimonial-creation-de` (mit `author_name`)
bliebe im Finalize-Korpus namenlos („Anonym",
`src/lib/creation/event-testimonial-discovery.ts:31`).

### 1.2 Wizard-Presets: wie generisch der Kern ist

Dreizehn Presets, eine Quelle: `src/lib/templates/template-types.ts:49-62`.
Schrittfolge kommt aus Flow-Entität → `creation`-Block im Template →
Code-Konstante `STANDARD_CAPTURE_FLOW` (`src/lib/creation/wizard-flow-entity.ts:69-127`).
Laufzeit-Filter generisch (`src/lib/creation/wizard-flow.ts:27-41`, `:70-113`).
Registry deckt elf Presets (`engine/step-registry.tsx:34-46`); **`publish`
liegt noch im Legacy-Switch** des Monolithen (`creation-wizard.tsx:2454-3050`).

| Preset | generisch / verzweigt | Beleg |
|---|---|---|
| `welcome` | generisch | `engine/renderers/static-step-renderers.tsx:11-19` |
| `collectSource` | verzweigt an `templateId === 'audio-transcript-de'` (Texte) und PDF-Sonderpfad | `steps/collect-source-step.tsx:1031`, `:1057`, `:1072`, `:1076`; `:770-808` |
| `generateDraft` | verzweigt an `event-finalize-de` (autoAdvance, Vorschau aus) | `engine/renderers/draft-step-renderers.tsx:56`, `:112-114` |
| `editDraft` | verzweigt an `pdfanalyse`, `audio-transcript-de`; Template-Dropdown filtert per Namens-Substring `includes('testimonial')` / `includes('finalize')` | `engine/renderers/edit-draft-renderer.tsx:16`, `:65`; `steps/edit-draft-step.tsx:325-326` |
| `selectRelatedTestimonials` | verzweigt an `seedDocType === 'event'` (Filesystem- gegen Dialograum-Discovery); Kandidatenfilter per Dateiname `!includes('dialograum')`; **alle vorausgewählt** | `creation-wizard.tsx:488`, `:492-495`; `steps/select-related-testimonials-step.tsx:85-93`, `:107-122` |
| `previewDetail` | verzweigt an `pdfanalyse` und per String-Heuristik `typeId.includes('event')` | `engine/renderers/preview-detail-renderer.tsx:16`, `:31-37` |
| `publish` | vier Wege über `templateId`: generisch (Inbox, ADR 0004), `event-finalize-de`, `event-publish-final`, PDF | `creation-wizard.tsx:2462-2466`, `:2489-2679`, `:2682-2802`, `:2806-2875` |
| „Speichern" am letzten Schritt (kein Preset) | stark verzweigt, **schreibt direkt in den Provider** | `creation-wizard.tsx:1171-1173`, `:1986-2019`, `:2018`, `:2076`, `:2108` ff.; `:1557-1573` (`docType === 'event'` → `followWizards`, Default `'event-finalize-de'` hartkodiert `:1571`) |

`collect-source-step.tsx` (1.192 Zeilen) im Detail — Frage aus Teil 3:

- Quellenarten `spoken | url | text | file | folder` (`template-types.ts:19`).
  **`spoken` ist kein eigener Pfad**, sondern dasselbe `DictationTextarea
  mode="live"` mit anderem Label (`collect-source-step.tsx:1065-1082`).
- Datei-Inputs ohne `multiple`, genau eine `pendingFileSource` (`:455`,
  `:1134-1141`). Mehrere Anlagen gibt es nur unterhalb der UI:
  `binaryRefs[]` (`src/types/wizard-submission.ts:123`) und
  `form.getAll('file')` (`src/lib/submissions/capture-multipart.ts:42-45`).
- Die Audio-Job-Funktion `transcribeAudio` (`:819-941`) ist als ungenutzt
  markiert und wird nirgends aufgerufen; Audio läuft über den Datei-Flow.
- Übergabe an den Wizard per globalem Fensterobjekt
  `window.__collectSourceStepBeforeLeave` (`:498-502`).

Toter Code: `steps/review-step.tsx` (240 Z.) und `steps/review-fields-step.tsx`
(152 Z.) ohne Referenz; Preset `chooseSource` in keinem Template gesetzt.

### 1.3 Write-Key-Pfad: erzeugen, prüfen, einlösen — und ob er ohne Konto läuft

| Station | Datei:Zeile | ohne Konto? | Befund |
|---|---|---|---|
| erzeugen | `src/lib/events/event-frontmatter-defaults.ts:64-73` | nein (im Wizard der Erstellerin) | UUID, nur bei `docType === 'event'` und leerem Feld; Fallback ohne kryptografische Qualität (`:67-70`) |
| speichern | Frontmatter der Event-Datei im Storage; Spiegel `docMetaJson.testimonialWriteKey` (`src/lib/mappers/doc-meta-mappers.ts:124`) | — | Leck-Schutz: `doc-meta/route.ts:87-105` löscht den Key für Nicht-Owner bei öffentlichen Libraries |
| prüfen (zentral) | `src/lib/public/testimonial-write-access.ts:71-109` | **ja** | kein `auth()`; Owner über `resolveOwnerForTestimonials`; private Library: Key muss existieren und gleich sein (`:92-102`); Vergleich `!==`, nicht timing-safe |
| prüfen (Duplikate) | `src/app/api/public/testimonials/route.ts:96-107`, `:214-225`; `…/events/testimonials/[testimonialId]/route.ts:87-98` | ja / nein | dreimal dieselbe Logik, zwei davon ohne den gemeinsamen Helfer |
| Gast-Diktat (API) | `src/app/api/public/secretary/process-audio/route.ts:90`; `…/realtime-session/route.ts:69` | **ja** | nur `assertTestimonialWriteAccess` |
| einlösen (Link) | `src/components/library/session-detail.tsx:210-219` | — | Query-Form `?libraryId&eventFileId&writeKey`; kein Pfadschema `/write/<key>` |
| QR-Code | `session-detail.tsx:663` (`react-qr-code`, `package.json:142`) | nur Owner/Moderator | zeigt `publicWizardTestimonialUrl || publicAnonTestimonialUrl` — **bevorzugt den Login-Wizard** (`:250-260`), Gast-Link nur, wenn `testimonialsFolderId` fehlt (`:252`) |
| Gast-Seite | `src/app/public/testimonial/page.tsx:3-11` | **nein — Bruchstelle** | `/public/testimonial` fehlt in `src/middleware.ts:39-52`; keine dynamische Ausnahme greift; `auth.protect()` (`:279`). Live: anonym 404 auf knowledgescout.org, die API antwortet anonym sachlich |
| Gast-UI (Komponente) | `src/components/public/testimonial-recorder.tsx:25`, `:65`, `:136-140` | Client-Code | liest `writeKey`, sendet an `/api/public/testimonials` und `/api/public/secretary/process-audio` |
| Widerruf (Testimonial) | `…/events/testimonials/[testimonialId]/route.ts:50-69`; UI `session-detail.tsx:275`, `:701` | nein | Löschen nur Owner/Moderator; die beitragende Person bekommt nach dem Absenden nur eine `testimonialId` zurück (`public/testimonials/route.ts:289-310`), kein Claim |
| Widerruf (Submission) | `src/app/api/submissions/[id]/route.ts` | existiert nicht | nur `GET` + `PATCH`; `published`/`rejected` terminal (`src/lib/submissions/submission-status.ts:47-50`, `:63-65`) |

**Antwort auf die entscheidende Frage:** Die API-Schicht läuft heute ohne
Clerk-Konto; die Seite davor nicht. Über den Browser erreicht heute kein Gast
den Flow. Ob das jemals anders war, lässt die Git-Historie von
`src/middleware.ts` nicht erkennen (nie ein `/public(`-Muster); die Seite
selbst kam am 13.01.2026 (`0a468d67`). Der Februar-Betrieb in `cast` lief
demnach über den Login-Wizard-Link, auf den der QR-Code zeigt.

**Gegen das Owner-Modell vom 12.09. gehalten:**

| Sollmodell (Owner 12.09.) | Code heute |
|---|---|
| Schlüssel gilt nur während der Sitzung | Schlüssel ist eine UUID im Frontmatter, ohne Ablauf, ohne Widerruf; gilt, solange die Event-Datei ihn trägt |
| Speicherung unter dem Konto der Moderatorin | trifft zu: der Gast-Pfad löst die Owner-Identität auf und schreibt in deren Library (`testimonial-write-access.ts:82`; `public/testimonials/route.ts:247-256`, `:270-287`) — ohne eigene Nutzeridentität am Dokument |
| Name in Präsenz verifiziert | kein Feld, kein Schritt; live gibt es nur `speakerName` als Freitext |

**Verhältnis zu `capture-access.ts` und ADR 0004 E2:** `capture-access.ts:24-31`
entscheidet nur für eingeloggte Nutzer:innen (Owner oder aktive Mitgliedsrolle)
und kennt keinen Key. Der Submission-Typ trägt `writeKey?`
(`src/types/wizard-submission.ts:111`), aber `parseCaptureBody` liest ihn nicht
(`submission-capture.ts:110-127`), kein Aufrufer setzt ihn
(`api/submissions/route.ts:55`, `:104`). **ADR 0004 E2 ist halb umgesetzt:**
der `contributor`-Zweig existiert, der Write-Key-Zweig nicht. Der
Testimonial-Write-Key umgeht die Inbox und schreibt direkt in den Ziel-Provider
— gegen die Invariante `docs/adr/0004-…md:56-59`.

### 1.4 Publish-Pfad

`steps/publish-step.tsx` ruft keine API; er startet einmal den vom Wizard
injizierten Callback (`:58-62`) und zeigt Fortschritt. Die Logik steckt im
Legacy-Switch (`creation-wizard.tsx:2454-3050`).

Es gibt kein `src/app/api/events/**`. Die Routen liegen unter
`src/app/api/library/[libraryId]/events/`:

| Route | Zweck | Auth | Aufrufer |
|---|---|---|---|
| `POST …/events/publish-final` | Index-Swap: Final ingestieren, Vektoren des Originals löschen (`publish-final/route.ts:30-70`) | Clerk | `creation-wizard.tsx:2730`, `:2825` |
| `POST …/events/finalize` | versionierten Final-Run im Storage anlegen (`finalize/route.ts:32-36`) | Clerk | **keiner** — der Wizard baut den Run clientseitig (`creation-wizard.tsx:1990-2019`) |
| `GET …/events/storage-context` | Event-Ordner und Testimonial-Ordner auflösen | Clerk | `session-detail.tsx:235` |
| `DELETE …/events/testimonials/[id]` | Testimonial-Ordner löschen | Clerk + Owner/Moderator | `session-detail.tsx:287` |

**Welcher Weg trägt den Dialog-Fall heute:** Die Testimonial-Erfassung endet
ohne `publish`-Schritt; `handleNext` ruft am letzten Schritt direkt
`handleSave()` (`creation-wizard.tsx:1171-1173`), das per `provider.uploadFile`
in den Ziel-Provider schreibt. Die Finalisierung (`event-finalize-de`) schreibt
ebenfalls direkt und ruft dann `events/publish-final`. Beide Wege laufen
**vollständig am Wartekorb vorbei**. Der generische Inbox-Weg
(`POST /api/submissions` → approve → promote, `creation-wizard.tsx:2489-2679`)
ist gebaut, trägt den Dialog-Fall aber nicht.

### 1.5 Detailansichten

`testimonial-detail.tsx` (171 Z.): Anzeigename ist `author_name || author_nickname`
(`:56`); `author_is_named` wird gemappt (`doc-meta-mappers.ts:221`), aber
**nirgends als Schalter ausgewertet** (`:26`, `:65` nur Debug). Anonym entsteht
implizit, wenn beide Felder leer sind; ohne Bild bleibt ein grauer Platzhalter
(`:96-107`). Nicht gerendert: `q1`–`q3` als eigene Felder (nur, wenn das LLM sie
in den Body schreibt), Audio, Datum, Event-/Dialograum-Bezug. In der Registry
fehlen `author_nickname` und `author_is_named`
(`packages/contracts/src/detail-view-type-registry.ts:269-292`).

`session-detail.tsx` (849 Z.): beide Ergebnis-Vorlagen landen im selben
Renderer (`detailViewType: session`). „Kurzüberblick", „Eindruck der
Teilnehmer" und „Testimonials" sind **Markdown-Abschnitte im Body**, kein
eigener Code (`:530-538`; `event-finalize-de.md:65-72`). Personenbilder gibt es
nur über `speakers`/`speakers_image_url` (`:413-510`); die Testimonial-Liste
zeigt `speakerName`, Datum, Auszug, Chips — **kein Bildfeld**
(`src/components/shared/testimonial-list.tsx:30-44`). Der Event-Block (Status,
QR, Testimonial-Liste) erscheint nur bei `docType === 'event'` **und**
`wizard_testimonial_template_id` (`:119-120`, `:190`, `:638-749`); weder
`dialograum-ergebnis-de` noch `event-finalize-de` setzen `docType`, also zeigt
das Ergebnis-Dokument keinen Event-Block. `participant_count`, `dialograum_id`,
`source_*` werden ignoriert.

**„Zwanzig Köpfe und ihre Summaries" gibt es nicht.** Die Galerie der Stimmen
mit Gesicht ist weder in der Liste noch im Ergebnis-Renderer angelegt.

### 1.6 Medien: Gruppenbild

Der Event-Container kennt `coverImageUrl` und `galleryImageUrls`
(`cast-event-creation-de.md:22`; Registry `detail-view-type-registry.ts:226`,
`:234`, `:243-249`). `event-finalize-de` hat **kein Bildfeld** und keinen
`uploadImages`-Schritt (`event-finalize-de.md:2-14`, `:25-49`). Der Renderer
könnte beides sofort zeigen (`session-detail.tsx:148-168`, `:535`, `:539-591`).

Ein Feld allein reicht nicht: (1) Feld ins Frontmatter und in die
Review-`fields`; (2) ein Erfassungsschritt (`imageFieldKeys` oder
`uploadImages`); (3) **Medien-Vertrag**: `upload-images-step.tsx:75-88`
schreibt Azure-Blob-URLs über `/api/creation/upload-image` ins Frontmatter,
`docs/contracts/media-lifecycle.md` verlangt Dateinamen und den Weg über
`shadow-twins/upload-media` — der Wizard-Bildupload bricht den Vertrag heute
schon (`creation-wizard.tsx:1493`, `:1520`, `:2520`).

## 2. Einstufung S0–S11 für die Dialog-Spalte (Teil 2)

Raster wie am 11.09. (konfigurieren · erweitern · portieren · neu), Ausgangspunkt
ist der Testimonial-Flow, nicht der Composer. Zielbild sind die
Kolping-Gespräche (Befund 12.09.) und das Owner-Modell vom 12.09.

| # | Station | Einstufung | Bestand (Beleg) | Was fehlt | PT |
|---|---|---|---|---|---|
| S0 Einrichten | **konfigurieren** | eigene Library je Gruppe: `isPublic`, `requiresAuth` (`src/types/library.ts:298-364`); Mitglieder mit Rollen (`library-members.ts:21`) | nichts für den Testlauf; „passwortgeschützte Sicht" = private Library mit Mitgliedern | 0 |
| S1 Ankommen | **konfigurieren + reparieren** | Write-Key-Kette API-seitig komplett (1.3) | `/public/testimonial` in die öffentlichen Routen; QR auf den Gast-Link statt Login-Wizard; optional Ablauf am Key (Owner-Modell „nur während der Sitzung") | 0,5 (Route + QR) + 1 (Ablauf) |
| S2 Zuordnen | **konfigurieren** | `speakerName` live; `author_name/role/nickname/is_named/image_url` im Snapshot `testimonial-creation-de` | Felder in die live-Vorlage übernehmen; Discovery liest `author_name` (heute nur `speakerName`, 1.1); Gate im Renderer, falls `author_is_named` wirken soll | 1 |
| S3 Orientieren | **konfigurieren** | Galerie im Paket, Facetten generisch | Facette nach Gespräch (`dialograum_id`/`source_event_file_id`) | 0,5 |
| S4 Beitragen | **konfigurieren** (Ernte) | `testimonial-recorder.tsx`: Diktat, Transkript, drei Fragen, Vorschau; `event-testimonial-creation-de` mit `spoken` | Fragen und Ton stehen im Template (Stimmung, S8-Ersatz); kein Composer nötig — eine Stimme, zwei Minuten | 0 |
| S5 Prüfen & Abgeben | **konfigurieren** | `previewDetail` als letzter Schritt, dann `handleSave` (1.4) | nichts für den Testlauf; Inbox-Konformität (ADR 0004) ist Plattformthema, nicht Dialogthema | 0 |
| S6 Mitentscheiden | **entfällt** | — | im Dialogformat keine Bewertung; Zustimmung ist der gemeinsame Abschluss (S8b) | 0 |
| S7 Sehen dürfen | **konfigurieren** | zentraler Draft-Filter (`publication-filter.ts:43-53`); Library privat/öffentlich | „erst geschützt, später öffentlich" = Library-Schalter umlegen | 0 |
| S8 Kuratieren | **auf Null** | `selectRelatedTestimonials` wählt alle vor | Schritt aus der Vorlage nehmen oder belassen (alle vorgewählt = keine Auswahl) | 0 |
| S8b Verdichten | **konfigurieren + neu (klein)** | `event-finalize-de`: Kurzüberblick → Eindruck der Teilnehmer → Testimonials, ohne Fassungskette (1.5) | Systemprompt „mathematisches Mittel, kein Bias"; **kollektiver Abschluss im Raum** (gemeinsam ansehen, einmal speichern) — heute Moderationsschritt im Login-Wizard | 2–3 |
| S9 Wiederfinden | **konfigurieren** | Ingestion bei `publish-final`; Galerie | Testimonials sind „filesystem-only" (`creation-wizard.tsx:2254-2258`) — nur das Ergebnis ist im Index; für „ähnlich gedacht, ganz woanders" müssen Einzelstimmen indexiert werden | 1 |
| S10 Zeigen | **konfigurieren + erweitern** | `session`-Renderer, `@ks/embed` | Gruppenbild (1.6: Feld, Schritt, Medien-Vertrag); „Köpfe" der Beitragenden im Ergebnis (heute nur `speakers_image_url`) | 1–2 (Bild) + 1–2 (Köpfe) |
| S11 Nachverfolgen | **neu (klein)** | nichts für Gäste | Widerruf durch die beitragende Person (Claim-Token beim Absenden, Löschen bis zum Abschluss) | 1–2 |

Dazu **Stimmung als Oberfläche** (Regelsatz, Befund 12.09. Punkt 5): heute im
`systemprompt` der Vorlage, änderbar nur unter `/templates` durch Mitglieder
mit Zugriff. Eine Moderations-Oberfläche „Ton, Achtsamkeiten, drei Fragen"
ohne den Wizard-Editor: 2–3 PT — ein Formular, das genau diese Felder der
Vorlage schreibt.

**Summe für den Kolping-Testlauf: rund 8 bis 13 PT**, davon Pflicht für einen
ersten Abend: Route + QR (0,5), Nennungsfelder live (1), Stimmung im Template
von Hand (0), kollektiver Abschluss (2–3). Der Rest kann nach dem ersten Abend
kommen. Keine Abhängigkeit von E0–E7.

## 3. Eine Zeile je geplantem D-Screen (Zweck des Auftrags)

| Screen (Landkarte 11.09.) | existiert | konfigurierbar | neu | Empfehlung |
|---|---|---|---|---|
| D-S2.2 Einwilligung zum Zitat | Felder `author_is_named`, `author_nickname` im Snapshot; kein Gate im Renderer | Felder in die live-Vorlage; Regel als Library-Einstellung | Gate im Renderer (klein) | **nicht als eigener Screen** zeichnen; eine Zeile „Name · Spitzname · ohne Namen" im Ernte-Screen |
| D-S4.4 Längeres Testimonial aufnehmen | `testimonial-recorder.tsx` mit Diktat und Transkript | Fragen und Ton im Template | Offline-Puffer, „Stellen streichen" | **streichen**: die Ernte sind zwei bis drei Sätze; das Streichen widerspricht Befund Punkt 6 |
| D-S6.1 Mein Zitat freigeben | `previewDetail`: die eigene formulierte Stimme vor dem Speichern | — | „zurückziehen" nach dem Absenden (S11) | zeichnen als **Vorschau im Ernte-Screen**, nicht als eigene Station |
| D-S4.5 Gespräch führen | nichts | — | alles | **streichen** (Befund Punkt 1) |
| D-S8b.3 Quellen für den Artikel wählen | `selectRelatedTestimonials`, alle vorgewählt | Schritt entfernen | — | **streichen** (Befund Punkt 3) |
| D-S10.1 Artikel veröffentlichen | `event-finalize-de` → `publish-final` (Index-Swap) | Library privat/öffentlich | Kanalwahl gibt es nicht, braucht es nicht | ersetzen durch den **kollektiven Abschluss** |
| **neu: Ernte-Screen** (drei Fragen, Diktat, Vorschau, bestätigen, in einem Zug) | zu 90 % `testimonial-recorder.tsx` | Fragen, Ton, Nennungszeile | Namensverifikation durch die Moderatorin (Feld) | **zeichnen** — das ist der Screen vom 23.12. |
| **neu: Kollektiver Abschluss** (Seite mit allen Köpfen, gemeinsam ansehen, einmal speichern) | Ergebnis-Renderer ohne Köpfe | Systemprompt „Mittel aller" | Abschluss-Screen mit Köpfen und einem Speichern; Gruppenbild | **zeichnen** — die Spezialität des Falls |

Für das Klickmodell heißt das: die Dialog-Spalte hat **zwei eigene Screens**
(Ernte, Abschluss) statt sechs, und beide liegen im Kern auf gebautem Code.

## 4. Gegenprobe an den bestehenden Konzepten (Teil 3)

### 4.1 `erfassungs-flow-wiederverwendung.md` (11.09.)

Die vierzehn Widersprüche bleiben für das SHF gültig; keiner fällt weg. Für den
Dialog-Fall kommen **fünf** dazu (Abschnitt 6). Von den neun Neubau-Posten
braucht der Dialog-Fall **sieben nicht**:

| Neubau-Posten (11.09.) | Dialog-Fall |
|---|---|
| Composer | nicht nötig — eine Stimme, ein Recorder |
| Anlagen-Modell | nicht nötig — kein Mehrquellen-Beitrag |
| Persistenter Beitragsentwurf | nicht nötig — zwei Minuten im Raum |
| Bewertungsart je Thema | entfällt (S6) |
| Regelsatz Sichtbarkeit | reicht als Library-Schalter |
| Synthese mit Belegspur | `event-finalize-de` ohne Belegspur reicht; Belegspur wäre ein Bias-Werkzeug |
| Organisation / Interessengruppe | Library je Gruppe |
| Einwilligung mit Zeitstempel, Widerruf | **bleibt** — als Nennungszeile plus Widerruf (S11), klein |
| SHF-Bauteile | — |

Die Analyse vom 11.09. hat in S1 den Testimonial-Write-Key korrekt beschrieben,
aber die tote Gast-Seite nicht gesehen, weil sie die API-Schicht geprüft hat.
Widerspruch 9 („öffentliche Gegenstücke existieren") ist um „nur per API"
zu ergänzen.

### 4.2 Detailkonzept Composer S4/S5

Der Composer bleibt für das SHF Neubau; der Testimonial-Wizard ist **nicht** der
halbe Composer:

- `collect-source-step.tsx` hält eine Quelle, ohne `multiple`, ohne Zustand je
  Anlage; `spoken` ist ein Label auf demselben Diktatfeld; die Audio-Job-Funktion
  ist toter Code (1.2). Vom Anlagen-Modell leistet er nichts.
- Was er leistet, ist der **Ernte-Fall**: Diktat mit Live-Transkript,
  Feld-Extraktion, Vorschau — genau das, was der Dialog braucht.
- Das Konzept sagt in 3.2, die Testimonial-Kette bleibe „bis Testimonials auf
  den Composer gezogen sind". Für den Dialog-Fall ist das die falsche Richtung:
  der Recorder ist fertiger als der Composer und darf nicht auf ihn warten.
  Empfehlung: die Testimonial-Scheibe („Offen", Punkt 3) aus dem Composer-
  Konzept **herausnehmen** und als eigene kleine Welle vor dem Composer führen.
- Neu dazu für das Konzept: der Gast-Pfad des Recorders ist heute nur per API
  erreichbar (1.3). Das Konzept setzt ihn als funktionierend voraus.

### 4.3 Architektur-Konzept, Wellen E0–E7

Der Dialog-Fall hängt an **keiner** der Wellen. Er braucht kein `capture.*`
(E0), keinen Composer (E1), keine `consents`-Entität (E2, eine Nennungszeile
reicht), kein Bewertungsmodell (E3), keine Regel-Engine (E4), keinen Wartekorb
unter Last (E5), keine Fassungskette (E6). Aus E7 braucht er den Widerruf.
Empfehlung: eine eigene Welle **D0 „Dialog auf Bestand"** (8–13 PT, Abschnitt
2) **neben** E0/E1, nicht davor und nicht dahinter — sie darf das SHF nicht
verzögern, teilt aber zwei Reparaturen, von denen das SHF später profitiert
(Gast-Route, Medien-Vertrag im Bildupload).

Was E0–E7 vom Dialog-Fall lernen: der Regelsatz `capture.*` sollte den Fall
„keine Kuratierung, alle Beiträge ins Ergebnis, Synthese ohne Auswahl" als
gültige Konfiguration kennen (heute implizit über die Rolle).

### 4.4 Aufwandsbilanz

Die 45 bis 65 PT der Plattformseite bleiben für das SHF stehen; der Dialog-Fall
zieht nichts davon ab und fügt 8 bis 13 PT hinzu, die ohne das SHF-Fenster
laufen können. Wer beide zusammen rechnet, kommt auf 53 bis 78 PT; wer den
Dialog-Fall als Vorlauf nimmt (Gast-Route, Nennungsfelder, kollektiver
Abschluss), hat für das SHF einen live erprobten kontolosen Pfad — und die
Entscheidung vom 11.09. („kein Zugang ohne Konto") würde dann für das SHF
gelten, nicht für alles.

## 5. Offene Entscheidungen (Owner)

1. **Gast-Zugang für den Dialog-Fall öffnen?** Die Reparatur ist eine Zeile in
   der Middleware plus die QR-Weiche. Die Entscheidung vom 11.09. gilt für das
   SHF; für den Dialog-Fall muss sie ausdrücklich anders lauten oder der Fall
   wird bis auf Weiteres nicht bedient (Befund 12.09., Punkt 6).
2. **Schlüssel nur während der Sitzung:** Ablauf am Key (`expiresAt` im
   Frontmatter, geprüft in `assertTestimonialWriteAccess`) oder manuelles
   Zurücksetzen durch die Moderatorin nach dem Abend? Das Owner-Modell verlangt
   das eine oder das andere; heute gibt es keins.
3. **Nennungsstufen live oder nur Name/kein Name?** Drei Stufen stehen im
   Snapshot; live gibt es eine. Und: soll `author_is_named` im Renderer wirken
   (heute wirkungslos)?
4. **Inbox-Konformität des Gast-Pfads (ADR 0004):** jetzt reparieren (3–5 PT,
   Submission statt Direktschreiben) oder als bekannte Ausnahme bis zur
   Composer-Scheibe stehen lassen? Für den Kolping-Test nicht nötig.
5. **`events/finalize` löschen** (kein Aufrufer, Phase 6) — bleibt laut
   Leitplanke ohne Entscheidung liegen.
6. **Kollektiver Abschluss:** ein Speichern für alle durch die Moderatorin am
   Beamer (heute im Login-Wizard möglich, nur ohne Köpfe) oder ein eigener
   Screen ohne Anmeldung? Das entscheidet, ob es 1 PT oder 3 PT sind.
7. **Widerruf:** bis zum Abschluss (Claim-Token, Löschen erlaubt) oder auch
   danach (dann Fassungsfrage im Ergebnis)?

## 6. Widersprüche Konzept/Handover gegen Code (neu, Dialog-Fall)

| Nr. | Handover / Konzept sagt | Code sagt | Folge |
|---|---|---|---|
| D1 | „Zugang ohne Konto — gebaut und im Einsatz" | API ja, Seite nein: `/public/testimonial` nicht öffentlich (`src/middleware.ts:39-52`), QR zeigt auf den Login-Wizard (`session-detail.tsx:663`) | Betrieb im Februar lief angemeldet; Reparatur klein |
| D2 | „`author_is_named`, `author_nickname` … drei Nennungsstufen, im Moment entscheidbar" | nur im Repo-Snapshot; live `speakerName`; kein Gate im Renderer; Discovery liest `author_name` nie | Nennungsstufen sind Konfiguration plus ein kleiner Renderer-Schalter, nicht Bestand |
| D3 | „`event-testimonial-creation-de` … Vorschau" als Teil eines Flows mit Publish | Flow endet bei `previewDetail`; Speichern schreibt direkt in den Provider, ohne Inbox | ADR 0004 gilt für diesen Pfad heute nicht |
| D4 | Handover: `src/app/api/events/publish-final`, `events/finalize` | liegen unter `src/app/api/library/[libraryId]/events/`; `finalize` ohne Aufrufer | Pfadangabe; `finalize` kann in Phase 6 fallen |
| D5 | „Gruppenbild: reicht ein Feld im Template?" | Feld plus Schritt plus Medien-Vertrag; der Wizard-Bildupload bricht den Vertrag heute schon (`upload-images-step.tsx:75-88`) | Reparatur trägt für alle Wizards |
| D6 | Handover und Befund: „sechs Snapshots, alle mtime 15.01.", „existiert seit dem 15.01.2026 — dem Tag der Kolping-Vorbereitung" | Git: die Dialograum-Familie kam am **02.01.2026** (`6e5c9c0e`), die Event-Familie am 13.–15.01. (`630ea0f9`, `6f3b697f`); die Datei-mtime ist das Checkout-Datum | zwei Familien, zwei Entstehungszeiten: der Dialograum-Entwurf ging der Kolping-Vorbereitung um zwei Wochen voraus und wurde nie in eine Library importiert |
| D7 | Templates-Vorbefund: `cast-event-creation-de` „Standard-Template" | in Mongo ist kein `isDefault`-Feld an den Templates; Standard wird über `followWizards` bzw. den hartkodierten Default `'event-finalize-de'` (`creation-wizard.tsx:1571`) aufgelöst | Begriff „Standard" meint die Verkettung, nicht ein Flag |

## Verweise

- Handover 12.09. und Befund Kolping-Gespräche: Archiv
  `24.09 KnowledgeScout/2026-09-10 Konzept Erfassungs-Flow generisch und mobil/`
- `docs/analysis/erfassungs-flow-wiederverwendung.md` (Branch
  `claude/clever-hypatia-8ar4yd`), Composer-Detailkonzept und
  Architektur-Konzept (Archivkopien vom 11.09.)
- ADR 0003, 0004, 0006; `docs/contracts/media-lifecycle.md`
- `docs/STAND.md`, Vorhaben 3 (Dialog-Fall ist nicht Teil davon)
