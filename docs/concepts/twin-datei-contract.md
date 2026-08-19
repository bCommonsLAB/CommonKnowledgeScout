# Twin-Datei-Contract: KnowledgeScout und Cowork schreiben denselben Bestand

Stand: 2026-08-17 · Entwurf zur Abnahme · überarbeitete Fassung des Cowork-Entwurfs
`twin-kontrakt-konzept.md` nach dem Architektur-Review vom 2026-08-17.
Grundlagen: `shadow-twin-architecture.mdc`, `shadow-twin-contracts.mdc`,
`storage-abstraction.mdc`, A0-Basis-Feld-Contract
(`src/lib/detail-view-types/base-fields.ts`), Sync-Engine Wellen 5a–5d
(`src/lib/shadow-twin/sync-engine/`).

Geltungsbereich: filesystem-gestützte Libraries, deren Bestand zugleich von
Agenten (Cowork/Claude), Obsidian und Skripten gelesen und teilweise
geschrieben wird. Pilot: „Archiv Peter".

---

## 1. Leitidee und Wahrheitsmodell

Es gibt zwei Produzenten von Wissens-Markdown, die bisher nichts voneinander
wissen: die KnowledgeScout-Pipeline (Transkripte, Transformationen — adressiert
über den `ArtifactKey`) und Cowork-/Claude-Sessions (`BERICHT.md`, `_INDEX.md`
nach den Archiv-Konventionen). Dieser Contract führt beide auf denselben
Datei-Bestand zurück: **Egal wer schreibt — es entsteht dieselbe Datei, gleicher
Name nach demselben Schema, gleiches flaches Frontmatter mit demselben Kern.**
Ein Bericht liest dann Twins statt Rohmedien: Er zitiert Transkript und
Transformation, statt selbst PDF oder Audio auszuwerten.

Die Datei ist die Schnittstelle. Die **Wahrheit** ist dabei nicht pauschal „das
Filesystem", sondern **nach Dateiklasse geteilt** — das ist der Ist-Zustand der
Plattform, kein Umbau:

| Dateiklasse | Beispiele | Wahrheit | Wer schreibt |
|---|---|---|---|
| Quellen | PDF, Audio, Video, DOCX | Filesystem (unveränderlich) | Peter/Cowork legen ab; KS liest |
| Handgeschriebene Contract-Dateien | `BERICHT.md`, `_INDEX.md`, Konventionen | Filesystem | Cowork/Peter; KS liest höchstens |
| Erzeugte Twins | Transkripte, Transformationen | **MongoDB** (`shadow_twins__{libraryId}`); Filesystem-Spiegel als agentenlesbare Kopie | KS-Pipeline; Handkorrekturen am Spiegel fließen per Import zurück |

Die Brücken zwischen Mongo und Spiegel sind die vorhandenen, knopf-ausgelösten
Presets der Sync-Engine: `export` (Mongo → Dateien), `import` (Dateien → Mongo,
inhaltsbewusst, meldet Konflikte), `check`/`repair`. Es gibt **kein Write-Through
und keinen Dauer-Sync** — Abgleich ist ein sichtbarer, expliziter Vorgang.

Zwei Abnahmetests halten das Modell ehrlich:

1. **Spiegel-Test:** Alle Twin-Ordner einer Library löschen → `export` stellt
   sie vollständig wieder her.
2. **Rekonstruktions-Test:** Die Twin-Collection einer Library löschen →
   `import` aus vollständigen Spiegeln stellt sie wieder her. (Das ist zugleich
   der Migrationspfad bei einem künftigen Provider-Wechsel.)

## 2. Die Twin-Familie im Filesystem

Verbindlich ist das Layout, das die Plattform heute schreibt
(`src/lib/shadow-twin/artifact-naming.ts`,
`src/lib/storage/shadow-twin-folder-name.ts`): Twins liegen im
**Schattenordner** neben der Quelle, nicht als Sidecar-Dateien.

