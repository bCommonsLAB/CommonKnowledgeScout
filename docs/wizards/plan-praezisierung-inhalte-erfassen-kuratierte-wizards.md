# Plan-Präzisierung: „Inhalte erfassen" als kuratierte Wizard-Liste

Status: Plan/Analyse (kein Code). Datum: 2026-06-18.
Ordnet sich ein in: `docs/roadmap-formatunabhaengige-library-und-onboarding.md`
(Plan 2), `docs/adr/0003-wizard-schema-template-trennen.md`,
`docs/wizards/umbauplan-generischer-erfassungs-wizard.md` (U0–U8),
`docs/adr/0004-capture-publish-entkopplung-inbox-modell.md`.
Verwandt: `docs/analysis/wizard-zwei-eingaenge-einfach.md`.

> Zweck: den vorhandenen Plan 2 an **zwei** Stellen präzisieren, damit das Zielbild
> erreichbar wird: (1) **ein geteilter Wizard-Flow** statt N kopierter `creation`-
> Blöcke (Redundanz weg), (2) **pro Library kuratierbar**, welche Wizards hinter
> „Inhalte erfassen" liegen. Reihenfolge bleibt: **erst Plan 1, dann Plan 2** —
> dies ist Detaillierung von Plan 2, nicht ein Vorziehen.

## 1. Zielbild (definitiv)

Drei Entitäten + eine Kuratierungs-Schicht:

1. **Schema** (`docType`): Felder (+`kind/inputType`, O1), `detailViewType`
   (Renderer), `systemprompt` (Extractor). Pro Inhaltstyp, geteilt — wird von
   Wizard **und** JobWorker konsumiert. (ADR-0003)
2. **Wizard-Flow**: Presets in Reihenfolge + Quelltypen + Welcome/Output/UI.
   **Generisch und geteilt** — bindet ein Schema **zur Laufzeit**. (ADR-0003)
3. **Library-Kuratierung** (NEU): pro Library eine **Auswahl + Reihenfolge**,
   welche Wizard-Flows hinter „Inhalte erfassen" erscheinen, mit Label/Icon und
   einem Default.

„Inhalte erfassen" zeigt damit eine **pro Library bewusst gesetzte** Liste von
Wizards. Der heutige „Datei importieren/transkribieren"-Flow wird der
**Standard-Wizard** (ein geteilter Flow, gespeichert wie jeder andere), nicht ein
im Code eingebackenes Sonder-Template.

## 2. Ausgangslage (verifiziert im Code, Stand 2026-06-18)

- **Flow = im Template gebündelt.** `TemplateCreationConfig` (`creation`-Block)
  steckt in jedem Template (`template-types.ts`): `supportedSources`,
  `flow.steps[]` (Preset-Vokabular), `welcome/output/ui`. → Jeder Wizard kopiert
  einen fast gleichen Block (genau die Redundanz). (ADR-0003 §Kontext)
- **Import-Flow = eingebautes Template.** `builtin-creation-templates.ts`:
  `file-transcript-de` (+ `audio-transcript-de`) sind vollwertige Templates mit
  `creation`-Block, **hardcodiert im Code**, per Name durch Library-Templates
  überschreibbar. → KEIN „Flow ohne Template", sondern ein **Built-in-Template**.
- **„Inhalte erfassen" listet AUTOMATISCH, nicht kuratiert.**
  `getLibraryCreationConfig` (`library-creation-config.ts`) nimmt **alle**
  Library-Templates mit `creation`-Block + mergt Built-ins (per Name). Es gibt
  **keine** per-Library-Auswahl/Reihenfolge/An-Aus. → Kuratierung fehlt komplett.
- **`transcriptOnly` ist verstreut.** ~15 `if (transcriptOnly)` in
  `creation-wizard.tsx` (Labels/Zähler/Speichern) statt einer sauberen Betriebsart.
