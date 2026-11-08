---
name: sitzungen-sichten-und-befunde
overview: "Arbeitssitzungen mit Claude (Belege `type: chatverlauf`, Vorlage `chatverlauf-de`) werden in der Archiv-Library zu erzeugten Sichten statt zu handgepflegten Kopien: eine Chronik `Organisation/SITZUNGEN.md` und ein Block „Sitzungen" je BERICHT.md, beide aus den Transformationen in MongoDB gerendert (Welle S1); dazu Sitzungs-Befunde im Abdeckungsscan, damit Lücken und Widersprüche maschinell sichtbar werden (Welle S2). Der Skill `sitzung-abschliessen` schrumpft danach auf Beleg ablegen, Transformation anstoßen, Mail, Abhaken."
status: geplant
umsetzung_ab: null
todos:
  - id: s1-sitzungs-sicht
    content: "S1 — Sitzungs-Sicht und Bericht-Block: Repo-Abfrage „Transformationen einer Vorlage", Datenmodell SitzungsDatensatz, Renderer für Organisation/SITZUNGEN.md, generischer Block-Ersetzer, Block „Sitzungen" je BERICHT.md, Brücke: sichten_regenerieren erweitert + sitzungen_block_schreiben"
    status: pending
  - id: s2-sitzungs-befunde
    content: "S2 — Sitzungs-Befunde im Abdeckungsscan: erwartete Vorlage je Beleg-Typ, Befunde sitzung_ohne_transformation, sitzung_ohne_vorhaben, sitzung_doppelt, sitzungen_block_veraltet, sitzungs_sicht_veraltet; Registry, Auftragsvorlagen, Labels, Tests"
    status: pending
  - id: s3-skill-anpassen
    content: "S3 — Skill sitzung-abschliessen (Archiv-Original, kein Repo-Code): Abschnitte 3 (Notiz-Kopie) und 4 (Verweiszeile) durch einen Sichten-Aufruf ersetzen; Altbestand der Notiz-Kopien nach Owner-Entscheid"
    status: pending
  - id: s4-sitzungsmail
    content: "S4 (optional) — Brücken-Werkzeug sitzung_mailen: Transformation einer Sitzung über den vorhandenen Mailjet-Versand (mail-dispatch.ts) an die Owner-Adresse, Betreff und Kopf-Tabelle wie Skill Abschnitt 6, Mail-Log"
    status: pending
---

# Sitzungen: Sichten statt Kopien, Befunde statt Hoffen

**Vorhaben:** Wissensarchiv des Owners (Library mit `archivpflege: true`).
**Grundlage:** Konzept „Sitzungen als Belege" (Archiv, Abnahme 04.11.2026) und
das Konzept „Sitzungs-Sichten und Sitzungs-Befunde" (Archiv, 08.11.2026).
**Verwandt:** [`projektauftrag-agentensicht.md`](../../concepts/projektauftrag-agentensicht.md),
[`erschliessungszyklus.md`](../../concepts/erschliessungszyklus.md),
ADR [0006](../../adr/0006-beweislast-umdrehen-werkbank-kuration.md).

## 1. Ausgangslage

Seit dem 03.11.2026 landet jede Arbeitssitzung mit Claude als Beleg
`JJJJ-MM-TT Code|Chat <Titel>.md` beim Hauptvorhaben; KnowledgeScout erzeugt
daraus mit der Vorlage `chatverlauf-de` eine Sitzungsnotiz (Transformation am
Twin). Danach schreibt heute ein Agent von Hand zwei Abschriften:

1. eine Kopie der Notiz nach `Organisation/Sitzungen/JJJJ-MM-TT <Titel>.md`
   (Chronik, Referenzliste für Agenten),
2. eine Verweiszeile in den Block „Sitzungen mit Claude (nachgetragen …)"
   im `BERICHT.md` des Vorhabens, datumsortiert einzufügen.

Beides sind Anordnungen von Daten, die in `shadow_twins__<libraryId>` schon
liegen (`artifacts.transformation['chatverlauf-de'].de.frontmatter`: title,
teaser, summary, date, werkzeug, sitzung, …; der Vorhabensordner steht im
Pfad der Quelle). Die Abschriften kosten je Sitzung mehrere Agentenschritte,
in denen ein Sprachmodell vorhandenen Text abtippt, und sie sind die Stelle,
an der im Altbestand (471 Sitzungen, Stand 08.11.) Fehler auftraten:
falsche Reihenfolge, vergessene Zeilen, abweichende Kopffelder.