```
10_GordischerKnoten_2025-20-10_DW.pdf
_10_GordischerKnoten_2025-20-10_DW.pdf/
  10_GordischerKnoten_2025-20-10_DW.md                             # Transkript (sprachneutral)
  10_GordischerKnoten_2025-20-10_DW.extract_method_from_PDF.de.md  # Transformation
  ...                                                              # Bilder, weitere Artefakte
```

- Ordnername: `_` + vollständiger Quelldateiname (auf 255 Zeichen gekürzt).
- Transkript: `<Basename>.md` — genau eines pro Quelle, **ohne Sprachsuffix**.
- Transformation: `<Basename>.<templateName>.<sprache>.md` — `templateName` ist
  Pflicht. Eine Transformation ohne Template im Namen ist ungültig; es gibt kein
  „latest/best"-Raten, weder in KS noch durch Agenten. Das Schema ist die
  1:1-Abbildung des `ArtifactKey` ins Filesystem.
- Intern existieren zusätzlich `canonical`- und `raw`-Artefakte
  (`<Basename>.canonical.<lang>.md`, `<Basename>.raw.<ext>`) — für Agenten
  lesbar, nie Vorbild für eigene Dateien.

**Discovery-Regel für Agenten:** Wer `X.pdf` findet, prüft den Ordner `_X.pdf/`.
Ordner mit Transkript vorhanden → Quelle gilt als erschlossen; **voll
erschlossen** ist sie erst mit der führenden Transformation (§2b). Ordner fehlt
oder leer → unerschlossen; das ist ein **offener Punkt im `_INDEX.md`**, kein
Auftrag, ad hoc selbst zu transkribieren (§6).

**Alt-Formen:** `X.<lang>.md` neben der Quelle (Sidecar) und Kombi-Dateien sind
Legacy. Die Engine erkennt sie lesend und überführt sie per Namens-Migration
(Welle 5c); neue Dateien entstehen **nie** in Alt-Form. Die Sidecar-Dateien der
DIVA-Texture-Library sind eine Domänen-Ausnahme, kein Vorbild für diesen Contract.

Berichte und Indizes sind Contract-Dateien ohne Quelldatei, direkt im Projektordner:

| Datei | `type` | Erzeugt von |
|---|---|---|
| `_X.pdf/X.md` | `transcript` | KS-Pipeline (Ausnahme: beauftragter Agent, §6) |
| `_X.pdf/X.<tpl>.<lang>.md` | `transformation` | KS-Pipeline (Ausnahme wie oben) |
| `BERICHT.md` | `bericht` | Cowork/Peter |
| `_INDEX.md` | `index` | Cowork/Peter |
| `auftraege/*.md` | `auftrag` | Agentensicht (spätere Ausbaustufe) |

### 2b. Rollen in der Familie: die Transformation führt, das Transkript belegt

Eine Familie hat zwei sehr verschiedene Markdown-Twins, und die Unterscheidung
ist verbindlich:

- Das **Transkript** (`X.md`) ist die Treue-Ebene: die vollständige Textfassung
  der Quelle. Bei einem 600-Seiten-Buch liest es niemand am Stück — es ist
  Rohstoff und Beleg, nicht Lektüre.
- Die **Transformation** (`X.<template>.<lang>.md`) ist das Wissensobjekt: nach
  Template verdichtet, trägt die Basis- und Template-Felder (`title`, `date`,
  `authors`, …, `summary`, `topics`) und speist Galerie, Facetten und
  Detailansicht. Status- und Sichtbarkeitsfelder (z. B. Relevanz,
  Veröffentlichung) sind Template-Felder **dieser** Datei.
- **Führendes Artefakt** einer Familie ist die Transformation nach dem zum
  **Inhaltstyp passenden** Standard-Template (Typ-Template-Registry der
  Library, Welle 0f: `doc_type → Template`; solange nur das eine
  Einzel-Template konfiguriert ist, gilt dieses). Fehlt sie, führt das
  Transkript. Ampel und Verifikation der Familie hängen am führenden
  Artefakt — ein unverifiziertes Transkript neben geprüfter Transformation ist
  Normalzustand, kein Befund.