- **Einstiege sind heute rollen-/ort-asymmetrisch (verifiziert 2026-06-18):**
  - **Explorer/Galerie:** `CaptureContentButton` (`capture-content-button.tsx`)
    geht **direkt** zum EINEN Wizard `file-transcript-de` (hardcodiert,
    `?from=gallery`). Sichtbar für owner/co-creator/**contributor** via
    `GET /api/libraries/[id]/me/capture` (sonst fail-closed verborgen). **Keine
    Übersicht.** Anonyme User: kein Button (`canCapture` braucht eine Rolle).
  - **Archiv:** Header-„+" (`library-header.tsx`) → `/library/create` = die
    **Übersicht/Chooser** (`getLibraryCreationConfig` listet alle). Archiv ist der
    Datei-Browser (owner/co-creator).
  → **Die Wizard-Übersicht fehlt im Explorer für Contributoren.** „Contributor →
  Wartekorb" ist hingegen schon erzwungen (Promote owner/co-creator-gated; im
  Wizard nur `isOwner` sofort, sonst Wartekorb).

## 3. Was der bestehende Plan schon abdeckt (nutzen, nicht neu erfinden)

- **ADR-0003**: Trennung Schema ⊥ Wizard, Laufzeit-Merge, O1 (generische
  Feldbindung) — entschieden.
- **Umbauplan U1** (Step-Engine datengetrieben), **U3** (Schema-Feld-Metadaten +
  generischer `editDraft`), **U4** (ein Submission-Commit), **U6** (EIN Einstieg
  „Inhalte erfassen" über den generischen Wizard), **U8** (Schema-/Wizard-Editor).
- **library-creation-config.ts** als bestehender Auflösungspunkt (hier dockt die
  Kuratierung an).

## 4. Die Präzisierungen (Deltas zum aktuellen Plan)

### Δ1 — Wizard-Flow als eigene, GETEILTE Entität (gehört in Plan 2a)

Heute „1 Flow pro Template (kopiert)". Ziel: **wenige geteilte Flows**, die ein
Schema **referenzieren** statt es zu bündeln. Konkret:
- Den `creation`-Block aus dem Schema-Template herauslösen (ADR-0003 2a) und als
  **Wizard-Flow-Entität** speichern (eigene Sammlung/Repo, wie andere Templates).
- Ein **generischer Standard-Flow** (Welcome → Collect → [SelectSchemaType] →
  Edit → Publish) deckt die meisten Fälle ab; Spezial-Flows nur, wo nötig.
- `templateDocumentToCreationType` liest dann aus der Flow-Entität, nicht aus dem
  Schema-Template. → **Redundanz der `creation`-Blöcke verschwindet.**

### Δ2 — Per-Library-Wizard-Kuratierung (NEU, eigenes Library-Config-Feld)

Neues Per-Library-Config-Feld (Checkliste: `library-config-field.mdc`), z. B.
`captureWizards`: geordnete Liste von `{ flowId, schemaRef?, label?, icon?,
enabled }` + optional ein `defaultFlowId`. Auflösung:
- `getLibraryCreationConfig` respektiert künftig diese Liste (Auswahl + Reihenfolge)
  **statt** „alle mit `creation`-Block". Fehlt die Config → dokumentierter Default
  (= Standard-Wizard + ggf. alle Schema-gebundenen), **kein** stiller Voll-Dump.
- So ist „welche Wizards hinter *Inhalte erfassen*" **pro Library** bewusst gesetzt.

#### Δ2b — Einstieg × Rolle × Speicherziel (aus dem Test-Befund)

Die Kuratierung braucht eine **Rollen-/Einstiegs-Dimension**, weil derselbe
„Inhalte erfassen"-Punkt je nach Ort und Rolle anders aussieht:

| Einstieg | Rolle | Was angeboten wird | Speicherziel |
|---|---|---|---|
| Explorer | anonym | **kein Zugang** (entschieden 2026-06-18: keine anonyme Erfassung) | — |
| Explorer | contributor | **kuratierte Übersicht** (heute: nur 1 Wizard) | **immer Wartekorb** |
| Explorer | owner/co-creator | kuratierte Übersicht | Wartekorb od. sofort Promote |
| Archiv | owner/co-creator | kuratierte Übersicht | Wartekorb od. sofort Promote |

Konkrete Lücke (heute nicht erfüllt): **die kuratierte Übersicht muss auch im
Explorer für Contributoren** erscheinen (statt nur des einen hardcodierten
`file-transcript-de`). Die „Contributor → Wartekorb"-Invariante ist bereits da
(Promote owner/co-creator-gated) und bleibt; es geht NUR um den **Übersichts-
Einstieg**. Dafür: `capture-content-button` von „direkt 1 Wizard" auf „kuratierte
Auswahl öffnen" heben (dieselbe Liste wie der Archiv-Chooser, gefiltert nach
Rolle/Einstieg), Speicherziel bleibt off-target Inbox.

### Δ3 — Import-/Diktat-Flow als gespeicherter Standard-Wizard

`file-transcript-de` / `audio-transcript-de` von **hardcodiert** → **gespeicherter
geteilter Flow** (seedbar), referenziert das passende Schema. Built-in-Fallback im
Code bleibt nur als Notnagel für leere Libraries (kein Silent-Override).

### Δ5 — Wizard-Editor vom Template-Editor entkoppeln (folgt Δ1)

**Anforderung:** Die einzelnen Wizard-Schritte müssen editierbar sein (Texte:
Titel/Beschreibung pro Schritt, Welcome, Reihenfolge).

**Heute (verifiziert):** Diese Fähigkeit existiert bereits als
`CreationFlowEditor` — aber als **Tab *innerhalb* des Template-Editors**
(`structured-template-editor.tsx`, Tab „Creation Flow"; editiert Schritt-Liste,
Titel/Beschreibung, Quellen, Welcome, + JSON-Import/Export). Es ist also an EIN
Template **gekoppelt**.

**Ziel (ADR-0003 „zwei Editoren"):** **Schema-Editor** (Datenmodell) getrennt vom
**Wizard-Editor** (Ablauf + Schritt-Texte). **Wichtig zur Zeitplanung:** Die
Entkopplung ist **nicht** U8-Spätkram, sondern die **direkte Folge von Δ1** —
sobald der Flow ein *geteilter* Baustein ist, ergibt „Flow im Editor *eines*
Templates bearbeiten" keinen Sinn mehr (man editiert einen von vielen Schemas
geteilten Ablauf). Der Wizard-Editor bearbeitet künftig die **geteilte
Flow-Entität**. Den vorhandenen `CreationFlowEditor` dabei **wiederverwenden**
(herauslösen), nicht neu bauen.

### Δ4 — `transcriptOnly` zur sauberen Betriebsart bündeln

Die verstreuten `if (transcriptOnly)` zu EINER Betriebsart „Flow ohne
Transformation" (Schema = nativer Quelltyp, nur Extract/Transkript) zusammenfassen
— im Zuge von U1/U4 (Step-Engine + ein Submission-Commit), nicht als Extra-Pfad.

### Klarstellung: „Werden die Abnahme-Felder dann nicht kompliziert?"

Häufige (berechtigte) Sorge: im Wizard werden Felder angezeigt/abgenommen, die an
ein bestimmtes Template hängen — wird das mit einem generischen Flow nicht kompliziert?

**Nein — es wird einfacher; die Komplexität ist die von heute.** Heute steckt
Feldwissen **im Wizard** (`edit-draft-step.tsx`: hartkodierte `getFieldLabel`-Map,
Textarea-/Array-Heuristiken) → der Schritt klebt am Template. Der Plan dreht das um:

- Felder gehören ins **Schema** als Feld-Metadaten (`kind=content/system/structural`,
  `inputType`, `label`, `order`) — ADR-0003 O1.
- Der Abnahme-/Edit-Schritt ist **generisch**: „alle `kind=content`-Felder in
  Schema-Reihenfolge". Der Flow **nennt nie einen Feldnamen**.
- Laufzeit: **Flow (generisch) + Schema (Felder) → Merge.** Welche Felder
  abgenommen werden, bestimmt das gebundene Schema, nicht der Flow.

**Schon halb gebaut (verifiziert):** `editableContentFields()`
(`src/lib/creation/editable-fields.ts`) = generische Feld-Bindung, bereits
gemergt; **generische Abnahme** läuft über `submission-review.ts`
(`contentRequiredFields(detailViewType)`) + `submission-edit-fields.tsx` —
template-übergreifend. Offen ist nur, das hartkodierte Wissen aus
`edit-draft-step.tsx` in die Schema-Feld-Metadaten zu verschieben (O1, gehört zu W-A).

**Editor-Aufteilung passt dazu:** Schema-Editor = *welche* Felder (Label/Typ/
Pflicht/Reihenfolge); Wizard-Editor = *Schritte* + Texte (ohne Feldnamen).

**Einziger echter Vertrag:** Ein Wizard bindet ein Schema (fest oder via
`selectSchemaType`) + **Kompatibilitätsprüfung** (editDraft-Schritt ⇒ Schema
braucht `content`-Felder) — ersetzt den heutigen stillen „zeig alle"-Fallback.

## 5. Arbeitspakete (eingehängt in den bestehenden U-Strang)

> DoD je WP: `pnpm test` + `pnpm lint` grün; sichtbare Story als E2E.

- **W-A (= 2a-Kern, vor allem anderen):** Schema ⊥ Wizard-Flow trennen; `creation`-
  Block in eigene Flow-Entität; **einen** generischen Standard-Flow etablieren.
  Baut auf U1/U3. → erfüllt Δ1.
- **W-B:** `library-creation-config.ts` auf **Kuratierung** umstellen (liest Δ2-
  Feld). Default ohne Config dokumentiert. → erfüllt Δ2 (Teil 1).
- **W-C:** Per-Library-Config-Feld `captureWizards` + Settings-UI („welche Wizards
  hinter *Inhalte erfassen*, Reihenfolge, Default"). Checkliste
  `library-config-field.mdc` strikt abarbeiten. → erfüllt Δ2 (Teil 2).
- **W-D:** Built-in-Flows → gespeicherte Standard-Flows migrieren (Seed), Code-
  Fallback nur für leere Libraries. → erfüllt Δ3.
- **W-E:** `transcriptOnly`-Betriebsart entwirren (mit U4). → erfüllt Δ4.
- **W-F:** **Explorer-Übersicht für Contributoren.** `capture-content-button`
  öffnet die **kuratierte Auswahl** (rollen-/einstiegs-gefiltert) statt direkt
  `file-transcript-de`; Speicherziel bleibt off-target Wartekorb. → erfüllt Δ2b.
- **W-G:** **Wizard-Editor entkoppeln.** `CreationFlowEditor` aus dem Template-
  Editor herauslösen → eigenständiger Wizard-Editor auf der **geteilten
  Flow-Entität** (Schritt-Texte/Reihenfolge editierbar). Läuft mit W-A (Flow-
  Trennung). → erfüllt Δ5.

Abhängigkeiten: W-A vor W-B/W-D/W-G; W-B vor W-C; W-C vor W-F; W-E mit U4. Alles
**nach Plan 1**.

## 6. Entscheidungen (Stand 2026-06-18 — alle bestätigt)

1. **Bindungs-Granularität des Standard-Wizards: ENTSCHIEDEN — beides zulassen.**
   Der Standard-Wizard fragt den Typ zur Laufzeit (`selectSchemaType`, wie heute
   `file-transcript-de`); spezielle Wizards sind pro Schema **vorgebunden**. Die
   Kuratierung referenziert also entweder „Flow + freie Schemawahl" oder „Flow +
   festes Schema".
2. **Speicherort der Flow-Entität: ENTSCHIEDEN — an Plan 2a koppeln.** Jetzt NICHT
   festlegen (eigene Mongo-Sammlung vs. Template-Repo mit `type: 'wizard'|'schema'`);
   Entscheidung fällt mit der Entflechtung (ADR-0003, U8/Editoren). Für den Nutzer
   sichtbar ändert sich dadurch nichts.
3. **Kuratierungs-Default ohne Config: ENTSCHIEDEN — nur Standard-Wizard.** Fehlt
   die `captureWizards`-Config, ist **nur der Standard-Wizard** sichtbar; weitere
   müssen **bewusst aktiviert** werden (kein stiller Voll-Dump aller Templates).
4. **Community-Sharing der Flows: ENTSCHIEDEN — später, Tür offen lassen.** Erst
   nach stabiler Runtime (U8) entscheiden; jetzt nur nichts verbauen, was es
   später verhindert.
5. **Anonyme Erfassung (Explorer): ENTSCHIEDEN — nein.** Erfassung bleibt
   rollen-gated (mindestens `contributor`); anonyme/Login-lose Erfassung ist
   **nicht** vorgesehen. Entspricht dem heutigen `canCapture` (fail-closed ohne
   Rolle). W-F betrifft also ausschließlich **Contributoren** (und owner/
   co-creator), nicht anonyme Besucher.

## 7. Reihenfolge-Vorbehalt

Dies ist **Plan 2** (2a-Kern + ein neues Library-Feld), laut Fahrplan **nach
Plan 1** und nicht parallel zur Entflechtung. Jetzt: nur als Präzisierung
dokumentiert; Bau erst zum geplanten Zeitpunkt, pro WP eigener Agent (Modell:
Opus, Architektur/Engine).

## 8. Kurz gesagt

> Es bleibt **ein** Wizard-Modell. Wir (a) heben den **Flow** aus den Templates
> heraus (ein geteilter Standard-Flow statt N Kopien → Redundanz weg), (b) machen
> „Inhalte erfassen" **pro Library kuratierbar** (neues Config-Feld), und (c)
> speichern den Import-/Diktat-Flow wie jeden anderen Wizard. Das ist eine
> Präzisierung von Plan 2a/2b + ein kleines neues Library-Feld — kein neuer Plan.
</content>
