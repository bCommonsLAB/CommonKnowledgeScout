# ADR 0003 — Wizard und Schema-Template trennen

- **Status**: Vorgeschlagen (Trennung vom Owner bestätigt 2026-05-31;
  Feld-Bindungsmodell bewusst offen)
- **Datum**: 2026-05-31
- **Kontext**: Neuordnung Creation-Wizard (Welle 3-VI), siehe
  `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md`,
  `docs/refactor/welle-3-vi-creation-wizard/phase-1-use-case-inventur.md`,
  `docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`
- **Entscheider**: Repo-Owner
- **Verwandt**: ADR-0004 (Inbox-/Submission-Modell) — eine Submission
  referenziert Wizard und Schema **getrennt**.

## Kontext

Templates und Wizards sind historisch in **eine** Entität gewachsen.
`TemplateDocument` (`src/lib/templates/template-types.ts:316`) dokumentiert die
Verschmelzung im eigenen Header sogar selbst — eine Vorlage bündelt:

1. **Datenmodell** — `metadata: TemplateMetadataSchema` (die Frontmatter-Felder)
2. **Extraktion** — `systemprompt: string` (+ Response-Schema)
3. **UX-Flow** — `creation?: TemplateCreationConfig` (Steps/Presets/Quellen)
4. **Renderer** — `detailViewType` (`:79`, `:243`)

Die Phase-1-Inventur (`phase-1-use-case-inventur.md`) zeigt, dass diese
Verschmelzung nur **scheinbar** fundamental ist:

- **17 von 26** Vorlagen sind **bereits schema-only** (Datenmodell + Extractor,
  **ohne** `creation`-Block) und werden vom **JobWorker** konsumiert
  (`src/lib/external-jobs/phase-template.ts`, `template-run.ts`,
  `template-decision.ts`). Nur **9** sind echte Wizards.
- Das **Flow-Vokabular ist klein und geteilt**: 9 Presets, 5 Quelltypen decken
  alle 9 Wizards ab.
- **26 / 26** haben einen `systemprompt` → der Extractor ist ein *universeller*
  Belang, kein Wizard-Belang.
- Es gibt bereits eine **Renderer-Registry** `VIEW_TYPE_REGISTRY` für alle 8
  `detailViewType`s (`src/lib/detail-view-types/registry.ts:177`) — aber der
  **Wizard-Preview** kennt nur 4 davon und fällt still auf `'session'` zurück
  (Drift).
- Es existiert sogar schon eine schema-only-Projektion ohne `creation`-Block
  (`template-types.ts:285`, `serializeTemplateWithoutCreation`).
- Der `creation`-Block ist **verschachteltes** Frontmatter und verletzt die
  Flat-Frontmatter-Regel in `AGENTS.md`.

**Folge der Verschmelzung**: N fast identische `creation`-Blöcke (Duplikation),
14+ `if (templateId === …)`-Sonderfälle im Wizard-Kern, und Lauf-Daten lecken
in Vorlagen (z.B. eine 21-Video-Liste im `systemprompt` von `event-creation`).

## Entscheidung

**Die verschmolzene Entität wird in zwei eigenständige Entitäten getrennt; die
Lauf-Daten werden als dritte Kategorie herausgelöst.**

### Drei Entitäten statt einer

| Entität | Inhalt | Wiederverwendung | Konsument |
|---|---|---|---|
| **Schema** (`docType`) | Felder + Typen + Beschreibungen, **Renderer** (`detailViewType`), **Extractor** (`systemprompt`/responseSchema) | pro `docType`, pro Library | **Wizard *und* JobWorker** |
| **Wizard** (Flow) | Steps/Presets, Quelltypen, Feld-Bindung | **generisch / Community** | nur Wizard |
| **Run-Input** | konkrete Quell-/Domänendaten (z.B. Video-Liste) | pro Ausführung | — (Eingabe) |

**Begründung der Schnitte:**
- **Renderer und Extractor gehören zum Schema, nicht zum Wizard.** Der Wizard
  darf nicht wissen, ob das Ergebnis als `session` oder `divaDocument`
  gerendert wird — sonst ist er nicht generisch. Beide Belange werden ohnehin
  vom JobWorker (ohne Wizard) gebraucht.
- **Der Wizard ist reine Mechanik** und bindet an ein Schema (s.u.). Dadurch
  wird er Community-fähig: ein generischer „Collect → Generate → Edit →
  Preview → Publish"-Wizard läuft gegen **jedes** Schema.
- **Lauf-Daten** sind weder Wizard noch Schema. Sie werden zur Eingabe einer
  **Submission** (ADR-0004) und verschwinden aus den Vorlagen.

### Laufzeit: Merge statt Verschmelzung

```
Wizard (Flow)  ⊕  Schema (Felder + Renderer + Extractor)
        │
        ▼  validiere Kompatibilität (Bindung + benötigte Presets)
   ausführbare Wizard-Instanz  →  Submission (ADR-0004)
```