KnowledgeScout kann das bereits an anderer Stelle: `sichten_regenerieren`
rendert `AKTUELL.md` und `PROJEKTE.md` aus allen Berichten;
`erschliessung_block_schreiben` ersetzt in `_INDEX.md` den Block zwischen
`<!-- erschliessung:start -->` und `<!-- erschliessung:end -->`, der Rest der
Datei bleibt unberührt. Dieser Plan überträgt beide Mechaniken auf Sitzungen.

## 2. Ziel

- **Eine Chronik, die stimmt, ohne dass jemand sie pflegt:**
  `Organisation/SITZUNGEN.md`, erzeugt aus den Transformationen, je Vorhaben
  ein Abschnitt in Archiv-Ordnung, darin chronologisch (älteste zuerst):
  Datum, Art-Wort (Code/Chat), Titel als Wikilink auf den Beleg, Teaser.
- **Ein Block „Sitzungen" je Bericht**, von der Maschine geschrieben, zwischen
  Markern, datumsortiert, mit denselben Zeilen.
- **Befunde statt Durchsicht:** Der Abdeckungsscan meldet Belege ohne
  Transformation, Belege ohne Vorhaben, doppelte Belege derselben Sitzung,
  veraltete Blöcke und eine veraltete Chronik. Die Werkbank zeigt sie wie
  alle Befunde (ADR 0006: Maschinenarbeit gilt als angenommen, der Mensch
  markiert Widerspruch).
- **Der Skill wird kürzer:** Beleg ablegen, Transformation anstoßen, Mail je
  Sitzung (Owner-Entscheid 08.11.: bleibt je Chat und Vorhaben), Abhaken.
  Kopieren, Einsortieren, Sortieren entfallen.

## 3. Welle S1 — Sitzungs-Sicht und Bericht-Block

**Datenzugriff.** Neue Repo-Funktion in `src/lib/repositories/shadow-twin-repo.ts`:
`findeTransformationenNachVorlage(libraryId, template, language)` mit
`col.find({ libraryId, ['artifacts.transformation.' + template]: { $exists: true } })`
und Projektion auf `sourceId`, `sourceName`, `parentId`, `…frontmatter`,
`…updatedAt` (Vorbild für Aggregation/Projektion: `findKorrekturKandidaten`).
Nicht `getAllShadowTwins` — das lädt alle Artefakte.

**Datenmodell.** `SitzungsDatensatz` (neu, `src/lib/agent-view/sichten/sitzungen-types.ts`):
`datum`, `ende`, `titel`, `artWort` (aus dem Beleg-Dateinamen: `Code` | `Chat`),
`werkzeug`, `sitzungId`, `vorhabenPfad` (Ordner des Belegs, aufgelöst über
`parentId` gegen das Storage-Listing wie in `coverage-inputs.ts: locateFamilies`),
`belegName`, `teaser`, `transformationAktualisiert`. Belege unter
`Organisation/Sitzungen/Altbestand …` oder in Ordnern, die nicht dem
`agentView.vorhabenFolderPattern` entsprechen, gelten als „ohne Vorhaben".

**Renderer.** `sitzungen-render.ts` neben `aktuell-render.ts`/`projekte-render.ts`:
Frontmatter wie `sichtFrontmatter` (type `sicht`, `generated_by`, `generated_at`,
`anzahl_sitzungen`, `anzahl_vorhaben`), dann je Vorhaben
`## <Vorhabenpfad> (N)` und Zeilen
`- JJJJ-MM-TT · Code · [[JJJJ-MM-TT Code <Titel>]] — <Teaser>`; zuletzt
`## Ohne Vorhaben (N)`. Dateiname `SITZUNGEN.md` in `SICHTEN_ORDNER`
(`sichten/types.ts`). Schreiben über `ersetzeTextDatei` (ifVersion) bzw.
`uploadFile`, exakt wie `regenerate-sichten.ts: ueberschreiben`.

**Block je Bericht.** `erschliessung-block.ts: indexMitBlock` zu einem
generischen `ersetzeBlock(text, startMarker, endMarker, block)` verallgemeinern
(Fehlermeldung ohne fest verdrahtetes „_INDEX.md"; bestehende Aufrufer
unverändert, Test `tagesabschluss.test.ts` bleibt grün). Neuer Block in
`BERICHT.md`: Überschrift `### Sitzungen mit Claude (erzeugt)` und Marker
`<!-- sitzungen:start -->` / `<!-- sitzungen:end -->`, Zeilen wie in der Sicht,
nur für dieses Vorhaben. Fehlen die Marker, wird der Block am Ende angehängt.
**Altbestand:** Findet der Renderer einen handgeschriebenen Block
`### Sitzungen aus Claude Code (nachgetragen …)` oder
`### Sitzungen mit Claude (nachgetragen …)`, ersetzt er ihn NUR mit
`alteBloeckeUebernehmen: true` und nennt das in der Antwort; ohne den Schalter
Befund, kein stiller Umbau.

