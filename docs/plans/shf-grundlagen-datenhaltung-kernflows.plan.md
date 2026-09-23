---
name: shf-grundlagen-datenhaltung-kernflows
overview: "Grundlagen vor Oberflächen: Stand des Erfassungs-Wizards und des Wizard-Editors, was davon das SHF braucht; Datenmodell der Beteiligungs-Domäne (wo was gespeichert wird); die vier Kernflüsse Erfassen, Verdichten, Messen, Veröffentlichen mit den bestehenden Transformations-Bausteinen; Modul-Schnitt; Bau-Reihenfolge G0–G8 plus Nebenstrang W. Owner-Auftrag 23.09.2026: erst saubere Datenhaltung und Kernflüsse, der 05.10. ist kein Schnittkriterium. Visuell: Figma-Datei „KnowledgeScout — Modul-Landkarte“."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# SHF-Grundlagen: Datenhaltung, Kernflüsse, Wizard-Naht

**Stand:** 2026-09-23, geprüft gegen `master` 579f2d7 (v1.2.262).
**Auftrag (Owner, 23.09.):** Die Anwendung Schritt für Schritt richtig
bauen, nicht nach dem Termin am 05.10. schneiden; zur Not wird am 05.10.
nur das Klickmodell gezeigt. Zuerst die Datenhaltung und die Kernflüsse
(Texte verarbeiten, speichern, synthetisieren, mit den
Transformationslogiken) und die Einbindung in die bestehende Anwendung.
Danach die User Stories.

