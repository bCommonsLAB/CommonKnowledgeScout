# Fahrplan: erst formatunabhängige Library, dann Onboarding-Flow

> Übersichts-Dokument (Stand 2026-06-14). EINE Quelle für die **Reihenfolge**,
> damit (auch parallele) Sitzungen nicht doppelt bauen. Die Detail-Pläne bleiben
> gültig und sind unten verlinkt. Sprache bewusst einfach gehalten.

## Grundsatz: nacheinander, nicht parallel

1. **Plan 1 — Library formatunabhängig & konsistent machen**
2. **Plan 2 — Onboarding-Flow (Erfassungs-Assistent)**, in zwei Schritten:
   - **2a — Templates entflechten** (Daten-Fundament)
   - **2b — der eine generische Assistent**

Plan 1 arbeitet auf den **Dokument-Daten** (was in den Inhalten steht), Plan 2 auf
der **Template-/Erfassungs-Mechanik**. Deshalb stört das spätere Entflechten (2a)
den Plan 1 nicht — die Reihenfolge ist sicher.

## Was schon auf `master` erledigt ist (Ausgangslage)

- **A0 — Konsistenz-Fundament** (PR #96, Commit `f47b8965`): gemeinsame Basis-Felder
  (`title, date, authors, language, source, tags`), Pflicht-Facetten, Integritäts-
  Sperren bei Template-Create/Update/Import (HTTP 422), Auto-Injektion der Basis-/
  Technik-Felder, kein stiller `'book'`-Fallback mehr. → Fundament für **beide** Pläne.
  Code: `src/lib/detail-view-types/base-fields.ts`, `src/lib/templates/template-integrity.ts`.
- **Entflechten — erster Baustein gebaut + gemerged**: „Phase 3a-1 — generische
  Feld-Bindung" (`src/lib/creation/editable-fields.ts:editableContentFields`),
  plus Sicherheitsnetz: `src/lib/creation/wizard-flow.ts` mit Charakter-Tests
  herausgelöst und die **Kitchen-Sink-Test-Library** als Prüfstand.
- **Inbox/Wartekorb I–III**: Provider, „Inhalte erfassen", Analyse, „Meine Beiträge"
  — gebaut + Unit-getestet; E2E „Erfassen → Wartekorb" grün.

> Befund Git-Recherche 2026-06-14: Der **Rest** des Entflechtens ist **nirgends**
> codiert (kein `inputType`/`kind`-Modell, keine eigene Schema-Einheit, keine
> Einstellungen-pro-Library, kein `extends`, kein Schema-Editor) — und es gibt
> keinen versteckten/ungemergten Branch damit.

## Plan 1 — Library formatunabhängig & konsistent

Ziel: eine Bibliothek = ein **Thema** mit gemischten Formaten; die Daten bleiben
deterministisch und verlässlich (niemand kann die Ordnung aushebeln).

- ✅ **A0** — Basis-Feld-Contract + Integritäts-Sperren (fertig, s.o.).
- ▢ **A1** — „Geprüft"-Status pro Library + Prüfen/Reparieren. **Achtung:** die
  Veröffentlichungs-Sperre („nur Geprüfte dürfen publizieren") an den **Promote-
  Schritt** von Plan 2 hängen, keinen zweiten Publish-Pfad bauen (siehe Konflikte).
  *Integrationspunkt:* der Promote-Job entsteht in Plan 2 (ADR-0004 §E3 +
  `docs/wizards/status-und-testplan-2026-06.md` WP-6 / „Inbox V"). Existiert er noch
  nicht, baut A1 zunächst nur Status+Check+Repair; die Sperre wird dort angedockt.
- ▢ **A2** — Experten-Ansicht (prüfen/reparieren) + Status-Abzeichen beim Öffnen +
  Basis-Filter in den Einstellungen sperren (nicht entfernbar).
- ▢ **A4** — gemischte Galerie/Story aufpolieren: Filter als Vereinigung über
  Typen, Tabellen-Spalten je Typ, Story-Verweise je Dokument formatgerecht.
  Detail-Bauplan (3 Wellen, Design-Konflikte, Reihenfolge):
  [`plan1-a4-gemischte-galerie-story.md`](plan1-a4-gemischte-galerie-story.md).
- ⨯ **A3 entfällt hier** → wandert in Plan 2 (Wizard), siehe Konflikte.

## Plan 2 — Onboarding-Flow

Architektur-Grundlage: **ADR-0003** (Wizard ⊥ Schema trennen, O1 generisch) und
**ADR-0004** (Inbox/Submission, Erfassen ⟂ Veröffentlichen). Bauplan: der
**Umbauplan** (`docs/wizards/umbauplan-generischer-erfassungs-wizard.md`, U0–U8).

> **Präzisierungen (2026-06-18, entschieden — vor Plan-2-Bau lesen):**
> - `docs/wizards/plan-praezisierung-inhalte-erfassen-kuratierte-wizards.md` —
>   „Inhalte erfassen" als pro Library **kuratierte** Wizard-Liste; Flow als
>   geteilte Entität (Redundanz weg); Wizard-Editor vom Template-Editor
>   entkoppeln; Einstieg×Rolle×Speicherziel (Contributor-Übersicht im Explorer,
>   keine anonyme Erfassung); Arbeitspakete W-A…W-G; Entscheidungen 1–5 geschlossen.
> - `docs/wizards/gesamtbild-und-schnellspur-einfach.md` — Gesamtbild + Standort +
>   Schnellspur-Streichliste (Verzeichnis-Upload u. a.) in einfacher Sprache.
> - `docs/analysis/wizard-zwei-eingaenge-einfach.md` — „eine Maschine, mehrere
>   Türen"; der Import-Flow ist ein **eingebautes Template** (`file-transcript-de`).

### 2a — Templates entflechten (zuerst, Daten-Fundament)

Aus **einem starren Template** (Daten + Aussehen + KI-Anweisung + Klick-Ablauf, in
vielen fast gleichen Kopien) werden **wiederverwendbare Bausteine**:

- **Schema** (Datenmodell pro Inhaltstyp): Felder + Renderer + KI-Anweisung — geteilt.
- **Einstellungen pro Library** statt Vorlage kopieren (z. B. Wortlisten) — *R2*
  (aus „PDF-Analyse ×4" wird „1 Schema + 3 Einstellungen").
- **`extends`**: eine Vorlage baut auf einer anderen auf, statt abzuschreiben — *R1*.
- **System-Felder nie als Bedienfeld** — *R3*.
- **Generische Feld-Bindung** über Feld-Eigenschaften (`kind=content`, `inputType`) — *O1*
  (baut auf dem schon gemergten `editableContentFields`/Phase 3a-1 auf).

Status: **geplant + erster Baustein (3a-1) gemerged; Hauptteil offen.**
Kickoff für 2a/2b: **Umbauplan §8** („Kickoff … U0 zuerst") — derselbe Strang, neuer
Agent pro Arbeitspaket.
Detail: `docs/adr/0003-wizard-schema-template-trennen.md`,
`docs/refactor/welle-3-vi-creation-wizard/` (`00-refactor-plan.md`,
`phase-1-use-case-inventur.md`, `phase-2-test-library.md`,
`beispiel-zerlegung-event-creation.md`),
`docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`.

### 2b — Der eine generische Assistent (danach)

Ein geführter Flow (**erklären → führen → rechnen → abnehmen**), der gegen **jedes**
Schema läuft, **immer über den Wartekorb** schreibt (off-target, funktioniert immer)
und bei dem **Veröffentlichen ein rechte-gateter Promote-Schritt** ist.

Status: **offen** (U0 noch nicht begonnen; Fundament U0/Testlibrary aber vorhanden).
Detail: `docs/wizards/umbauplan-generischer-erfassungs-wizard.md` (U0–U8),
`docs/adr/0004-capture-publish-entkopplung-inbox-modell.md`,
`docs/wizards/status-und-testplan-2026-06.md` (Inbox-WP-1/5/6).

## Abhängigkeiten & Konflikte (was baut auf was, was kollidiert)

| Punkt | Verhältnis | Bewertung |
|---|---|---|
| **A0** | Fundament für Plan 1 **und** Plan 2 | ✅ fertig |
| **A1/A2/A4** | arbeiten auf Dokument-Daten, unabhängig von Template-Struktur | 🟢 durch Entflechten nicht gefährdet |
| **A3** (alte Wizard-Idee) | gleiche Dateien wie 2a/2b | 🔴 in Plan 2 integriert, **nicht** separat |
| **A1-Publish-Sperre** | überschneidet ADR-0004 Promote (WP-6) | 🟠 an den **Promote-Schritt** hängen |
| **A0 ↔ 2a** (`kind`/`inputType`) | gleicher Schema-Bereich | 🟠 2a **erweitert** A0; Integritäts-Sperre muss neue Schema-Form verstehen |

## Empfohlene nächste Schritte

1. **Klein & entsperrend:** WP-1 (F11 ↔ Inbox-Analyse versöhnen) — kleiner Fix,
   macht das Fundament wirklich lauffähig. **Scope-Hinweis:** WP-1 blockiert nur die
   **Inbox-E2E-Verifikation**, NICHT A1 — A1 kann parallel/ohne WP-1 starten.
2. **Plan 1 abschließen:** A2 + A4 (billig, sichtbar), dann A1 (mit Promote-Abstimmung).
3. **Plan 2:** 2a Entflechten (auf dem gemergten 3a-1 + Sicherheitsnetz + Test-Library
   aufbauen) → 2b Assistent (U0 → …).

## Kickoff Plan 1 (neue / Online-Session)

> Kopierbarer Start-Prompt. Plan 1 wird bewusst in einer frischen Session neu gestartet.

```
Branch von `master` (z.B. `feature/plan1-a1-verifikationsstatus`). Pflichtlektüre:
docs/roadmap-formatunabhaengige-library-und-onboarding.md, .cursorrules, alle
.cursor/rules/*.mdc mit alwaysApply, AGENTS.md, docs/adr/0004-capture-publish-
entkopplung-inbox-modell.md (Promote/Inbox).

Kontext A0 (Fundament, schon auf master, NICHT neu bauen):
src/lib/detail-view-types/base-fields.ts, src/lib/templates/template-integrity.ts,
src/lib/chat/dynamic-facets.ts (Basis-Facetten erzwungen), src/lib/chat/config.ts.

Ziel Plan 1 = die Library formatunabhaengig & konsistent SICHTBAR/erzwungen machen.
Erster Baustein A1: pro Library ein Verifikations-Status (geprueft | ungeprueft |
reparaturbeduerftig) + Check-Funktion (scannt alle Dokumente gegen die Pflichtfelder
ihres detailViewType + die Basis-Felder + Facetten-Stimmigkeit) + Reparatur
(auto-fixbare Faelle) + Audit-Trail. Vorbilder/Reuse: checkTemplateConsistency,
validateMetadataForViewType, Repair-Muster der repair-thumbnails-Route (SSE),
integration-tests-repo (Audit-Speicher). WICHTIG: die Publish-Sperre („nur Gepruefte
duerfen publizieren") NICHT als zweiten Pfad bauen — an den Promote-Schritt (ADR-0004)
haengen. Danach A2 (Status-Badge beim Oeffnen + Expert-UI Pruefen/Reparieren +
Basis-Facetten in FacetDefsEditor sperren) und A4 (Facetten-Union, Tabellen-Spalten je
Typ, Story-Referenzen je Dokument). A3 NICHT hier — gehoert zu Plan 2.

Regeln: Code englisch, Kommentare/Commits deutsch, Dateien <=200 Zeilen, kein any /
leeres catch, KEINE Silent Fallbacks, UI kennt kein Storage-Backend. DoD je Schritt:
pnpm test + pnpm lint gruen; sichtbare Story als Playwright-E2E wo sinnvoll. Auf dem
Branch committen, PR erst wenn gruen.

Optionaler Vorab-Fix (entsperrt echte Inbox-Laeufe, kleiner Scope): WP-1 aus
docs/wizards/status-und-testplan-2026-06.md (F11 <-> Inbox-Analyse versoehnen).
Modell-Empfehlung: Opus (Architektur/Engine).
```