- **Lese-Ordnung für Agenten:** Transformation zuerst (Felder + Verdichtung);
  das Transkript gezielt für Zitate und Detailfragen; die Quelle nur, wenn
  keine Twins existieren — und dann ist das ein Gap, kein Leseauftrag.
  Berichte verweisen primär auf die Transformation.
- **Korrektur-Ordnung:** Wortlaut- und Transkriptionsfehler werden **im
  Transkript** korrigiert — die Transformation wird daraus erzeugt
  (Re-Transformation nur, wenn der Fehler in der Verdichtung sichtbar ist).
  Verdichtungs-, Feld- und Statuskorrekturen passieren **in der
  Transformation** (Felder per Patch). Handänderungen am Transformations-Body
  sind gegenüber einer Re-Transformation flüchtig (§4.4) — deshalb gehört
  Wortlaut nie dorthin.

## 3. Feld-Contract

Formregeln unverändert aus `AGENTS.md`: **flach, `snake_case`, eine Ebene,
keine Dot-Notation, keine verschachtelten Objekte, Obsidian-kompatibel.**

### 3.1 Twin-Kern — eigener Feldsatz, bewusst NICHT im A0-Basis-Feld-Contract

```yaml
type: transcript          # transcript | transformation | bericht | index | auftrag | template
source_file: 10_GordischerKnoten_2025-20-10_DW.pdf   # nur transcript/transformation
template: extract_method_from_PDF                     # Pflicht bei transformation, sonst verboten
language: de                                          # Inhaltssprache; bei Transformation die Zielsprache
generated_by: knowledgescout/gemini-2.5-pro           # oder claude/fable-5, human:peter, process:aktuell.py
generated_at: 2026-08-17T10:00:00Z
```

Actor-Schreibweise nach OKF-Konvention: `<producer>/<version>`, `human:<id>`,
`process:<id>`.

**Warum nicht in `BASE_REQUIRED_FIELDS`:** Der A0-Kern (`title, date, authors,
language, source, tags`) gilt für jede Library der Plattform, ist per
Exact-Match-Test fixiert, und die Library-Verifikation (A1) würde bei einer
Erweiterung jeden Bestand aller Libraries auf „reparaturbedürftig" stellen.
Der Twin-Kern wird deshalb als **eigener Feldsatz** definiert
(`TWIN_CORE_FIELDS`, analog `base-fields.ts`) und an den **Twin-Schreibstellen**
erzwungen: Pipeline-Writer und Patch-Service setzen die Felder selbst — nie das
LLM. A0 bleibt unverändert; `language` ist das gemeinsame Feld beider Kontrakte,
`source_file` ist bewusst nicht dasselbe wie A0-`source`. Bestands-Twins ohne
Kern sind kein Fehler, sondern ein Befund der Agentensicht
(`twin_core_missing`); nachgezogen wird bei Reparatur/Export.

### 3.2 Kurations-Felder

```yaml
twin_status: draft        # draft | stable | deprecated
verified_by: human:peter  # fehlt = unverifiziert
verified_at: 2026-08-18   # ISO-Datum genügt bei Hand-Verifikation
```

Vertrauensampel mechanisch ableitbar: kein `verified_by` → unverifiziert;
Maschinen-Actor → maschinell bestätigt; `human:` → von Mensch geprüft.

**Temporale Gültigkeitsregel:** Eine Verifikation zählt nur, wenn
`verified_at >= generated_at`. Re-Generierung muss deshalb nichts löschen: Sie
setzt `generated_at` neu und `twin_status: draft` — die alte Verifikation wird
dadurch sichtbar ungültig, bleibt aber als Historie stehen. Die Verifikation von
gestern gilt nicht für den Text von heute.

**Invariante:** `generated_by` ≠ `verified_by` auf Actor-Ebene — niemand
verifiziert die eigene Generierung (prüfbar; Gap-Typ `self_verified`).

**Namenskollision entschieden:** Das Feld heißt `twin_status`, nicht `status`,
weil `status` im Archiv den Projektlebenszyklus meint
(`aktiv | ruhend | abgeschlossen`). Berichte behalten ihr `status`-Feld unverändert.

