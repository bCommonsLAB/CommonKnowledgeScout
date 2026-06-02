# ADR 0003 — Wizard und Schema-Template trennen

- **Status**: Vorgeschlagen (Trennung + Verfeinerungen R1/R2/R3 vom Owner
  bestätigt 2026-05-31; Feld-Bindungsmodell O1 an der physischen Test-Library
  entschieden 2026-06-02 — siehe Nachtrag unten)
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

## Nachtrag 2026-05-31 — Verfeinerungen aus Phase 2 (bestätigt)

Die Zerlegung von `event-finalize` und `pdfanalyse-commoning`
(`docs/refactor/welle-3-vi-creation-wizard/phase-2-test-library.md`) hat drei
Modell-Verfeinerungen ergeben. Sie ändern das Datenmodell, nicht die
Grundsatz-Trennung. **Vom Owner bestätigt (2026-05-31).**

- **R1 — Schema-Extension** ✅: Schemas dürfen erweitern (`event-final extends
  event`) statt zu kopieren. Zu unterscheiden von `relatedSchemas` (Referenz
  auf Quell-Schemas). Beide Mechanismen nötig.
- **R2 — Schema-Config/Parameter (4. Kategorie)** ✅: parametrierbare Teile
  (kontrolliertes Vokabular, Kanon-Listen) sind **Config pro Library**, kein
  Template-Fork. Kollabiert Duplikation (`pdfanalyse` ×4 → 1 Schema + 3 Configs).
  Aktualisierte Kategorien: **Schema | Schema-Config | Wizard | Run-Input**.
- **R3 — System-Felder nie als Wizard-Bindung** ✅: `editDraft` bindet nur
  Inhalts-Felder; System-Felder (`slug`, `docType`, `originalFileId`,
  `*WriteKey`, `finalRunId`, `eventStatus`) sind auto-gesetzt.

**O1** (Feld-Bindungsmodell) ist mit der physischen Test-Library entschieden —
siehe nächster Nachtrag.

## Nachtrag 2026-06-02 — O1 entschieden: generische, schema-getriebene Bindung

**Entscheidung: Option (a) generisch — gewählt.** Die Variante (b) rollenbasiert
wird **verworfen**. Der Wizard bindet nicht mehr an konkrete Feldnamen und nicht
an ein Rollen-Vokabular, sondern an **Feld-Metadaten, die das Schema besitzt**.

### Grundlage: die realen Fälle der Kitchen-Sink-Library

Seed in lokale Dev-DB + Inspektion (`scripts/inspect-test-library.ts`) ergaben
über alle 6 Fixtures dasselbe Muster:

| Template | Konsument | gebundene Felder (`editDraft.fields`) | NICHT gebunden |
|---|---|---|---|
| event | Wizard | title, summary, event_date, location, filename | docType, detailViewType, slug, source_language |
| event-final | Wizard | title, summary, bodyInText, eindruckDerTeilnehmer, testimonials | docType, detailViewType, extends, relatedSchemas, source_language |
| testimonial | Wizard | title, statement, author_name, author_image_url 🖼, filename | docType, detailViewType, source_language, relatedSchemas |
| dialograum | Wizard | title, summary, result_text, filename | docType, detailViewType, slug, source_language, relatedSchemas |
| pc-steckbrief | Wizard | title, device_type, cpu, ram_gb, storage_gb, condition_grade, filename | docType, detailViewType, slug, source_language |
| pdfanalyse | schema-only | — (kein Wizard) | — |

Drei Beobachtungen entscheiden:

