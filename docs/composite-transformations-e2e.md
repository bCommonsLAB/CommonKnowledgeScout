# Composite-Transformations: Manuelles E2E-Test-Szenario

## Was wird getestet?

Sammel-Markdown, dessen Wikilinks **auf Transformations-Artefakte** der Quellen
zeigen (statt auf deren Transcripts). Die erzeugte Datei nutzt **kein neues
`kind`** und laeuft durch den ganz normalen `composite-transcript`-Pipeline-Pfad.

Wikilink-Schema: `[[Quellname/Templatename]]`

## Voraussetzungen

- Eingerichtete Library mit `primaryStore` (Mongo oder Filesystem — egal).
- Mehrere Quelldateien im selben Verzeichnis (z. B. PDF-Seiten oder andere
  Dokumente), die bereits **mit demselben Template** analysiert wurden, sodass
  die zugehoerigen Transformations-Artefakte in MongoDB existieren.
- Beispiel: 5 PDF-Seiten, alle einmal mit `gaderform-bett-steckbrief` analysiert.
- Ein zweites Template (z. B. `zusammenfassung`), das auf das Sammel-Markdown
  als Folge-Schritt angewendet werden kann.

> **Hinweis zu `.md`-Quellen** (seit Bugfix 2026-04-28): Markdown-Originale werden
> ebenfalls als gleichwertige Quellen behandelt, sofern sie ein Transformations-
> Artefakt mit dem gewaehlten Template besitzen. Der Suffix `/templateName` wird
> im `_source_files`-Eintrag und im Wikilink konsequent gesetzt — auch fuer `.md`.
> Anwendungsfall: Steckbrief-Markdowns (z. B. `bett cortina.md`), die selbst per
> Template `gaderform-bett-steckbrief` transformiert wurden, lassen sich
> aggregieren und auf ihre Transformationen verweisen.

## Schritte

### 1. Quellen markieren

1. Im File-Browser zum Verzeichnis mit den analysierten Quellen navigieren.
2. **Mindestens 2 Dateien** anhaken (Checkbox in der Liste). Bei <2
   Dateien oder bei Mischselektion ueber mehrere Verzeichnisse hinweg
   bleibt der Toolbar-Button verborgen (per Design).

### 2. Sammel-Transformationen-Dialog oeffnen

1. In der Toolbar erscheint der Button mit dem **Combine**-Icon
   ("Sammel-Transformationen erstellen…").
2. Ein Klick oeffnet den Dialog. Im Hintergrund wird:
   - `GET /api/library/{id}/composite-transformations?sourceIds=…&sourceNames=…&targetLanguage=de`
   - aufgerufen, um die verfuegbaren Templates zu ermitteln.
3. Der Dialog zeigt:
   - **Template-Dropdown** mit Eintraegen wie `gaderform-bett-steckbrief (5/5)`.
     Format: `<templateName> (covered/total)`.
   - **Inline-Warnung**, falls das gewaehlte Template nicht alle Quellen abdeckt
     ("Fehlt bei: x.pdf, y.pdf").
   - **Filename**-Input mit Default-Vorschlag (`<gemeinsamer Praefix>_transformationen.md`).
   - **Titel** (optional).

**Erwartung:**
- Wenn keine Transformationen existieren → Hinweis "Keine Transformationen
  bei den markierten Quellen gefunden". Submit ist deaktiviert.
- Submit ist nur aktiv, wenn die Auswahl voll abgedeckt ist (kein
  `missingSources`-Eintrag).

### 3. Erstellen

1. Template waehlen, Filename eingeben, "Erstellen" klicken.
2. Im Hintergrund:
   `POST /api/library/{id}/composite-transformations`
3. Erfolg → Toast "Sammel-Transformationen erstellt" + Datei erscheint in der Liste.
4. Fehler-Faelle:
   - **409 (Filename-Kollision)**: Toast "Dateiname bereits vergeben". Dialog bleibt offen.
   - **400 (Template fehlt bei Quellen)**: Sollte dank Dialog-Validierung nicht
     vorkommen, ist aber als Verteidigungslinie da.

### 4. Inhalt der Sammel-Datei pruefen

Die erzeugte Datei sollte etwa so aussehen:

