---
name: d06-verdichten
overview: "Detailkonzept D6: Aus den Beitragsdateien eines Themas entsteht über das bestehende Sammeltranskript und eine Template-Transformation ein Synthese-Vorschlag mit Belegspur. Sammelreferenz je Tisch und Textstelle, Vorlage shf-synthese-de mit Beleg-Markern, Job ohne Suchindex, Belegprüfung in der App, Fassungskette in syntheses, Übernahme als Entwurf."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D6 · Verdichten

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md)
(Synthese liest Dateien; Fassungskette ist Klasse **V**),
[D5](d05-fensterschluss-beitraege-werden-dateien.plan.md)
(Beitragsdateien), `GRUNDSAETZE.md` §5 (im Archiv: alle Stimmen · Fokus ·
zur Messung). Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| M-S8b.1 Synthese-Vorschlag | Die Moderation löst den Vorschlag aus. Jede Aussage zeigt ihre Belege, eine Aussage ohne Beleg ist markiert. „Als Entwurf übernehmen“, „Neu erzeugen“ |
| T-S8b.1 Ihre Sätze im Ergebnis | Teilnehmende sehen die Aussagen, die ihre Beiträge belegen (D8/D9 lesen dafür die Belege) |

Die Maschine formuliert, der Tisch bestätigt (D8), die Redaktion macht die
Fassung (D10). Der Vorschlag geht **nie direkt an die Runde**; er
erscheint bei der Moderation (Konzept 13.09., Abschnitt 3.3).

## 2. Ablauf

1. **Sammelreferenz schreiben** (Stufe (d) in D5, und nach jedem Widerruf
   oder Herausnehmen neu).
   - Datei: `Veranstaltungen/{Reihe}/{Treffen}/Tisch {n}/{textstelle_id} Sammlung.md`,
     ein fester Name je Tisch und Textstelle.
   - Inhalt: `buildCompositeReference({libraryId, userEmail,
     targetLanguage: 'de', sourceItems})` (`composite-transcript.ts:170`).
     Das liefert nur das Markdown mit `_source_files`, `kind:
     composite-transcript` und Wiki-Links, **ohne Upload** (`:271`). Die
     Datei schreibt die Beteiligung selbst: beim ersten Mal
     `uploadFile`, danach `ersetzeTextDatei` mit Versionsprüfung.
   - Die bestehende Route `POST …/composite-transcript` passt nicht. Sie
     verlangt mindestens zwei Quellen (`route.ts:57`), vergibt einen Namen
     mit Zeitstempel (`:83-84`) und legt die Datei neben die erste Quelle
     (`:87-92`), also in einen Organisationsordner.
   - `sourceItems` sind die Beitragsdateien mit `beitrag_status:
     im_ergebnis`. Dazu kommen die Transkripte langer PDFs (D5, 4).
   - Ein Tisch mit **einem** Beitrag ist erlaubt. Es gibt keine
     Mindestzahl; die Oberfläche weist darauf hin.
   - Die Frontmatter-Felder `thema`, `tisch_id`, `textstelle_id` und
     `fenster_id` werden zusätzlich gesetzt.
2. **Transformation starten.** Das ist ein Text-Job auf der Sammelreferenz
   mit der Vorlage `shf-synthese-de`, gestartet über
   `enqueueSourceMarkdownJob({libraryId, userEmail, source, template,
   targetLanguage, erzwingen})` (`src/lib/external-jobs/enqueue-markdown-job.ts:89`).
   - Dieser Weg schaltet heute **Ingest immer ein** (`:78-79`,
     `phases.ingest: true`). Der Synthese-Vorschlag gehört nicht in den
     Suchindex. Neu ist deshalb die Option `ingest: false`
     (`policies.ingest: 'ignore'`).
   - „Neu erzeugen“ setzt `erzwingen: true` (Werkzeugsatz 2.30.3).
   - Der Worker löst die Wiki-Links auf und baut den geflachten Text
     (`resolveCompositeTranscript`, `:285`; Format `:718-816`). Je Quelle
     entsteht ein Block `<source file="{Dateiname}" index="{n}">`, und
     `.md`-Quellen kommen **mit ihrem Frontmatter** herein (`:382-387`).
     Das Modell sieht also `organisation`, `gruppe` und `beitrag_id` jeder
     Stimme und kann nach Gruppen ausweisen. Einen Namen sieht es bei V1
     nicht, weil keiner in der Datei steht (D5).
   - Ist eine Quelle nicht auflösbar, bricht der Job ab
     (`phase-shadow-twin-loader.ts:216-222`). Das ist richtig so: keine
     Synthese über eine unvollständige Sammlung.