**Verifiziert wird primär das führende Artefakt** der Familie (§2b) — die
Abnahme der Transformation ist menschengroß (Felder und Verdichtung prüfen);
das Transkript wird stichprobenhaft geprüft, nicht seitenweise.

### 3.3 Alles Weitere ist Template-Sache

Oberhalb des Kerns definieren Templates frei Felder (`summary`, `topics`,
`chapters`, …). Konsumenten (Berichte, `aktuell.py`, Agenten) verlassen sich
**nur auf den Kern**; Template-Felder sind Bonus. Der Kern ist klein, damit er hält.

## 4. Schreibregeln (KnowledgeScout)

1. **Kern setzt der Writer, nicht das LLM.** `generated_by/at` stammen aus dem
   Pipeline-Kontext (Job/Modell), Kurations-Felder aus der Kurations-Aktion.
2. **Patch statt Neuschreiben.** Kuration läuft über einen Feld-Patch
   (`patchArtifactFrontmatter` im `ShadowTwinService`; Kurations-Route seit
   Welle 4: `POST /api/library/{id}/shadow-twins/curation`). Regel:
   **unbekannte Frontmatter-Felder und der Body bleiben
   beim Schreiben erhalten** — nur so überlebt eine Obsidian-Handkorrektur oder
   Agenten-Ergänzung den nächsten KS-Schreibvorgang.
3. **Konfliktschutz gegen Spiegel-Drift.** Vor Patch/Export prüfen, ob der
   Spiegel seit dem letzten Abgleich extern geändert wurde. Wenn ja: nicht
   überschreiben, sondern Befund „erst importieren" — der `conflict`-Befund der
   Engine ist die vorhandene Sprache dafür. Kein stiller Fallback
   (`no-silent-fallbacks.mdc`). Umgesetzt (Welle 4, Kurations-Route) als
   **Inhalts-Vergleich** Spiegel ↔ Mongo mit derselben Normalisierung wie der
   Engine-Konfliktvergleich — stärker als der ursprünglich skizzierte
   mtime-Guard, weil `filesystemSync.lastSyncedAt` im Bestand nie gepflegt
   wurde; Antwort ist HTTP 409 `mirror_drift`.
4. **Body-Hoheit.** Der Body gehört dem Generator; Twin-Kern und
   Kurations-Felder gehören der Kuration; Template-Felder dem Extractor.
   Re-Transformation erzeugt Body und Template-Felder neu und wendet §3.2 an.
5. **Handkorrektur-Weg (Default entschieden).** Obsidian und Agenten dürfen
   Spiegel-Dateien in `_`-Ordnern editieren. Der Rückweg ist der **Import**
   (inhaltsbewusst; Konflikte werden gemeldet, nicht überschrieben). Konvention:
   nach Handkorrektur in KS „Prüfen" laufen lassen. Wichtig: Korrekturen und
   beauftragte Twins **in den `_`-Ordner** schreiben — Artefakt-Dateien direkt
   neben der Quelle werden bei der Adoption derzeit übersprungen (bekannter
   offener Punkt aus Welle 5d).

Nicht angefasst werden: `ArtifactKey`-Semantik, Storage-Abstraktion,
Mongo-Primärablage, A0-Basis-Feld-Contract, die bestehende Archiv-Ansicht.

## 5. Rollenmodell — sechs Augen auf demselben Inhalt

| Akteur | erzeugt | verifiziert | liest |
|---|---|---|---|
| KS-Pipeline | Transkripte, Transformationen (Mongo + Spiegel) | — | Quellen |
| KS-Sync-Engine (Buttons drückt Peter) | Spiegel (`export`), Mongo-Übernahmen (`import`) | — | beide Seiten; meldet Konflikte |
| KS-Kurations-UI / Agentensicht | Feld-Patches | `verified_*`, `twin_status` | Twins, Coverage |
| Cowork/Claude-Session | Berichte, Indizes; Twins nur auf Auftrag (§6) | nie sich selbst | Twins statt Rohmedien, wenn Twin existiert |
| Peter (Obsidian oder KS) | Korrekturen | `verified_by: human:peter` | alles |
| `aktuell.py` / `projekte.py` | `AKTUELL.md`, `PROJEKTE.md` | — | Frontmatter-Kern |

