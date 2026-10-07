---
name: bruecke-library-betrieb
overview: "Eine Library über die MCP-Brücke betreiben, nicht nur ihr Archiv pflegen. Abgeleitet aus dem Live-Test der Status-Modalität (07./08.10.2026): Konfiguration setzen, Antwortqualität messen, Index nachziehen, Bestand prüfen, Läufe bilanzieren. Fünf wiederkehrende Use Cases, je ein bis zwei Werkzeuge, alle als Hülle um Funktionen, die das UI schon nutzt."
vorhaben: []
status: geplant
todos:
  - id: b1-konfiguration
    content: "Use Case 1 Konfigurieren: `konfiguration_lesen` (Bereich: facetten | antwortregeln | chat | galerie | veroeffentlichung) und `konfiguration_setzen` (gleiche Bereiche, Teil-Update, dieselbe Zod-Prüfung wie das Settings-Formular, inkl. Platzhalter-Querprüfung der Antwortregeln). Facetten als dieselbe JSON-Form wie Import/Export des Editors."
    status: pending
  - id: b2-messen
    content: "Use Case 2 Messen: `frage_stellen` (Orchestrator wie die Stream-Route, Rückgabe Antwort + Belege + nachpruefung + cacheTreffer, Schalter ohneCache und baseline), `frage_log_lesen` (ein Query-Log, Cache-Parameter und Nachprüfung lesbar), `golden_set_fahren` (Set-Datei aus dem Archiv, Bericht als Markdown, Läufer aus scripts/golden-set-run.ts kapseln)."
    status: pending
  - id: b3-index
    content: "Use Case 3 Index nachziehen: `index_aktualisieren` (nur Phase 3 mit vorhandener Transformation; sourceIds bis 30 ODER ordner + rekursiv → Jobs wie der Batch-Dialog, Twin-Ordner und test/-Ordner ausgeschlossen, Rückgabe batchId), `index_entfernen` als Stapel-Form von dokument_depublizieren. `dokument_felder_setzen` zieht zusätzlich die Chunk-Felder nach, damit Meta und Chunks nicht auseinanderlaufen."
    status: pending
  - id: b4-bestand
    content: "Use Case 4 Bestand prüfen: `dokumente_auflisten` (Galerie-Sicht mit Facettenwerten, Filter, Suche, Seiten) und `bestand_pruefen` mit festen Prüfregeln: doppelte Kennung (Feld aus der Konfiguration, z. B. massnahme_nr), Werte außerhalb des Facetten-Wörterbuchs, fehlende Pflichtfelder des Typs, Einträge aus Twin-/Testordnern. Rückgabe als Befundliste mit sourceIds, direkt an index_entfernen oder dokument_felder_setzen weiterreichbar."
    status: pending
  - id: b5-laeufe
    content: "Use Case 5 Läufe bilanzieren: `batch_bilanz` (Zähler je Batch, Fehler nach Ursache gruppiert, betroffene Quellen) und `batch_neustart` (gefiltert nach Status/Batch wie der Knopf im Job-Monitor). job_liste/job_status bleiben die Einzelansicht."
    status: pending
  - id: b6-regeln
    content: "Querschnitt: Jedes Werkzeug ruft dieselbe Service-Funktion wie das UI (ADR 0007, keine zweite Logik), schreibende Werkzeuge nur nach Bestätigung mit Protokoll-Eintrag (Muster protokoll.ts), Stapelgrenze 30, Fehler je Zeile statt Abbruch. bruecke_info nennt die neuen Werkzeuge, docs/concepts/mcp-storage-stand.md bekommt den Abschnitt „Library-Betrieb"."
    status: pending
---

# Library-Betrieb über die MCP-Brücke

## 1. Anlass

Am 07./08.10.2026 wurde die Status-Modalität des Story-Modus
(`story-status-modalitaet.plan.md`) in einer Library live getestet. Jeder
Schritt lief über das UI oder direkt gegen die App-API: Wörterbuch und
Antwortregeln in den Settings, Fragen im Story-Modus, Query-Logs per
Browser, Re-Ingest über den Batch-Dialog, Bereinigung der Nebenwirkungen
(Doppelgänger, Freitext-Werte) per Hand. Die Brücke (Stand 2.37.0, 46
Werkzeuge) konnte davon nur einen Teil: Felder setzen und einzelne Einträge
zurücknehmen. Sie ist eine Archiv-Brücke, keine Betriebs-Brücke.

Der Owner will dieselbe Kette künftig über die Brücke fahren. Nicht als
Nachbau der Klima-Sitzung, sondern als wiederverwendbare Use Cases, die bei
jeder Library wiederkommen: beim Aufsetzen (Dachverband, AECED), beim
Nachschärfen der Antworten, nach jedem Batch.

## 2. Die fünf Use Cases

