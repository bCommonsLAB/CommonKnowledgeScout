## Ziel

Die Integrationstest-Suite soll **Use-Cases** validieren – unabhängig davon, ob Shadow‑Twin Artefakte primär in **MongoDB** oder im **Filesystem/Provider** liegen.  
Das heißt: Die Tests dürfen **nicht** implizit annehmen, dass es einen Dot‑Folder gibt oder dass Artefakte als `.md` Dateien im Parent liegen. Stattdessen müssen sie über die **zentrale Shadow‑Twin‑Abstraktion** (`ShadowTwinService`) prüfen, ob Artefakte existieren/lesbar sind und ob der Job‑Contract (z.B. `result.savedItemId`) erfüllt ist.

Zusätzlich sollen die Tests **deterministisch und wiederholbar** sein:
- „clean“ muss wirklich *clean* sein (auch für Mongo).
- „exists“/„incomplete_frontmatter“ müssen **aktiv hergestellt** werden, nicht durch „vorheriger Lauf war schon mal da“.

## Beobachtungen aus dem aktuellen Stand

- `prepareShadowTwinForTestCase()` löscht aktuell nur Filesystem‑Artefakte (Dot‑Folder + Transcript im Parent) und **nicht** MongoDB‑Artefakte. Dadurch ist „clean“ bei `primaryStore=mongo` faktisch nicht clean → Gates skippen unerwartet (Happy‑Path wird rot).
- Die Template‑Skip‑Logik in `src/lib/external-jobs/phase-template.ts` prüft „chapters bereits vorhanden“ über **Provider‑Siblings im Filesystem**. Bei `persistToFilesystem=false` existiert aber keine `.md` Datei → Template wird nicht geskippt, obwohl die Transformation in Mongo existiert.
- Validatoren waren teils Filesystem‑zentriert; dafür wurde bereits ein Mongo‑Aware Pfad ergänzt. Für echte Storage‑Agnostik sollte die Shadow‑Twin‑Existenz/Lesbarkeit in allen Fällen via `ShadowTwinService` geprüft werden.

## 3 Lösungsvarianten

### Variante A: „Nur Validatoren generalisieren“ (klein, aber nicht deterministisch)

**Idee**
- Validatoren prüfen Artefakte ausschließlich via `ShadowTwinService`.
- Keine File‑System‑Annahmen (kein `shadowTwinFolderId` Fail bei `persistToFilesystem=false`).

**Vorteile**
- Minimaler Eingriff.
- Gute Aussagekraft für „Endzustand ok“ (Artefakt existiert/lesbar, Contract erfüllt).

**Nachteile**
- Tests bleiben „flaky“, weil Precondition‑State (`clean/exists`) nicht deterministisch hergestellt wird.
- Skip/Force‑Usecases sind schwer reproduzierbar, wenn bereits alte Artefakte existieren.

### Variante B: „Deterministische Precondition + Service‑Checks“ (empfohlen)

**Idee**
- `prepareShadowTwinForTestCase()` wird storage‑agnostisch:
  - `clean`: löscht **Filesystem + Mongo** Artefakte für `sourceId`.
  - `exists`: erzeugt definierte Artefakte (Transcript + Transformation) mit gewünschtem Frontmatter.
  - `incomplete_frontmatter`: erzeugt Transformation mit `chapters`, aber ohne `pages` (oder fehlendem Feld), um Repair zu testen.
- Job‑Runtime: Template‑Skip/Repair darf nicht provider‑basiert sein → `phase-template.ts` muss für „existing chapters“ ebenfalls `ShadowTwinService.getMarkdown()` verwenden.

**Vorteile**
- Tests sind wiederholbar (gleiches Ergebnis bei wiederholten Runs).
- Skip/Force‑Szenarien können zuverlässig validiert werden.
- Direkte Validierung der neuen zentralen Shadow‑Twin‑Logik.

**Nachteile / Aufwand**
- Es wird eine Mongo‑Delete/Reset‑Operation benötigt (für Tests). Das kann als Repo‑Helper (`deleteShadowTwinBySourceId`) implementiert werden.
- Für Filesystem‑Precondition braucht es ggf. definierte Template‑Namen (oder eine „best transformation“ Auswahl ohne templateName).

### Variante C: „Isolierte Testfiles statt Delete“ (robust, aber schwergewichtig)

**Idee**
- Statt Cleanup zu implementieren, kopiert der Test Runner die PDF pro Run in einen neuen „Scratch“‑Pfad/Name → neue `sourceId`, keine Kollisionen.
- Skip/Exists wird durch sequenzielle Jobs in *derselben* Testcase‑Ausführung erzeugt (Warm‑up Run, dann eigentlicher Test).

**Vorteile**
- Kein Delete notwendig, keine Race Conditions mit parallelen Runs.
- Sehr robust gegen „alte Artefakte“.

**Nachteile**
- Höherer Storage‑Overhead (kopierte PDFs, ggf. Cleanup später nötig).
- Setup‑Zeit höher; bei großen PDFs kann das spürbar sein.

## Konkrete Definition „Storage‑agnostische Assertions“

Unabhängig vom Store sollten Use‑Case‑Tests primär prüfen:
- Job‑Status (`completed` / `failed`) gem. Erwartung.
- Phase‑Semantik (Run vs Skip vs Force) anhand **Job‑Step Details** (nicht anhand Dateisystem‑Existenz).
- `result.savedItemId` erfüllt Contract und referenziert ein Artefakt des erwarteten Kinds.
- Das erwartete Artefakt ist **lesbar** über `ShadowTwinService.getMarkdown()` (auch wenn kein Dot‑Folder existiert).
- Optional: inhaltliche Probe (Frontmatter‑Keys wie `chapters`/`pages`, falls Szenario das verlangt).

## Entscheidung

Variante **B** ist die passende Basis, weil sie die Suite gleichzeitig
1) storage‑agnostisch,
2) deterministisch,
3) und aussagekräftig für Skip/Force‑Szenarien macht.