- **Renderer** kommt zur Laufzeit aus `VIEW_TYPE_REGISTRY` (behebt die
  4-vs-8-Drift; der Wizard-Preview konsumiert dieselbe Registry wie die Galerie).
- **Kompatibilitätsprüfung** ersetzt die heutigen Silent-Fallbacks: Ein Wizard
  mit `selectRelatedTestimonials`-Step verlangt ein Schema, das Testimonials
  kann → früher, klarer Fehler statt stillem `'session'`-Fallback.

### Offen: Feld-Bindung (im ADR bewusst nicht entschieden)

Wie ein Wizard-Step an Schema-Felder bindet, ist der zentrale Vertrag — wird
**nach** der Test-Library (Phase 2) entschieden, wenn klar ist, wie viel
Feinkontrolle real gebraucht wird. Zwei Alternativen:

- **(a) Generisch**: Step rendert „alle Schema-Felder" bzw. eine im Schema
  definierte Feld-Gruppe. Wizard ist 100 % domänenfrei, einfachstes Modell,
  weniger Feinkontrolle über Reihenfolge/Auswahl pro Step.
- **(b) Rollenbasiert**: Wizard referenziert logische Rollen („Titel-Feld",
  „Zusammenfassungs-Feld"), das Schema mappt Rollen → konkrete Felder. Mehr
  Kontrolle/Wiederverwendung, aber ein Rollen-Vokabular muss gepflegt werden.

> Heute listet `editDraft` konkrete Feldnamen (`title, shortTitle, …`). Egal
> welche Option — diese Namen dürfen **nicht** mehr im Wizard hartkodiert sein,
> sonst klebt er am Event-Schema.

### Multi-Schema-Komposition

Manche Flows mergen mehrere Schemas (`event-finalize` = Event + Testimonials).
Das Modell erlaubt ein **Primär-Schema + referenzierte Schemas**, nicht streng
1:1.

## Bewertete Optionen

### Option A — Verschmolzen lassen, nur Engine aufräumen
- **Pro**: kein Daten-Migrationsaufwand.
- **Contra**: friert die Drift ein (Duplikation, Sonderfälle, Renderer-4-vs-8,
  Lauf-Daten-Lecks bleiben); Community-Wizards/Mix&Match unmöglich; verletzt
  Flat-Frontmatter weiter. ❌

### Option B — Wizard und Schema trennen, Laufzeit-Merge ✅ **gewählt**
- **Pro**: Community-Wizards, Mix&Match, UI vom Datenmodell entkoppelt, eine
  Renderer-Registry, Flat-Frontmatter-Compliance, beseitigt Duplikation und
  Sonderfälle an der Wurzel; 17/26 leben schon so.
- **Contra**: ~30 Vorlagen migrieren; aus einem Template-Editor werden zwei
  Editoren; Bindungsvertrag + Kompatibilitätsprüfung nötig.

## Konsequenzen

### Positiv
- **Generischer Wizard** läuft gegen jedes Schema → neues Use-Case-Schema
  erfordert **keinen** Wizard-Code.
- **Community-Wizards**: ein Flow lebt einmal, library-übergreifend.
- **Renderer-Drift behoben** durch eine geteilte Registry.
- **Lauf-Daten raus** aus Vorlagen (→ Submission-Eingabe, ADR-0004).
- Re-Compliance mit der Flat-Frontmatter-Regel.

### Negativ / zu beachten
- **Migration** der `template-samples` in `{Schema | Wizard}` (+ Lauf-Daten
  herauslösen). Vokabular ist klein (9 Presets, 5 Quellen) → machbar, aber
  Fleißarbeit. Eine Beispiel-Zerlegung (`event-creation-de`) sollte den
  Migrationspfad festlegen.
- **Zwei Editoren** statt einem: **Schema-Editor** (Datenmodell) +
  **Wizard-Editor** (Flow). Aus „Template-Editor" wird beides. Authoring darf
  für einfache Autoren nicht schwerer werden → der Editor kaschiert die
  Trennung („Wizard wählen → Schema wählen → fertig").
- **JobWorker** konsumiert künftig nur noch die **Schema**-Entität (sauberer;
  er brauchte den `creation`-Block ohnehin nie).
- **`TemplateDocument`/`TemplateMetadataSchema`** werden in zwei Typen
  aufgeteilt; `VIEW_TYPE_REGISTRY` wird die kanonische Renderer-Quelle auch für
  den Wizard.
- **Reihenfolge**: erst Schema-/Wizard-Modell + Test-Library (Phase 2), dann
  generische Merge-Runtime (Phase 3a), dann die Editoren (Phase 4) — Runtime
  **vor** Editor.

## Verweise
- `docs/refactor/welle-3-vi-creation-wizard/phase-1-use-case-inventur.md`
- `docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`
- ADR-0004 (Inbox-/Submission-Modell)
- ADR-0001 (Job-Domänen getrennt halten)
- Referenzmuster: JSON Schema (Daten) + UI Schema (Darstellung), zur Laufzeit
  gemerged (analog *JSONForms*).