Die Redundanz ist gewollt: Pipeline (erzeugt), Mensch (prüft), Agent (konsumiert
und meldet Widersprüche als offene Punkte) sind getrennte Rollen. Die Sichten —
Dateien, Mongo, Coverage-Report — werden durch explizite Prüfen-Läufe
abgeglichen, nicht durch stille Syncs: Eine Unstimmigkeit ist ein sichtbarer
Befund, kein stiller Datenverlust. So macht die doppelte Ablage das System
stabiler statt fragiler.

## 6. Dürfen Agenten Twins erzeugen? (Default entschieden)

Standard: **nein.** Eine unerschlossene Quelle wird als offener Punkt im
`_INDEX.md` vermerkt und über die KS-Pipeline erschlossen. Ausnahme: ein
**expliziter Auftrag** (z. B. aus dem Auftrags-Generator der Agentensicht).
Dann gilt: exakt contract-konform (Layout §2, Kern §3.1,
`generated_by: claude/<modell>`), in den `_`-Ordner, danach Import über KS.
So bleibt nachvollziehbar, was maschinell entstand und was davon geprüft ist.

## 7. Identität und Umzüge

- Die Identität von Twins hängt an der `sourceId` = Provider-Item-ID; bei
  OneDrive (Graph) überleben IDs Umbenennen und Verschieben. **Kein `uid`-Feld
  im Frontmatter** — Begründung im Bruchstellen-Katalog §2.
- **Familien-Umzug:** Quelle und ihr `_`-Ordner ziehen immer gemeinsam um;
  nie den Basename nur einer Seite ändern. Umzugsprotokoll wie gehabt.
  Ab Welle 0e ist das eine **Funktion** (`familie_umziehen`) in fester
  Reihenfolge: erst Import (keine Handkorrektur verlieren), dann Quelle
  verschieben/umbenennen, Namen in der Datenbank nachziehen, alten
  Spiegelordner löschen, Export regeneriert den Spiegel am neuen Ort.
  Umzüge NACH der Erschließung sind damit Normalfall, kein Risiko
  (Zyklus v2 §3).
- Vorbehalt Nextcloud: Der heutige Nextcloud-Provider bildet IDs aus Pfaden.
  Vor einer Migration der heißen Schicht (Zielbild Etappe 7) ist der Provider
  auf Nextclouds stabile `fileid` umzustellen — eigener Arbeitspunkt, nicht
  Teil dieses Contracts.

## 8. OKF-Anschluss (Abfallprodukt, kein Treiber)

Der Kern ist so gewählt, dass ein Export-Skript ihn verlustfrei nach OKF v0.2
hebt: `generated_by/at` → `generated: {by, at}`, `verified_by/at` →
`verified: [{by, at}]`, `twin_status` → `status`, `source_file` →
`sources[].resource`, `_INDEX.md` → `index.md`. Das Skript lebt im Archiv neben
`aktuell.py`; im Bestand bleibt alles flach und Obsidian-lesbar.

## 9. Umsetzung und Entscheidungslage

Reihenfolge: KS-Seite in `projektauftrag-agentensicht.md` (Wellen 0–4),
Archiv-Seite in `cowork-briefing-archivsicht.md` (ein Nachmittag).

Mit diesem Dokument gesetzte Defaults (Veto bei Abnahme möglich):

1. `twin_status` statt Umbenennung von `status` (§3.2).
2. Handkorrektur am Spiegel erlaubt; Rückweg ist der Import (§4.5) — statt
   „Twins sind read-only".
3. Agenten erzeugen Twins nur auf expliziten Auftrag (§6).
4. Schattenordner-Layout ist der Contract; Sidecar ist Legacy (§2).