```markdown
---
_source_files: ["seite1.pdf/gaderform-bett-steckbrief","seite2.pdf/gaderform-bett-steckbrief"]
kind: composite-transcript
createdAt: 2026-04-28T...
---

# Sammel-Transformationen

## Quellen

### seite1.pdf
- [[seite1.pdf/gaderform-bett-steckbrief]]

### seite2.pdf
- [[seite2.pdf/gaderform-bett-steckbrief]]
```

**Wichtig:**
- `kind` ist `composite-transcript` (KEIN neues kind — bewusst).
- `_source_files`-Eintraege tragen das Schraegstrich-Suffix mit dem
  Templatenamen.
- Der Resolver erkennt den Suffix und laedt entsprechend die Transformation.

### 5. Sammel-Datei weiterverarbeiten

1. Sammel-Datei in der Liste auswaehlen.
2. Mit einem **anderen** Template (z. B. `zusammenfassung`) eine neue
   Transformation darauf starten.
3. Im Hintergrund laeuft der ganz normale `composite-transcript`-Pipeline-Pfad:
   - `start/route.ts` erkennt `kind: composite-transcript`.
   - `resolveCompositeTranscript()` parst `_source_files`, erkennt das
     Schraegstrich-Suffix und ruft `getShadowTwinArtifact({kind:'transformation', templateName, targetLanguage})`
     fuer jede Quelle auf.
   - Das geflachte Markdown enthaelt die Transformations-Inhalte (statt der
     Transcripts) als `<source>`-Bloecke.
   - Der Transformer erhaelt diese aggregierte Datei als Eingabe.

**Erwartung:** Die Folge-Transformation arbeitet mit dem aggregierten Inhalt
aller Steckbrief-Analysen und kann z. B. eine Zusammenfassung erstellen.

### 6. Negativ-Faelle

| Szenario                                              | Erwartetes Verhalten                                 |
| ----------------------------------------------------- | ---------------------------------------------------- |
| Quelle hat das Template, aber nicht in der Sprache   | Template erscheint nicht im Dropdown                 |
| Eine markierte Quelle hat keine Transformation       | Template ist im Dropdown nur, wenn die ueberhaupt von einer der Quellen vorhanden; Submit erst nach Auswahl mit voller Coverage moeglich |
| Quellen aus unterschiedlichen Verzeichnissen         | Toolbar-Button bleibt verborgen                      |
| Filename mit Pfad-Trenner (z. B. `foo/bar.md`)       | 400 mit Fehlermeldung                                |
| Filename existiert bereits im Verzeichnis            | 409 mit Toast                                        |
| Re-Analyse ohne Cache                                | useCache-Default ist `false` (siehe Image-Analyzer-Cache-Fix vom Vorlauf) |

## Akzeptanzkriterien

- [ ] Dialog laedt Templates korrekt und zeigt Coverage-Verhaeltnis.
- [ ] Submit ist nur aktiv, wenn alle Quellen das Template haben.
- [ ] Erstellte Datei traegt `kind: composite-transcript` und Suffix-Eintraege.
- [ ] Folge-Transformation auf die Sammel-Datei flacht die Transformations-
      Inhalte (NICHT die Transcripts) ein.
- [ ] Bei Pipeline-Fehler (Transformation fehlt) erscheint sie in
      `unresolvedSources` und das Job-Log enthaelt eine entsprechende Warnung.

## Verwandte Dateien

- Build/Resolver: [`src/lib/creation/composite-transcript.ts`](../src/lib/creation/composite-transcript.ts)
- Suffix-Parser: [`src/lib/creation/composite-source-entry.ts`](../src/lib/creation/composite-source-entry.ts)
- Pool-Lookup: [`src/lib/creation/composite-transformations-pool.ts`](../src/lib/creation/composite-transformations-pool.ts)
- API-Route: [`src/app/api/library/[libraryId]/composite-transformations/route.ts`](../src/app/api/library/%5BlibraryId%5D/composite-transformations/route.ts)
- Dialog: [`src/components/library/composite-transformations-create-dialog.tsx`](../src/components/library/composite-transformations-create-dialog.tsx)
- Toolbar-Integration: [`src/components/library/file-list.tsx`](../src/components/library/file-list.tsx)
- Determinismus-Contract: [`.cursor/rules/shadow-twin-contracts.mdc`](../.cursor/rules/shadow-twin-contracts.mdc)