3. **Ergebnis lesen.** Das Artefakt hängt an der Sammelreferenz:
   `getShadowTwinArtifact({libraryId, sourceId: compositeFileId,
   artifactKey: toArtifactKey({sourceId, kind: 'transformation',
   targetLanguage: 'de', templateName: 'shf-synthese-de'})})`
   (`shadow-twin-repo.ts:326`, `:526`).
4. **Belegprüfung** (neu, deterministisch, Abschnitt 4).
5. **Fassung anlegen** in `syntheses` (Abschnitt 5). Die Transformation am
   Shadow Twin wird beim nächsten Lauf überschrieben. Die Fassung in
   `syntheses` bleibt.

Den Jobstatus fragt die Moderationsansicht ab (`GET /api/external/jobs/[jobId]`,
`route.ts:62`). Nach Abschluss ruft der Job-Rückfluss die Schritte 3–5 auf.

## 3. Die Vorlage `shf-synthese-de`

Das Format folgt den Bestandsregeln (`docs/contracts/template-structure.md`):
- Frontmatter mit `{{feld|Anweisung}}`, flach.
- Ein Body.
- `--- systemprompt`.

Die Belege stehen **im Body als Marker**, nicht als verschachteltes
Frontmatter (Regel „flach“). Keine bestehende Vorlage lässt bisher
Quell-Indizes zitieren; das ist neu.

```markdown
---
titel: {{titel|Kurzer Titel der Synthese, höchstens 8 Wörter}}
anzahl_quellen: {{anzahl_quellen|Anzahl der <source>-Blöcke als Zahl}}
anzahl_aussagen: {{anzahl_aussagen|Anzahl der Aussagen im Abschnitt Fokus als Zahl}}
---
## Alle Stimmen
{{alle_stimmen|Für JEDEN <source>-Block genau eine Zeile: "- [Qn] Kernaussage in einem Satz". n ist der index des Blocks. Keine Quelle auslassen, auch nicht, wenn sie nur einmal vorkommt.}}

## Fokus
{{fokus|3 bis 7 Aussagen, die weitergehen. Jede Aussage als eigene Zeile "- Aussage. [Q1, Q4]" mit den index-Nummern aller Quellen, die sie tragen. Keine Aussage ohne mindestens einen Beleg. Abweichende Einzelstimmen ausdrücklich aufnehmen.}}

## Warum dieser Fokus
{{begruendung|Wenige Sätze: warum gerade diese Punkte, und was nicht weitergeht und warum.}}

## Zur Messung
{{messung|Der Vorschlag, zu dem der Tisch Stellung nimmt, als zusammenhängender Text. Bezug auf die Textstelle.}}

--- systemprompt
Du verdichtest Beiträge eines Arbeitstisches zu einer Textstelle. Jede
Quelle ist ein <source file="…" index="n">-Block; das Frontmatter der
Quelle nennt Organisation und Gruppe. Erfinde nichts. Jede Aussage im
Fokus trägt die index-Nummern ihrer Belege als [Qn]. Keine Stimme geht
verloren: Im Abschnitt „Alle Stimmen“ steht jede Quelle genau einmal.
Antworte nur mit dem geforderten JSON-Objekt.
```