**Brücke.**
- `sichten_regenerieren` bekommt `sichten?: ('aktuell'|'projekte'|'sitzungen')[]`
  (Vorgabe: alle drei, damit bestehende Aufrufer gleich bleiben).
- Neues Werkzeug `sitzungen_block_schreiben` (analog
  `erschliessung_block_schreiben`: `libraryId`, `pfad`/`folderId` für einen
  Teilbaum, `nurVorschau`, `alteBloeckeUebernehmen`, `begruendung`; nur mit
  `archivpflege`, `mitProtokoll`).
- `tools-info.ts`: `TOOLSET_VERSION` erhöhen, `TOOL_NAMES`, `NEU_IN_VERSION`;
  `toolliste-drift.test.ts` und `archivpflege.test.ts` anpassen.

**Tests** (`tests/unit/agent-view/`): Renderer mit drei Vorhaben und einem
Beleg ohne Vorhaben; Sortierung; `ersetzeBlock` mit und ohne Marker, mit
altem Block ohne Schalter (Fehler/Befund) und mit Schalter; Repo-Abfrage
gegen ein Fixture-Dokument.

**Abnahme S1 (live, Archiv-Library):** `sichten_regenerieren` mit
`nurVorschau` zeigt alle Sitzungen des Altbestands in Archiv-Ordnung;
danach echter Lauf; `sitzungen_block_schreiben` für ein Vorhaben mit
`alteBloeckeUebernehmen: true` ersetzt den handgeschriebenen Block, der Rest
des Berichts ist byteidentisch (Diff vorher/nachher außerhalb der Marker leer).

## 4. Welle S2 — Sitzungs-Befunde im Abdeckungsscan

**Erwartete Vorlage je Beleg-Typ.** Heute prüft `twin-rules.ts:
checkTransformationState` gegen `config.secretaryService.template` (eine
Standardvorlage je Library). Belege tragen `type: chatverlauf` im Frontmatter
und erwarten `chatverlauf-de`. Neu: `agentView.belegVorlagen` in der
Library-Konfiguration (flach: `{ chatverlauf: 'chatverlauf-de' }`, Checkliste
[`library-config-field.md`](../../contracts/library-config-field.md)); die Regel
wählt die erwartete Vorlage nach dem Frontmatter-Typ der Quelle und fällt
NICHT still auf die Standardvorlage zurück (unbekannter Typ → Standardvorlage
mit Hinweis im Befund, bekannter Typ ohne Konfiguration → Fehler).

**Neue Befund-Typen** (`CoverageGapType` in `types.ts`, Pflichteinträge in
`gap-registry.ts: GAP_REGISTRY`, `auftrag-templates.ts: AUFTRAG_TEMPLATES`,
ggf. `labels.ts`; Regeln in neuer `sitzung-rules.ts`, eingehängt in
`coverage-service.ts: runCoverageScan` ins `gaps`-Array):

| Typ | Bedeutung | Akteur |
|---|---|---|
| `sitzung_ohne_transformation` | Beleg `type: chatverlauf` ohne Transformation der erwarteten Vorlage (ersetzt für Belege das generische `transformation_missing`) | Maschine: Transformation anstoßen |
| `sitzung_ohne_vorhaben` | Beleg liegt nicht in einem Vorhabensordner (z. B. `Organisation/Sitzungen/Altbestand …`) | Agent: Vorhaben bestimmen, `familie_umziehen` |
| `sitzung_doppelt` | zwei Belege mit gleicher `session_id` im Frontmatter (ohne `zuege_von_bis`-Teilung) | Agent: zusammenführen oder Teilung kennzeichnen |
| `sitzungen_block_veraltet` | gerenderter Block ≠ Block im `BERICHT.md` (Hash-Vergleich wie `sicht-regel.ts`) | Maschine: `sitzungen_block_schreiben` |
| `sitzungs_sicht_veraltet` | `SITZUNGEN.md` älter als die jüngste Transformation der Vorlage | Maschine: `sichten_regenerieren` |

Die Werkbank zeigt die Typen über die Registry von selbst (Akteur, Schwere,
Zyklusschritt). Bestehende Konsistenzprüfungen zwischen `_INDEX.md`,
Berichten und Dateisystem (`archive-rules.ts`, `inventory-gaps.ts`,
`source-gaps.ts`) bleiben; S2 ergänzt nur, was Sitzungen betrifft.