**Visuell:** Figma „KnowledgeScout — Modul-Landkarte“
(https://www.figma.com/design/lq5lUzASBUkhDfjd7XeTqt, intern). Sieben
Domänen × vier Schichten, je Karte *vorhanden · fertigstellen · neu*,
darunter der Datenfluss K1–K4 und die Bau-Reihenfolge.

**Verhältnis zu den anderen Plänen:** Der Wellen-Plan
[`shf-umsetzung-wellen.plan.md`](shf-umsetzung-wellen.plan.md) bleibt die
Liste der Screens und Abnahmen. Seine Reihenfolge (Welle 1 ab dem 05.10.)
ersetzt dieser Plan: erst G0–G8, dann die Oberflächen U1–U4. Die Konzepte
[`erfassungs-architektur-stationen-datenhaltung.plan.md`](erfassungs-architektur-stationen-datenhaltung.plan.md)
und [`erfassungs-composer-s4-s5.plan.md`](erfassungs-composer-s4-s5.plan.md)
gelten weiter. Wo dieser Plan von ihnen abweicht, sagt er es.

## 1. Der Erfassungs-Wizard: was gebaut ist, was offen ist, was das SHF davon braucht

### 1.1 Wie der Wizard heute arbeitet

Ein Wizard ist heute **ein Template mit eingebautem `creation`-Block**
(Quellen, Schrittliste mit Presets, Vorschau, UI-Texte). Die Route
`/library/create/[typeId]` lädt das Template, und `creation-wizard.tsx`
lehnt es ab, wenn `creation.flow.steps` fehlt (`creation-wizard.tsx:304-313`).
Der Rest:

- **Schritt-Maschine:** 11 der 13 Presets laufen über die Registry
  (`engine/step-registry.tsx:34-46`). `publish` steht noch als ~720 Zeilen
  im Monolithen (`creation-wizard.tsx:2454`–`:3172`, Datei 3.302 Zeilen).
- **Zwei Speicherwege:** Flows mit `publish`-Schritt schreiben eine
  Submission in die Inbox (ADR 0004). Flows ohne `publish` (Testimonial,
  Dialograum) schreiben per `handleSave()` **direkt ins Archiv**
  (`:1172`, `:1179`, Uploads `:1952`–`:2113`).
- **Publish-Weichen nach Template-Namen:** `isEventFinalize`,
  `isEventPublishFinal`, `isPdfAnalyse` (`:2462-2465`). Die Event-Flows
  rufen `events/publish-final` (`:2730`, `:2825`). pdfanalyse ist
  abgeschaltet, der Code steht noch da.
- **Flow-Entität `kind: 'wizard'` (ADR 0003, Weg B):** Typ, Seed und
  Filterung sind da. Gelesen wird sie nie: `resolveWizardFlow` hat keinen
  Aufrufer, und der Seed `standard-capture` wird bei jedem Aufruf von
  `me/capture` geschrieben, aber nicht verwendet (`flow-seed.ts:28-39`). Die
  Karte „Inhalt erfassen“ startet in Wahrheit `file-transcript-de`
  (`capture-wizards.ts:32-41`).
- **Feldbindung:** über eine Namens-Sperrliste
  (`editable-fields.ts:24-51`). Die generische Bindung an `kind=content`
  aus ADR 0003 (Nachtrag O1) ist **nicht** gebaut. Das Architektur-Konzept
  führt sie irrtümlich als gebaut.
- **Auswertung:** Datei-Medien laufen nur dann im Hintergrund, wenn der
  Flow `selectSchemaType` enthält (`file-flow.ts:24-29`). Alles andere
  läuft synchron. `resolveComputeMode` hat keinen Aufrufer.
- **Kuratierung `captureWizards`:** Sie wirkt nur auf der Übersichtsseite,
  und ohne Einstellung werden weiter alle Templates gezeigt (entgegen der
  Owner-Entscheidung „nur Standard“).

### 1.2 Was offen ist (geprüft)

| Baustein | Stand | Beleg |
|---|---|---|
| Submission-Modell, Repo, Statusmaschine, Inbox-UI, Promotion + RAG (U0, U7) | gebaut | `src/lib/submissions/**`, `api/submissions/**` |
| Step-Registry (U1) | gebaut, ohne `publish` | `step-registry.tsx:34-46` |
| Kanonischer Zustand (U2) | halb: Selektoren, weiter `useState` | `engine/wizard-state.ts` |
| Generische Feldbindung (U3, O1) | halb: Sperrliste statt `kind` am Feld | `editable-fields.ts`, `template-types.ts:230` |
| Ein Commit in die Inbox für alle Flows (U4) | halb: nur Flows mit `publish` | `creation-wizard.tsx:1172`, `:1179` |
| Auswertung im Hintergrund für alle Medien (U5c) | halb | `file-flow.ts:24` |
| Ein Einstieg (U6) | gebaut; offen: toter pdfanalyse-Code, E2E | `u6-handover.md` |
| Flow-Entität zur Laufzeit (W-A, Δ1) | halb: geschrieben, nie gelesen | `wizard-flow-entity.ts:120-127` |
| Eingebaute Flows als Datensätze (W-D) | offen: Konstanten im Code | `builtin-creation-templates.ts:16` |
| Monolith < 400 Zeilen, `window`-Hack weg (3-VI-f) | offen | `creation-wizard.tsx:63`, `:1192` |
| Alt-Endpunkte `events/finalize`, `events/publish-final` (Phase 6) | offen | `finalize` ohne Aufrufer |
| Schema-Vererbung `extends` (R1), Schema-Konfiguration je Library (R2) | offen | Roadmap |
| Wizard-Editor als eigenes Werkzeug (ADR 0003 Phase 4, W-G) | offen, vom Owner auf nach dem Freeze gelegt | — |

### 1.3 Der Wizard-Editor

Es gibt **einen** Editor: den Tab „Creation Flow“ im Template-Editor
(`structured-template-editor.tsx:386`, `CreationFlowEditor`). Er bearbeitet
den `creation`-Block **eines** Templates: Quellen, Schritte (sortierbar,
Felder für `editDraft`), Willkommenstext, UI-Texte, Folge-Wizards, JSON
ein und aus. Seine Preset-Liste ist veraltet (`selectSchemaType`,
`selectFolderArtifacts`, `completion`, `chooseSource` fehlen,
`structured-template-editor.tsx:955`). Die Validierung ist schon
ausgelagert (`creation-flow-validation.ts`). Daneben gibt es in den
Library-Einstellungen den Kuratierungs-Editor
(`capture-wizards-editor.tsx`). Er wählt Wizards aus und ordnet sie, er
bearbeitet keine Abläufe.

Es fehlt ein Editor für eigenständige Flows (`kind: 'wizard'`). Die
Flow-Dokumente werden sogar aus der Template-Liste herausgefiltert
(`template-service-mongodb.ts:169`), `standard-capture` ist also
unsichtbar. Es fehlen auch ein Schema-Editor und die Pflege von
Feld-Metadaten.

### 1.4 Hat das mit dem SHF zu tun?

**Mit der Erfassung ja, mit dem Rest nein.** Die Antwort in drei Teilen:

1. **Der Composer ist ein Flow der Erfassung.** Er ist S4/S5 der
   Stationen und benutzt dieselbe Rückseite: Submission, Inbox, Analyse-Job,
   Promotion. Deshalb gehört er an die Naht aus ADR 0003: ein Flow
   `shf-beitrag` als `kind: 'wizard'`-Datensatz, den `resolveWizardFlow`
   zur Laufzeit liest (G4). Die Schritt-Maschine des Monolithen braucht er
   nicht. Der Composer ist ein Screen ohne Felder, also hängt er weder an
   der Feldbindung (U3) noch an `publish` im Monolithen.
2. **Tisch-Laufzeit, Messung und Synthese sind keine Wizards.** Sie sind
   eine eigene Domäne (Abschnitt 2) mit eigenen Collections und eigenem
   Modul. Die Redaktion (R-S0.x) ist **nicht** der Wizard-Editor. Sie pflegt
   Treffen, Tische, Themen und Verfahren, keine Abläufe.
3. **Der Wizard-Editor wird für das SHF nicht gebraucht.** Der Flow
   `shf-beitrag` kommt als Seed. Die Leitfrage hängt am Thema bzw. an der
   Runde, nicht am Flow. Der Editor bleibt Phase 4 von ADR 0003, nach dem
   Freeze.

**Ein Fund, der zählt:** Die Kette *Event → Testimonial → Event
finalisieren / Dialograum-Ergebnis* (`event-creation-de`,
`event-testimonial-creation-de`, `event-finalize-de`,
`dialograum-ergebnis-de` mit `selectRelatedTestimonials` → `generateDraft`)
ist fachlich dieselbe Domäne wie das SHF: Treffen, Beiträge, verdichtetes
Ergebnis. Sie läuft aber über den Direktschreibweg ins Storage, ohne Inbox,
ohne Belegspur und ohne Messung. Die neue Beteiligungs-Domäne ist ihre
saubere Fassung. Die Alt-Kette bleibt, bis Phase 6 entschieden ist. Danach
kann sie auf die neue Domäne umziehen, das ist ein eigenes Vorhaben.

**Welche offenen Wizard-Punkte auf dem SHF-Weg liegen:** nur W-A (die
Flow-Entität zur Laufzeit lesen) als G4. Alles andere, also U4, C8,
Namensweichen, Phase 6, Monolith und Editor, ist der **Nebenstrang W**
„Wizard fertigstellen“. Er ist sauber abgrenzbar, blockiert das SHF nicht
und kann parallel oder danach laufen (Abschnitt 5).

## 2. Das Datenmodell: wo was gespeichert wird

### 2.1 Die Regel (unverändert aus dem Architektur-Konzept)

| Art | Ort |
|---|---|
| **Wissen**, das man wiederfinden, zitieren und zeigen soll | Storage-Provider: Markdown mit flachem Frontmatter, dazu Vektor-Sammlung (chunk, meta) und Shadow Twin in MongoDB |
| **Verfahren**, also der Zustand eines laufenden Vorgangs | MongoDB, eigene Collections |
| **Rohdaten** (Audio, Foto, PDF) | Azure-Blob-Inbox `{lib}/inbox/{user}/…`, nach der Promotion Kopie ins Ziel |
| **Personenbezug** | MongoDB an Teilnahme und Beitrag; ins Frontmatter nur die Zuschreibungsstufe (Gruppe) |

### 2.2 Was bleibt, wie es ist

`libraries` (Konfiguration), `library_members` (vier Rollen),
`library_access_requests`, `templates` (Schemas, Flows, jetzt auch die
Synthese-Vorlage), `external_jobs` (Queue), `shadow_twins__<lib>`
(Transkripte und Transformationen, MongoDB zuerst), die Vektor-Sammlung je
Library (`kind: chunk | chapterSummary | meta`), `aktions_protokoll`
(Begründungen), `source_user_states` (Sterne; das gehört zum Erkennen und
bleibt getrennt von der Messung), `overlap_reports` (Muster für
Bericht-Objekte).

### 2.3 Was wächst: `wizard_submissions` (der Beitrag)

```ts
// Ergänzung an WizardSubmission (src/types/wizard-submission.ts)
attachments: SubmissionAttachment[]      // Composer-Konzept §1.2; Zustand je Anlage
context?: {                              // flach, nur Ids
  meetingId: string; tableId: string; topicId: string; windowId?: string
}
attribution?: {
  displayName: string; organisation?: string; group?: string
  capturedBy?: string                    // Vertretung: E-Mail der Moderation
  channel?: 'self' | 'note' | 'proxy'    // Zettel, Vertretung
}
// Status: draft (neu als Start) … pending … ; neu: 'withdrawn' (Widerruf bis
// zum Tisch-Abschluss), 'removed' (herausgenommen, Grund Pflicht, für alle sichtbar)
```

`binaryRefs` wird eine abgeleitete Sicht über einen Adapter (Composer-Konzept
§1.3). Die heutige Maschine ab `pending` bleibt. **Abweichung vom
Composer-Konzept:** Es gibt keinen `proposal` mit Feldern, denn der
SHF-Composer hat keine Felder. Die Transformation des einzelnen Beitrags
ist optional (K1, Schritt 4).

### 2.4 Was neu ist: die Beteiligungs-Domäne

Code-Namen englisch (Repo-Regel), Fachbegriff dahinter.

| Collection | Fachbegriff | Inhalt (flach, nur das Nötige) |
|---|---|---|
| `meetings` | Treffen | `libraryId`, `series` (Reihe), `title`, `date`, `mode: presence \| online \| inbetween`, `state: prepared \| running \| paused \| closed`, `agreement[]` (die vier Sätze der Tischvereinbarung), `settings` (Seed für `capture.*` und `konsens.*`) |
| `meeting_tables` | Tisch | `meetingId`, `number`, `fieldOfAction` (Handlungsfeld), `groupIndex` (Gruppe 1, 2 … je Handlungsfeld), `moderators[]`, `qrToken`, `qrValidUntil`, `topics[]` (fileIds der Themen), `agenda[]`, `run` (laufender Punkt, Start, Verlängerung, angehalten), `windows[]` (Ernte-/Messfenster: Art, Thema, offen von, geschlossen am) |
| `table_participations` | Teilnahme | `meetingId`, `tableId`, `userEmail`, `arrivedAt`, `displayName`, `organisation`, `group`, `agreementReadAt`, `role: participant \| moderation \| expert` |
| `measurements` | Messung | `libraryId`, `topicId`, `tableId`, `variant: A \| B \| C`, `scale: levels4 \| resistance0to10`, `rounds`, `options[]` (Text, Herkunft, Position, Passivlösung **immer**, in A verborgen), `windows[]`, `state: prepared \| open \| paused \| evaluated \| closed`, `escalatedFrom?` |
| `assessments` | Stellungnahme | `measurementId`, `optionId`, `userEmail`, `round`, `value` (Stufe oder 0–10), `reason?`, `createdAt`; eindeutig je (Messung, Option, Person, Runde) |
| `syntheses` | Synthese mit Fassungen | `libraryId`, `topicId`, `tableId`, `versions[]` (unveränderlich: `seq`, `markdown`, `statements[] {text, evidence[] {submissionId, quote?}}`, `coverage {total, cited, uncited[]}`, `createdAt`, `createdBy`, `jobId`, `restoredFrom?`), `pointer {current, latest}`, `confirmedByTable? {version, at}`, `releasedByEditors? {version, at}` |

**Nicht als Collection, sondern berechnet:** der Zustand je Thema
(„im Konsent“, „Einwand offen“; aus Messungen), „Meine Beiträge“ (aus
Submissions, Belegen und Stellungnahmen), die Historie je Gruppe (aus
`meetings` und `syntheses`), „wer hat noch nicht beigetragen“ (aus
Teilnahmen und Submissions).

**Abweichungen vom Architektur-Konzept:**
- `assessment_windows` entfällt, die Fenster liegen in `measurements.windows[]`
  (Konzept 13.09.).
- `consents` entfällt vorerst. Die Tischvereinbarung ist `agreementReadAt`
  an der Teilnahme; ein eigenes Objekt kommt erst, wenn V2/V3 eine
  Zustimmung je Zweck verlangt.
- Das Profil liegt an der Teilnahme je Treffen, nicht an `library_members`.
- `capture.*` und `konsens.*` stehen als Einstellungen am Treffen, nicht
  als Library-Feld (die Redaktion stellt je Treffen ein).

### 2.5 Was ins Storage kommt

| Was | Pfad (Pfadvorlage, konfigurierbar) | Frontmatter (flach) |
|---|---|---|
| Thema (Textstelle des Grundsatzdokuments) | `Veranstaltungen/{reihe}/Themen/` | `docType: thema`, `handlungsfeld`, `abschnitt_art: vision \| vortext \| ziel \| indikator`, `kapitel`, `reihenfolge` |
| Ergebnis (bestätigte Fassung je Thema und Tisch) | `Veranstaltungen/{reihe}/{treffen}/Ergebnisse/` | `docType: ergebnis`, `reihe`, `treffen`, `tisch`, `thema`, `gruppe`, `fassung`, `synthese_id` |
| Beitrag, nur bei V2/V3 | `Organisationen/{organisation}/Beiträge/{reihe}/{treffen}/` | `docType: beitrag`, `thema`, `tisch`, `gruppe` |
| Vision (Foto + Text der Gruppe 1) | `Veranstaltungen/{reihe}/{treffen}/Ergebnisse/` | `docType: ergebnis`, `abschnitt_art: vision`, Bild als Datei daneben |

Belege bleiben in MongoDB (`submissionId`). Im Markdown des Ergebnisses
stehen nur Fußnoten-Marker. Stimmen, Werte, Fenster, Personen und
Fassungsketten gehen nie ins Frontmatter.

## 3. Die Kernflüsse und welche Bausteine sie wiederverwenden

### K1 · Erfassen und verarbeiten (ein Beitrag)

1. Der Composer legt beim ersten Zeichen eine Submission `draft` mit
   `context` an. Text und Live-Mitschrift sind eine Anlage `text`. Die
   Mitschrift kommt aus `LiveDictationTextarea` (OpenAI Realtime über
   Tickets des Secretary), der Mitschnitt geht optional als Audio in die
   Inbox.
2. Foto, PDF und Audio gehen als Anlage in die Blob-Inbox. **Ein Job je
   Anlage** (`providerScope: 'inbox'`, extract ohne ingest) liefert den Text
   zurück in die Anlage. PDF und Audio laufen über den Bestand. Das Foto
   braucht die Verdrahtung auf den Vision-Weg des Secretary
   (`image-analyzer.ts`), die für Submissions fehlt.
3. „Beitragen“ setzt `pending`. Späte Ergebnisse schreiben nur in die
   Anlage, nie in den abgegebenen Text (Composer-Konzept §2.2).
4. *Optional:* eine Transformation des Beitrags mit der Vorlage
   `shf-beitrag-de` (Kernaussagen, Bezug zum Thema), gespeichert in
   `submission.metadata`. Sie hilft der Synthese bei langen Beiträgen. Ob
   sie nötig ist, zeigt der erste Probelauf von K2 und muss nicht vorab
   gebaut werden.

### K2 · Verdichten (Synthese mit Belegspur)

1. Die Moderation schließt das Ernte-Fenster und löst die Synthese aus.
2. **Sammlung aus Beiträgen:** Ein neuer Quell-Adapter baut aus den
   Submissions des Themas (ohne `removed` und `withdrawn`) die
   `<source id="…">`-Blöcke. Er folgt dem Muster von
   `resolveCompositeTranscript` (`composite-transcript.ts:719-803`), liest
   aber `wizard_submissions` statt Shadow Twins. Die Quelle ist eine
   Datenbank-Sammlung, keine Datei. Deshalb ist es ein eigener Adapter und
   keine Sammeldatei im Storage (ADR 0004: nichts ins Ziel vor dem
   Abschluss).
3. **Neuer Jobtyp `synthesis`** in `external_jobs`, nach dem Muster des
   Sonder-Jobtyps `overlap-report` (`start/route.ts:227-298`,
   `phase-overlap-report.ts`). Die Transformation läuft wie jede andere
   über den Secretary (`callTemplateTransform`, `template-run.ts`), mit der
   Vorlage `shf-synthese-de` aus `templates`. Die Vorlage folgt
   `GRUNDSAETZE.md` §5 (alle Stimmen · Fokus · zur Messung). Sie gibt
   Aussagen mit Beleg-Ids als strukturiertes Ergebnis zurück.
4. **Belegprüfung in der App**, deterministisch wie die Nachrechnung beim
   Overlap-Bericht:
   - Jede Beleg-Id existiert und gehört zum Thema.
   - Jede Aussage ohne Beleg wird markiert.
   - `coverage` zählt, welche Beiträge vorkommen. Die nicht zitierten
     werden genannt, als Prüffrage 1: „Kommt jede Stimme vor?“
5. Das Ergebnis wird eine neue, unveränderliche Fassung in `syntheses`.
   „Übernehmen“ setzt nur den Zeiger. Neu erzeugen legt eine weitere
   Fassung an und löscht nichts.

### K3 · Messen (Einwandverfahren A, erweiterbar auf B/C)

1. Die Messung wird zum Thema angelegt. Option 1 ist die übernommene
   Fassung, die Passivlösung steht immer als Option im Modell und ist in A
   verborgen.
2. Das Fenster öffnet sich, die Stellungnahmen gehen in `assessments`.
   Solange das Fenster offen ist, gibt die API niemandem Werte heraus, auch
   der Moderation nicht; sie bekommt nur „wer hat abgegeben“.
3. Die Auswertung ist eine reine Funktion (Verteilung, Gruppenprofil ab
   einer Mindestgröße, Delta ab Runde 2). Dazu kommt der Abbruchhinweis:
   „keine Änderung nach Runde 2 → abschließen“. Die Entscheidung trifft die
   Moderation.
4. Anhalten und Fortsetzen ändern nur den Zustand, gesammelte Werte bleiben.

### K4 · Veröffentlichen

1. **Tisch-Abschluss:** Der Tisch bestätigt eine Fassung
   (`confirmedByTable`). Danach ist kein Widerruf mehr möglich.
2. **Promotion „Ergebnis“:**
   - Die Fassung wird Markdown mit flachem Frontmatter und kommt über die
     Pfadvorlage ins Storage (`provider.uploadFile`, find-or-create der
     Ordner).
   - Danach folgt `IngestionService.upsertMarkdown`, also Vektoren und
     Meta.
   - Das ist eine neue Variante neben `promoteSubmission`, auf derselben
     Grundlage (`promotion.ts`, `publish-frontmatter.ts`).
   - Den heutigen Standardordner `root/inbox` ersetzt die Pfadvorlage.
3. Auffindbar ist das Ergebnis dann über Galerie und Explorer (Bestand) und
   im Chat mit Quellen (Bestand, Freigabe für `contributor` fehlt).
4. **Freigabe durch die Redaktion** (Fassung 1 → 2 → 3) ist dieselbe
   Promotion mit `releasedByEditors`. Sie schreibt eine neue Datei-Fassung,
   die alte bleibt.

## 4. Einbindung in die bestehende Anwendung: Module

Nach ADR 0007 und `docs/architecture/modul-landkarte.md`:

| Paket | Was hineinkommt | Warum dort |
|---|---|---|
| `@ks/contracts` (Bestand) | Typen der Beteiligungs-Domäne und die Erweiterung der Submission | gemeinsam genutzt von App, Modul und Tests |
| `@ks/module-creation` (Zielbild, heute `src/lib/{creation,submissions}`) | Anlagen, Job je Anlage, Foto → Text, Flow `shf-beitrag`, Composer-Bausteine (bisher als `@ks/capture` geplant) | Der Composer ist Erfassung. Ein eigenes Paket `@ks/capture` lohnt erst, wenn er außerhalb der App montiert wird. **Abweichung vom Composer-Konzept §4.1** |
| **`@ks/module-deliberation` (neu)** | Treffen, Tische, Teilnahme, Lauf und Fenster, Messung, Synthese-Ansichten, Moderation, Redaktion; Route-Handler-Fabriken für `api/deliberation/**` | eine Fachdomäne mit eigenem Lebenszyklus, nicht SHF-spezifisch (Dialogformate, Foren); in der App bis zum Paketschnitt unter `src/lib/deliberation/**` |
| `src/lib/external-jobs` (Bestand) | Jobtyp `synthesis`, Quell-Adapter „Beiträge“ | Queue, Worker und Secretary-Anbindung liegen dort; Contract `contracts-story-pipeline` gilt |
| `src/lib/submissions` (Bestand) | Promotion-Variante „Ergebnis“, Pfadvorlagen | dieselbe Promotion, ein neues Ziel |
| `templates` (Daten) | `shf-synthese-de`, optional `shf-beitrag-de`, Schemas `thema`, `ergebnis` | Vorlagen sind Daten, kein Code |
| `@ks/ui` (Bestand) | Theme `[data-theme="shf"]` aus den Figma-Variablen | eine Site-Farbgebung, keine App-weite Änderung |

`@ks/module-deliberation` importiert nichts aus Library-spezifischem Code.
Das SHF ist eine **Konfiguration** der Domäne (Seed am Treffen, Vorlagen,
Theme), kein eigenes Paket.

## 5. Bau-Reihenfolge

Jede Scheibe ist eine PR, für sich lauffähig, mit `pnpm test`, `pnpm lint`
und dem vollständigen `tsc`-Vergleich (`AGENTS.md`). Die Scheiben G0–G8
haben keine Screens. Sie sind über Tests und Skripte prüfbar.

| Scheibe | Inhalt | Wiederverwendet | PT |
|---|---|---|---|
| **G0** | ADR 0011 „Beteiligungs-Domäne“ (Collections, Naht zum Wizard, Modul-Schnitt), Typ-Baseline, Freeze-Tests für die berührten Stellen (`applyAnalysisResult`, `promoteSubmission`, Statusmaschine) | — | 0,5–1 |
| **G1** | Typen und reine Zustandsfunktionen: Treffen, Lauf, Fenster, Messung (inkl. Anhalten), Beitragsstatus mit `withdrawn`/`removed`, Stille-Runde-Filter, Auswertung | Muster `submission-status.ts` | 1,5–2 |
| **G2** | Repos mit Indizes (`meetings`, `meeting_tables`, `table_participations`, `measurements`, `assessments`, `syntheses`), Seed-Skript für ein Probe-Treffen mit Themen als `docType: thema` | `mongodb-repository-pattern.md` | 1,5–2 |
| **G3** | Beitrag erweitern: `attachments` mit Adapter, `context`, `attribution`, `draft` als Start, Anlagen-Routen, Job je Anlage, Foto → Text | Composer-Konzept C1/C2; `submission-analysis-job.ts`; `image-analyzer.ts` | 2,5–3,5 |
| **G4** | Wizard-Naht: `resolveWizardFlow` zur Laufzeit, Flow `shf-beitrag` als `kind: 'wizard'`-Seed; `standard-capture` wird wirklich gelesen | `wizard-flow-entity.ts`, `flow-seed.ts` | 1–1,5 |
| **G5** | Synthese-Kern: Quell-Adapter „Beiträge“, Jobtyp `synthesis`, Vorlage `shf-synthese-de`, Belegprüfung, Fassungen in `syntheses`; Tests mit gemocktem Secretary | `composite-transcript.ts`, `phase-overlap-report.ts`, `template-run.ts` | 3–4 + Vorlage 1–2 |
| **G6** | Messung-Kern: Anlegen mit Passivlösung, Fenster, Stellungnahmen, Auswertung, Abbruchhinweis | G1 | 2–3 |
| **G7** | Promotion „Ergebnis“: Pfadvorlagen, flaches Frontmatter, Ingest; Tisch-Abschluss und Redaktions-Freigabe als Zustand | `promotion.ts`, `publish-frontmatter.ts`, `IngestionService` | 1,5–2 |
| **G8** | API im Modul: Route-Handler-Fabriken, Rechte (Moderation je Tisch, Redaktion), Beitritt per Tisch-QR (sicherheitsrelevant, Token mit Ablauf, Protokolleintrag), Stille Runde am Endpunkt, Chat-Loader für `contributor` | `api-route-conventions.md`, `library-members-repo.ts` | 2–3 |
| | **Summe Grundlagen** | | **16–23 + Vorlage** |

Danach folgen die **Oberflächen** auf fertigen Grundlagen. Die Screens und
Abnahmen stehen im Wellen-Plan:

- U1 Teilnehmende (QR, Platz, Vereinbarung, Composer, Meine Beiträge)
- U2 Moderation (Mein Tisch, Runde steuern, Beiträge am Tisch, Synthese, Tisch-Abschluss)
- U3 Messung und Beamer
- U4 Redaktion

Sie kosten zusammen etwa 20–28 PT, weil die Logik dann schon steht.

**Nebenstrang W „Wizard fertigstellen“** (blockiert das SHF nicht,
eigene PRs):

| Punkt | Inhalt | PT |
|---|---|---|
| W1 | Ein Commit in die Inbox für **alle** Flows (U4): Testimonial und Dialograum schreiben nicht mehr direkt ins Archiv | 2–3 |
| W2 | `publish` in die Registry, Weichen nach Template-Namen durch eine Strategie am Schema ersetzen (C8); toten pdfanalyse-Code entfernen | 1,5–2 |
| W3 | Phase 6: `events/finalize` löschen, `events/publish-final` ersetzen; Entscheidung, ob die Event-Kette auf die Beteiligungs-Domäne umzieht | 1–2 (+ Umzug eigenes Vorhaben) |
| W4 | Eingebaute Flows als Datensätze (W-D); `captureWizards`-Vorgabe „nur Standard“ wie entschieden; `findCreationType` beachtet die Kuratierung | 1–1,5 |
| W5 | Feldbindung über `kind` am Feld (U3/O1); Monolith unter 400 Zeilen, `window`-Hack weg | 3–4 |
| W6 | Wizard-Editor für `kind: 'wizard'`-Flows (ADR 0003 Phase 4), Preset-Liste aktuell | 3–5, nach dem Freeze |

## 6. Was vor G0 zu entscheiden ist

| # | Frage | Empfehlung |
|---|---|---|
| 1 | Name und Schnitt der neuen Domäne: `@ks/module-deliberation` mit englischen Collection-Namen | ja |
| 2 | Composer in `@ks/module-creation` statt eigenem Paket `@ks/capture` (Abweichung vom Composer-Konzept) | ja, eigenes Paket erst bei Montage außerhalb |
| 3 | `consents` vorerst nicht; die Tischvereinbarung als Zeitstempel an der Teilnahme | ja, bis V2/V3 entschieden ist |
| 4 | Die Synthese liest die Beiträge aus MongoDB (Quell-Adapter), keine Sammeldatei im Storage | ja (ADR 0004) |
| 5 | Nebenstrang W parallel oder danach? | danach, außer W1: der Direktschreibweg widerspricht ADR 0004 und sollte vor dem ersten echten Treffen weg sein |

## Verweise

- Figma-Landkarte: https://www.figma.com/design/lq5lUzASBUkhDfjd7XeTqt
- Wellen-Plan (Screens, Abnahme): [`shf-umsetzung-wellen.plan.md`](shf-umsetzung-wellen.plan.md)
- Konzepte: [`erfassungs-architektur-stationen-datenhaltung.plan.md`](erfassungs-architektur-stationen-datenhaltung.plan.md), [`erfassungs-composer-s4-s5.plan.md`](erfassungs-composer-s4-s5.plan.md)
- Wizard: `docs/adr/0003-wizard-schema-template-trennen.md`, `docs/wizards/umbauplan-generischer-erfassungs-wizard.md`, `docs/wizards/u6-handover.md`
- Muster: `docs/architecture/mongodb-repository-pattern.md`, `docs/architecture/api-route-conventions.md`, `docs/architecture/modul-landkarte.md`
- Contracts: `no-silent-fallbacks`, `storage-abstraction`, `contracts-story-pipeline`, `ingest-mongo-only`, `media-lifecycle`