| Use Case | Wann er wiederkommt | Heute | Brücke (neu) | Brücke (da) |
|---|---|---|---|---|
| **1 Konfigurieren** | Library aufsetzen, Facette anlegen, Antwortregeln ändern, Vorlage wechseln | Settings-UI, PATCH Library | `konfiguration_lesen`, `konfiguration_setzen` | — |
| **2 Messen** | Nach jeder Regel-, Wörterbuch- oder Vorlagenänderung; Baseline vor einem Hebel | Story-UI, Query-Log im Browser, `scripts/golden-set-run.ts` | `frage_stellen`, `frage_log_lesen`, `golden_set_fahren` | — |
| **3 Index nachziehen** | Facette nachträglich angelegt, Template geändert, Twin korrigiert | Batch-Dialog „Verzeichnis verarbeiten", `ingest-markdown` je Datei | `index_aktualisieren`, `index_entfernen` (Stapel) | `dokument_depublizieren` (einzeln), `dokument_felder_setzen` (ohne Chunks) |
| **4 Bestand prüfen** | Nach jedem Batch, vor jeder Veröffentlichung | `docs`-API im Browser, Storage-Pfade per Hand | `dokumente_auflisten`, `bestand_pruefen` | `abdeckung_lesen`, `twins_pruefen` (Archiv-Seite, nicht Index-Seite) |
| **5 Läufe bilanzieren** | Nach jedem Batch, bei Fehlern | Job-Monitor, `counters`-API | `batch_bilanz`, `batch_neustart` | `job_liste`, `job_status`, `jobs_aufraeumen`, `job_abbrechen` |

Was sich im Test als Muster gezeigt hat und in die Werkzeuge gehört:

- **Konfiguration ist Vertrag.** Ein Platzhalter auf eine unbekannte Facette
  wurde im Formular rot und blockierte das Speichern. Die Brücke muss
  dieselbe Prüfung fahren, sonst steht der Chat der Library (no-silent-fallbacks).
- **Messen vor Ändern.** Die Baseline wurde im Test übersprungen, weil die
  Settings zuerst gefüllt waren. `golden_set_fahren` braucht den Schalter
  `baseline` (Modell ohne Wörterbuch und Regeln, Prüfung mit vollem Schema),
  damit der Vorher-Wert auch nachträglich messbar ist.
- **Index folgt dem Twin.** Der Twin ist die Wahrheit, der Index ein
  Abbild. Jede Korrektur am Twin (Feld setzen) muss den Index nachziehen
  können, sonst laufen Meta-Dokument, Chunks und Vorspann auseinander.
- **Batch braucht Zaun.** Der Batch-Dialog hat Twin-Ordner (`_…`) und
  einen `test/`-Ordner mitgenommen, daraus wurden 29 Doppelgänger.
  `index_aktualisieren` schließt beide aus und nennt, was es übersprang.
- **Fehler nach Ursache, nicht nach Zahl.** 33 Jobs standen auf
  „Worker-Timeout"; die Ursache war „kein Twin". `batch_bilanz` gruppiert
  nach dem letzten Fehlergrund und listet die Quellen, damit ein Neustart
  nur dort passiert, wo er etwas bringt.

## 3. Reihenfolge

1. **Use Case 4 und 5 zuerst** (lesend, kein Risiko): `dokumente_auflisten`,
   `bestand_pruefen`, `batch_bilanz`. Damit ist der Zustand jeder Library
   über die Brücke sichtbar, bevor sie schreibt.
2. **Use Case 3**: `index_aktualisieren`, `index_entfernen`, Chunk-Nachzug
   in `dokument_felder_setzen`. Schließt die Lücke, die im Test per Hand
   gefüllt wurde.
3. **Use Case 1**: Konfiguration lesen, dann setzen.
4. **Use Case 2**: `frage_stellen`, `frage_log_lesen`, `golden_set_fahren`.
   Kommt zuletzt, weil es auf 1 und 3 aufsetzt und das Golden-Set-Format
   aus dem Status-Plan voraussetzt.

Jeder Schritt ist eine eigene Welle mit Integrationstest gegen die
Test-Library (`external-jobs-integration-tests`), Diff-Grenzen nach
`refactor-batch-strategy`.

## 4. Was nicht in diesen Plan gehört

- Rechte und Scopes des Konto-Schlüssels (offene Kante aus ADR 0008): die
  neuen Werkzeuge schreiben mit den vollen Rechten des Besitzers, wie alle
  anderen. Eine Scope-Trennung „nur lesen" wäre ein eigener Plan.
- Eine Galerie-Sicht in der Brücke, die Bilder oder Layout liefert.
  `dokumente_auflisten` gibt Felder, keine Karten.
- Automatische Bereinigung. `bestand_pruefen` meldet, der Mensch entscheidet.

## 5. Betroffene Dateien

- `src/lib/mcp/tools-*.ts` (ein Modul je Use Case), `tools-info.ts`
  (Changelog, `TOOL_NAMES`), `docs/concepts/mcp-storage-stand.md`
- Wiederverwendet: `src/lib/chat/config.ts` (Zod der Konfiguration),
  `src/lib/chat/orchestrator.ts`, `src/lib/chat/golden-set/*`,
  `scripts/golden-set-run.ts` (Kern in eine Service-Funktion ziehen),
  `src/app/api/pipeline/process` (Job-Anlage), `src/lib/repositories/vector-repo.ts`
  (`findDocs`, `deleteVectorsByFileId`), `src/lib/repositories/doc-meta-felder.ts`