1. **Keine Rollen-Indirektion in der Praxis.** Jeder Wizard bindet exakt die
   **Inhalts-Felder seines eigenen Schemas** mit konkreten Namen. **Kein** Fall
   verweist auf eine abstrakte Rolle, die das Schema pro Use-Case anders mappt.
   Ein Rollen-Vokabular (b) hätte **null Konsumenten** — es wäre genau die
   spekulative Generalität, vor der die `contra`-Spalte von (b) selbst warnt
   („ein Rollen-Vokabular muss gepflegt werden").
2. **Die Ausschluss-Menge ist vollständig vorhersagbar.** „NICHT gebunden" sind
   ausnahmslos **System-/Struktur-/Config-Felder** (`docType`, `detailViewType`,
   `slug`, `source_language`, `extends`, `relatedSchemas`). R3 („System-Felder
   nie als Wizard-Bindung") ist damit aus der **Feld-Art** ableitbar — keine
   handgepflegte Ausschlussliste pro Template nötig.
3. **Render-Hinweise sind feld-intrinsisch.** `imageFieldKeys:
   [author_image_url]` ist eine Eigenschaft des Feldes (es *ist* ein Bild),
   liegt heute aber fälschlich am Wizard-Step.

### Befund am heutigen Code (Drift, den (a) behebt)

`src/components/creation-wizard/steps/edit-draft-step.tsx` belegt das Problem:
die *generische* Komponente trägt **hartkodiertes Domänenwissen** —
`getFieldLabel` (Label-Map `title→Titel`, `speakers→Sprecher`, …), Array-Erkennung
per Name (`tags`/`topics`/`affiliations`), Textarea-Heuristik
(`summary`/`experience`/`insight`) und Picker-Sonderfälle
(`wizard_testimonial_template_id`). Genau das ist das im Haupttext (oben) gewarnte
„Wizard klebt am Event-Schema". Fehlt `editDraft.fields`, rendert die Komponente
still **alle** Felder (Silent-Fallback, den die Kompatibilitätsprüfung ersetzt).

### Das gewählte Modell

- **Das Schema besitzt die Feld-Metadaten** pro Feld: `kind`
  (`content` | `system` | `structural`), `inputType`
  (`text` | `textarea` | `image` | `array` | …), `label`/`description`, `order`,
  optional `group`.
- **Der generische Edit-Step bindet** = „alle Felder mit `kind=content`, in
  Schema-Reihenfolge". R3 fällt als Daten-Eigenschaft heraus
  (`kind != content` ⇒ nie editierbar) — Ausschlusslisten und Silent-Fallback
  entfallen.
- **Render-Hinweise** (`textarea`/`array`/`image`/Label) wandern aus den
  hartkodierten Wizard-Heuristiken in die Schema-Feld-Metadaten →
  `imageFieldKeys` wird `inputType: image` am Feld.
- **Wizard-eigene Felder** (`filename`) bleiben generische Wizard-Mechanik
  (Output-Benennung, bereits in `output.fileName` / `wizardOnlyMetadataKeys`
  deklariert), kein Schema-Inhalt — der Wizard nennt dafür weiterhin keinen
  Domänen-Feldnamen.

### Bewusst zurückgestellt (YAGNI, dokumentierter Notausgang)

Feinere Kuratierung pro Step (anderes Subset/andere Reihenfolge als „alle
Inhalts-Felder") über **schema-definierte, benannte Feld-Gruppen** (`group:core`),
die der Wizard-Step referenziert — **weiterhin ohne konkrete Feldnamen**. Kein
Fixture braucht heute zwei Wizards über *einem* Schema mit unterschiedlichem
Feld-Subset; erst wenn dieser Fall real auftritt, wird die Gruppen-Referenz
ergänzt. Bis dahin genügt „alle Inhalts-Felder in Schema-Reihenfolge".

### Konsequenz für die Migration (Phase 3a)

- `flow.steps[].fields` und `flow.steps[].imageFieldKeys` entfallen aus dem
  Wizard; ihre Information wandert als Feld-Metadaten ins Schema.
- `edit-draft-step.tsx` rendert rein aus Feld-Metadaten; die hartkodierten
  Label-/Array-/Textarea-/Picker-Heuristiken werden entfernt.
- Der Silent-Fallback „keine `fields` ⇒ alle Felder" wird zur
  Kompatibilitätsprüfung (Schema ohne `content`-Feld ⇒ klarer Fehler).

**Damit ist O1 geschlossen.**

## Verweise
- `docs/refactor/welle-3-vi-creation-wizard/phase-2-test-library.md`
- `docs/refactor/welle-3-vi-creation-wizard/beispiel-zerlegung-event-creation.md`
- `docs/refactor/welle-3-vi-creation-wizard/phase-1-use-case-inventur.md`
- `docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`
- ADR-0004 (Inbox-/Submission-Modell)
- ADR-0001 (Job-Domänen getrennt halten)
- Referenzmuster: JSON Schema (Daten) + UI Schema (Darstellung), zur Laufzeit
  gemerged (analog *JSONForms*).
