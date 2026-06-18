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

### Δ3 — Import-/Diktat-Flow als gespeicherter Standard-Wizard

`file-transcript-de` / `audio-transcript-de` von **hardcodiert** → **gespeicherter
geteilter Flow** (seedbar), referenziert das passende Schema. Built-in-Fallback im
Code bleibt nur als Notnagel für leere Libraries (kein Silent-Override).

### Δ4 — `transcriptOnly` zur sauberen Betriebsart bündeln

Die verstreuten `if (transcriptOnly)` zu EINER Betriebsart „Flow ohne
Transformation" (Schema = nativer Quelltyp, nur Extract/Transkript) zusammenfassen
— im Zuge von U1/U4 (Step-Engine + ein Submission-Commit), nicht als Extra-Pfad.

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

Abhängigkeiten: W-A vor W-B/W-D; W-B vor W-C; W-E mit U4. Alles **nach Plan 1**.

## 6. Offene Entscheidungen (vor Bau klären)

1. **Bindungs-Granularität des Standard-Wizards:** Ein Flow mit
   `selectSchemaType`-Schritt (Schema zur Laufzeit, wie heute `file-transcript-de`)
   ODER pro Schema ein vorgebundener Flow-Eintrag in der Kuratierung?
   *Empfehlung:* beides zulassen — Kuratierung referenziert entweder „Flow +
   freie Schemawahl" oder „Flow + festes Schema".
2. **Speicherort der Flow-Entität:** eigene Mongo-Sammlung vs. erweitertes
   Template-Repo mit `type: 'wizard' | 'schema'`. *Empfehlung:* an die 2a-
   Entscheidung koppeln (ADR-0003 U8/Editoren), nicht vorwegnehmen.
3. **Kuratierungs-Default ohne Config:** nur Standard-Wizard, oder Standard +
   alle schema-gebundenen? *Empfehlung:* nur Standard-Wizard sichtbar; weitere
   müssen bewusst aktiviert werden (verhindert Wildwuchs, kein Silent-Voll-Dump).
4. **Community-Sharing der Flows** (ADR-0003-Ziel) — erst nach stabiler Runtime
   (U8), hier nur nicht verbauen.

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