Die Vorlage liegt als Datei im Archiv bzw. unter `template-samples/` und
wird wie jede Vorlage nach `templates` (MongoDB) importiert
(`importTemplateFromStorage`). Maßgeblich zur Laufzeit ist die Kopie in
MongoDB.

## 4. Belegprüfung

Das ist eine reine Funktion
`pruefeBelege(markdown, quellen: {index, fileId, fileName, beitragId}[]): Belegbericht`,
nach dem Muster der deterministischen Nachrechnung beim Overlap-Bericht
(`phase-overlap-report.ts:163-168`):

| Prüfung | Ergebnis |
|---|---|
| Jeder Marker `[Qn]` verweist auf eine vorhandene Quelle | ungültige Marker werden markiert |
| Jede Aussage im **Fokus** hat mindestens einen Marker | sonst `ohneBeleg: true` (in der Oberfläche orange) |
| Jede Quelle kommt in **Alle Stimmen** genau einmal vor | `coverage {total, cited, uncited[]}` — Prüffrage 1 „Kommt jede Stimme vor?“ |
| Fokus-Belege nach Gruppe gezählt (aus dem Frontmatter der Quelle) | `groupCoverage` — Hinweis, wenn eine Gruppe mit Beiträgen im Fokus fehlt |

Der Bericht wird nicht still korrigiert: Fehlende Stimmen werden
**angezeigt**, die Moderation entscheidet über „Neu erzeugen“.

## 5. Fassungskette `syntheses`

Schlüssel `(libraryId, tableId, passageId)`:

```ts
interface Synthesis {
  libraryId: string; meetingId: string; tableId: string; passageId: string
  compositeFileId: string; compositePath: string
  versions: Array<{
    seq: number                      // 1, 2, 3 … unveränderlich
    createdAt: string; createdBy: string; jobId: string
    templateName: string; model?: string
    markdown: string                 // Transformation, wie geliefert
    statements: Array<{ text: string; evidence: Array<{ index: number; fileId: string; beitragId: string }>; ohneBeleg: boolean }>
    proposalText: string             // Abschnitt „Zur Messung“
    coverage: { total: number; cited: number; uncited: string[] }  // beitragIds
    sourcesHash: string              // über die Liste der Quellen; zeigt, ob sich die Sammlung seither geändert hat
  }>
  pointer: { draft: number | null }  // „Als Entwurf übernehmen“
  confirmedByTable?: { seq: number; at: string; by: string }      // D8
  releasedByEditors?: Array<{ seq: number; at: string; by: string; resultFileId: string }> // D8, D10
  updatedAt: string
}
```

- Neue Fassungen werden nur angehängt, nie ersetzt. Ein Rückweg setzt nur
  den Zeiger.
- Ist `sourcesHash` der gewählten Fassung ungleich der aktuellen Sammlung
  (Widerruf nach der Erzeugung), zeigt die Oberfläche „Sammlung hat sich
  geändert — neu erzeugen?“.
- Die Muster sind `overlap_reports` (`overlap-report-repo.ts:47-65`) und
  die Snapshot-Kette aus BetterWriter (Architektur-Konzept, S8b).

## 6. Schnittstellen

### 6.1 Bestand

| Zweck | Bestand |
|---|---|
| Referenz bauen | `buildCompositeReference` (`composite-transcript.ts:170`) |
| Referenz auflösen (im Worker) | `resolveCompositeTranscript` (`:285`), `phase-shadow-twin-loader.ts:192-231` |
| Job starten | `enqueueSourceMarkdownJob` (`enqueue-markdown-job.ts:89`) |
| Erneuern | `erzwingen` → `policies.metadata: 'force'` |
| Ergebnis lesen | `getShadowTwinArtifact`, `toArtifactKey` (`shadow-twin-repo.ts:326`, `:526`) |
| Transformation | `callTemplateTransform` über den Secretary (`template-run.ts`) |
| Vorlage importieren | `importTemplateFromStorage` (`template-import-export.ts:24-54`) |
| Datei versioniert ersetzen | `ersetzeTextDatei` |