**Tests:** je Typ ein Fall in `tests/unit/agent-view/` (Vorbild
`twin-rules.test.ts`); Registry-Vollständigkeit ist ohnehin ein Typfehler.

**Abnahme S2 (live):** `abdeckung_scannen` über die Archiv-Library nennt die
drei Altbestands-Belege ohne Transformation (Stand 08.11.: Zeilen A2, A33,
A70 der Arbeitsliste) als `sitzung_ohne_transformation` und die Belege im
Ordner `Altbestand claude.ai` als `sitzung_ohne_vorhaben`; keine
`transformation_missing`-Fehlmeldungen mehr für Belege.

## 5. Welle S3 — Skill anpassen (Archiv, kein Repo-Code)

Nach S1 live: Im Skill `sitzung-abschliessen` (Original im Archiv,
Ableitungen in den Claude-Einstellungen) Abschnitt 3 „Sitzungsnotiz" und
Abschnitt 4 „Verweiszeile" durch einen Schritt ersetzen:
`sichten_regenerieren` (`sichten: ['sitzungen']`) und
`sitzungen_block_schreiben` für das Hauptvorhaben. Die Mail (Abschnitt 6)
bleibt je Sitzung; ihr Text ist die Transformation (`artefakt_lesen`). Was mit
den vorhandenen Notiz-Kopien in `Organisation/Sitzungen` geschieht
(behalten als Altbestand oder löschen, Papierkorb 93 Tage), entscheidet der
Owner nach dem ersten Lauf.

## 5b. Welle S4 (optional) — Sitzungsmail über die Brücke

Der Server verschickt heute schon Mails (Einladungen, Zugangsanfragen) über
`src/lib/services/mail-dispatch.ts` und `mailjet-service.ts`, mit Protokoll in
`mail-log-repo.ts`. Ein Brücken-Werkzeug `sitzung_mailen` (`libraryId`,
`sourceId`/`pfad`, `begruendung`; nur `archivpflege`) könnte die Transformation
einer Sitzung als Mail an die Owner-Adresse schicken, Betreff
`[<Vorhaben>] JJJJ-MM-TT Code|Chat · <Titel>`, Kopf-Tabelle mit den Pfaden wie
heute im Skill Abschnitt 6. Dann läuft der Mailtext nicht mehr durch das
Sprachmodell des Agenten. Owner-Entscheid 08.11.: eine Mail je Sitzung bleibt
gewollt. Voraussetzung: Mailjet-Absender für Archiv-Mails in der
Konfiguration; Mail-Log wie bei Einladungen.

## 6. Nicht-Ziele

- Kein Import von Cowork- oder Cloud-Sitzungen; das ist Sache des Skills.
- Keine Änderung an der Vorlage `chatverlauf-de` oder am Secretary (dort
  läuft getrennt der JSON-Fix).

## 7. Grenzen und Risiken

- Die Sicht liest alle Transformationen einer Vorlage; bei einigen hundert
  Dokumenten mit Projektion unkritisch, bei tausenden später paginieren.
- `vorhabenPfad` hängt am Storage-Listing (OneDrive: 20–40 s wie bei den
  anderen Sichten); der Scan nutzt dasselbe `scanArchive`.
- Handgeschriebene Blöcke im Altbestand dürfen nur mit Schalter ersetzt
  werden (no-silent-fallbacks); die Überschrift ändert sich von
  „nachgetragen" zu „erzeugt".

## 8. Hand-off (Vorlage für den Start)

- **Branch:** `claude/sitzungen-sichten-s1` (S1), danach `…-s2`.
- **Modell:** S1 Sonnet mit mittlerem Thinking (klare Vorbilder im Code);
  S2 Opus (Regeln, Registry, Konfigurationsfeld, Fehlerfälle).
- **Start-Prompt S1:** „Lies CLAUDE.md, AGENTS.md, docs/STAND.md und
  docs/plans/geplant/sitzungen-sichten-und-befunde.plan.md §1–3 und §7. Baue
  Welle S1 wie beschrieben; Vorbilder `regenerate-sichten.ts`,
  `erschliessung-block.ts`, `tools-sichten.ts`, `tools-aenderungen.ts`.
  Pflicht: `pnpm test`, `pnpm lint`, `npx tsc --noEmit -p tsconfig.json`
  (nur `src/`-Treffer prüfen, muss leer sein), `TOOLSET_VERSION` erhöhen.
  Eine PR, Hand-off-Block nach AGENTS.md §5."
- **Kosten:** S1 ~1 Cloud-Sitzung mittlerer Länge; S2 ähnlich plus
  Konfigurationsfeld-Checkliste.