### 6.2 Neu

| Baustein | Signatur |
|---|---|
| Referenz schreiben | `writeCollectionReference(libraryId, tableId, passageId): Promise<{fileId, sourcesHash}>` |
| Option `ingest` | `enqueueSourceMarkdownJob({… , ingest?: boolean})` (Vorgabe `true` wie heute) |
| Rückfluss | Nach Abschluss eines Jobs mit `correlation.options.synthesis {tableId, passageId}`: Artefakt lesen → `pruefeBelege` → `appendSynthesisVersion` |
| Belegprüfung (rein) | `pruefeBelege(markdown, quellen): Belegbericht`; `parseSyntheseMarkdown(markdown)` → Abschnitte, Aussagen, Marker |
| Repo | `syntheses-repo.ts`: `appendVersion`, `setDraftPointer`, `getSynthesis` |
| Routen | `POST /api/deliberation/[libraryId]/tables/[tableId]/syntheses {passageId, erzwingen?}` → `{jobId}` · `GET …/syntheses?passageId` · `POST …/syntheses/draft {passageId, seq}` |
| Vorlage | `shf-synthese-de` (3) |

## 7. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Eine Beitragsdatei fehlt (manuell gelöscht) | Job bricht ab (Bestand); Meldung mit Dateiname; kein Vorschlag |
| Modell liefert kein gültiges Ergebnis | Job `failed`, Meldung; keine Fassung |
| Marker unlesbar oder Abschnitt fehlt | Fassung wird **angelegt**, mit Befunden im Bericht (sichtbar, nicht still repariert) |
| Transformation schon aktuell und kein `erzwingen` | Bestand wirft „bereits aktuell“ → die App zeigt die vorhandene Fassung |

## 8. Tests

- `parseSyntheseMarkdown` und `pruefeBelege`:
  - vollständige Abdeckung;
  - fehlende Stimme;
  - Aussage ohne Beleg;
  - Marker auf einen nicht vorhandenen Index;
  - Gruppenabdeckung.
- `writeCollectionReference`: nur `im_ergebnis`; ein Beitrag; langes PDF
  mit Transkript; stabiler Name; Versionskonflikt.
- `enqueueSourceMarkdownJob` mit `ingest: false`: Die Phase `ingest` ist
  aus. Freeze-Test: Ohne die Option ist alles wie heute.
- Fassungskette: nur Anhängen, Zeiger, `sourcesHash` bei geänderter
  Sammlung.

## 9. Offene Fragen

1. Synthese zu Fuß (Entscheidung aus dem Wellen-Plan, 4.4): Die Redaktion
   könnte eine extern erstellte Fassung als Version einfügen. Vorgesehen
   ist eine Route `POST …/syntheses/manual` mit Belegprüfung; sie ist
   nicht Teil des Fundaments.
2. Welches Modell? Heute gilt das Modell der Library-Konfiguration
   (`transformation_starten` nimmt es von dort). Für die Synthese ist ein
   starkes Modell sinnvoll; das ist eine Einstellung, kein Code.
3. Variante „3–5 Formulierungen“ (A1 am 13.11.): Die Vorlage bekommt eine
   zweite Ausprägung mit mehreren Vorschlägen. Die Messung (D7) trägt n
   Optionen ohnehin.

## 10. Aufwand

| Teil | PT |
|---|---|
| Referenz schreiben, `ingest`-Option, Rückfluss | 1–1,5 |
| Parser und Belegprüfung mit Tests | 1 |
| Repo, Routen | 0,5–1 |
| Vorlage schreiben und an echten Probe-Beiträgen erproben | 1–2 |
| **Summe D6** | **3,5–5,5** |
