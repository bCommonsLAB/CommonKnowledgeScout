---
name: sitzungen-register
overview: "Fortsetzung von sitzungen-sichten-und-befunde: ein Register aller Arbeitssitzungen mit Claude als MongoDB-Kollektion je Library (Soll), der Stand jeder Zeile aus Belegen und Transformationen gerechnet (Ist), ein Reiter „Sitzungen\" in der Agentensicht und ein Brueckenaufruf sitzung_abschliessen. Loest die handgepflegte Arbeitsliste im Archiv ab."
status: geplant
umsetzung_ab: null
todos:
  - id: r1-register
    content: "R1 — Kollektion agent_view_sitzungen__<libraryId>, Repo, gerechneter Stand, Werkzeuge sitzungen_melden, sitzungen_auflisten, sitzung_setzen; Sichten-Laeufe schreiben Ablage-Cache und berichtet-Stempel; Tests"
    status: completed
  - id: r2-import
    content: "R2 — Einmal-Werkzeug sitzungen_importieren (nurVorschau als Vorgabe): Arbeitsliste auf dem Server parsen, Kennungen zuordnen, Abweichungsbericht"
    status: pending
  - id: r3-reiter
    content: "R3 — Reiter Sitzungen nach Figma-Konzept (Muster Werkbank: Liste gruppiert links, Details rechts), unabhaengig vom Coverage-Report, Route GET/PATCH"
    status: pending
  - id: r4-abschliessen
    content: "R4 — sitzung_abschliessen: Beleg als Text oder als Verweis auf eine abgelegte Datei, Transformation starten, Zeile eintragen; Folgeschritt nach Job-Ende"
    status: pending
---

# Sitzungen: Register statt Arbeitsliste

**Grundlage:** Handover im Archiv (15.11.2026, „Sitzungsregister in der
Agentensicht"); Plan [`sitzungen-sichten-und-befunde`](sitzungen-sichten-und-befunde.plan.md)
(S1 gebaut, Bruecke 2.67.0/2.68.1). Dieser Plan nimmt das Zielbild des
Handovers auf und korrigiert es dort, wo der Code etwas anderes sagt (§1).

**Kern:** Das Register ist das Soll (welche Sitzungen gab es). Das Ist sind
Beleg (Datei beim Vorhaben) und Notiz (Transformation `chatverlauf-de` am
Twin). Der Stand einer Zeile wird gerechnet, nie abgehakt.

## 1. Pruefung gegen den Code (15.11.2026, Stand `9e89cf39`)

| # | Handover sagt | Code/Daten sagen | Folge fuer den Plan |
|---|---|---|---|
| W1 | `sitzungId` ist der eindeutige Schluessel | Die 102 offenen Cowork-Zeilen und 3 „Unbenannt"-Chats der Liste tragen **keine** Kennung; das Export-Kuerzel an B/C-Zeilen ist ein 8-Zeichen-Praefix, nicht die UUID | Eigener Schluessel `registerId`; `sitzungId` optional, `kennung: voll \| praefix \| keine`; Altzeilen ohne Kennung heissen `alt:<Nr>` und werden beim Abschluss sichtbar umgeschluesselt |
| W2 | Stand `beleg` = Beleg mit `session_id` liegt im Archiv | S1 liest nur Twins **mit** Transformation (`findeTransformationenNachVorlage`). Ein Beleg ohne Notiz (u. a. die 12 LLM-JSON-Fehlschlaege vom 05.11.) hat in MongoDB keine Spur | `beleg` ohne Notiz ist nur sichtbar, wenn die Zeile die `sourceId` kennt (R2, R4) oder der Scan den Beleg findet (S2). Ohne S2 gilt die Regel „Beleg am Register vorbei erscheint" nur fuer transformierte Belege |
| W3 | Beim **Laden** bekommt jeder Beleg ohne Zeile eine (`gemeldetVon: archiv`) | `sitzungen_auflisten` waere dann ein Lesewerkzeug, das schreibt | Lesen zeigt solche Belege als Zeile, speichert aber nicht. Gespeichert wird von den schreibenden Sichten-Laeufen (`sichten_regenerieren`, `sitzungen_block_schreiben`), die alle Belege ohnehin sehen |
| W4 | `berichtet` = Sitzung steht im Block und in `SITZUNGEN.md` | Pruefen hiesse jeden `BERICHT.md` aus dem Speicher lesen | Die beiden Sichten-Laeufe vermerken je Zeile `berichtetAm` (Cache mit Zeitstempel). `berichtet` = Notiz da und `berichtetAm` ≥ Notiz aktualisiert |
| W5 | „Nach dem Job: Chronik und Block neu erzeugen" | Weder Bruecke noch Job-Pipeline haben einen Haken nach Job-Ende; einer in `external-jobs` waere eine Pipeline-Aenderung (ADR 0001) | `sitzung_abschliessen` liefert Job-Id und den Folgeaufruf; der Skill ruft ihn nach `job_status: completed` |
| W6 | Beleg als Text im Aufruf oder als Verweis | Der Befund vom 05.11. zeigt: Engpass ist das Modell, das 136 kB als Werkzeug-Argument ausgeben muss (Abbruch bei 20 kB, ESC-Zeichen fehlen) | Hauptweg ist der Verweis (`pfad`/`sourceId`) auf die ueber den OneDrive-Ordner abgelegte Datei; Text nur fuer kleine Belege. Datei noch nicht synchronisiert → benannter Fehler, kein Warten |
| W7 | Reiter zeigt Vorhaben je Zeile | Die Zuordnung rechnet S1 mit einem Speicher-Scan (OneDrive 20–40 s) | Die Sichten-Laeufe schreiben die Ablage (Vorhabenpfad, Ordner) an die Zeile; der Reiter liest nur MongoDB. Zeilen ohne Ablage-Cache zeigen „Vorhaben noch nicht bestimmt" |
| W8 | Neuer Reiter in der Agentensicht | `agent-view-panel.tsx` rendert die Reiter nur, wenn ein Coverage-Report existiert | Reiterleiste vom Report loesen; nur die Report-Reiter brauchen den Report |
| W9 | Kennung `session_id` | Beleg traegt `session_id`, die Notiz `sitzung`; S1 nimmt `sitzung` | Register nimmt `session_id` aus dem Beleg-Kopf (Merker `sourceFrontmatter`), `sitzung` nur ersatzweise; Abweichung = Hinweis |
| W10 | Import der 471 Zeilen | Abtippen durch ein Sprachmodell waere die Fehlerquelle, die der Plan beseitigen soll | Eigenes Einmal-Werkzeug, das die Datei auf dem Server parst (R2) |

## 2. Datenmodell `agent_view_sitzungen__<libraryId>`

Ein Dokument je Sitzung, Muster [`mongodb-repository-pattern.md`](../../architecture/mongodb-repository-pattern.md),
Vorbild `agent-view-worklists-repo.ts` (benannte Domaenenfehler), aber NICHT
je User (E1).

- **Kopf:** `registerId` (unique), `sitzungId` (sparse unique), `kennung`,
  `quelle` (`code_lokal` | `code_cloud` | `cowork` | `chat`), `titelOriginal`,
  `beginn`, `ende`, `link`, `repo`, `branch`, `prs[]`, `nrAlt`.
- **Pflege von Hand:** `entscheidung` (`offen` | `ueberspringen` | `trennen`),
  `entscheidungGrund`, `zugbereiche[]`, `vorhabenVorschlag` `{ ordner, herkunft }`,
  `bemerkung`.
- **Bekanntes Ist:** `belegSourceIds[]` (aus R2/R4), `altNotizPfad` (Notiz-Kopie
  ohne Beleg, aus R2).
- **Cache der Sichten-Laeufe:** `ablage` `{ vorhabenPfad, vorhabenFolderId,
  belegOrdnerPfad, geprueftAm }`, `berichtet` `{ chronikAm, blockAm }` (gebaut
  statt eines `berichtetAm`: Chronik und Block schreiben verschiedene Laeufe).
- **Herkunft:** `gemeldetVon` (`skill` | `inventar` | `import` | `archiv`),
  `gemeldetAm`, `geaendertAm`.

**Gerechneter Stand** (reine Funktion, eigene Datei):
`uebersprungen` > `berichtet` > `notiz` > `beleg` > `gemeldet`. Widersprueche
werden Hinweise an der Zeile, nie still aufgeloest: uebersprungen, aber Beleg
da; zwei Belege derselben Kennung ohne Zugbereiche (`doppelt`); Notiz-Kopie
ohne Beleg; Praefix passt auf mehr als eine Kennung.

**Gebaut (R1, 15.11.), genauer als oben:**
- `berichtet` = Notiz da, `chronikAm` ≥ juengste Notiz, im Vorhaben auch `blockAm`.
- `doppelt` = zwei Belege, deren `zuege_von_bis` fehlen oder sich ueberschneiden.
- Schluessel: Kennung, `alt:<Nr>` oder `beleg:<sourceId>`; unter 20 Zeichen gilt eine Kennung als Praefix.
- `quelle` bei Archiv-Zeilen aus `werkzeug`, Cloud an `session_…` (unbekannt → `null` + Hinweis).
- Kennung nachtragen fuehrt eine reine Archiv-Zeile hinein; sonst Fehler.

## 3. Welle R1 — Register und Werkzeuge

- `src/lib/repositories/agent-view-sitzungen-repo.ts`: Upsert je `registerId`,
  Umschluesseln `alt:<Nr>` → `sitzungId` (benannter Fehler, wenn die Kennung
  schon eine andere Zeile hat), Liste mit Filter und Cursor.
- `src/lib/agent-view/sitzungen-register/`: Typen, `stand-rechnen.ts`,
  `ist-laden.ts` (Twins der Vorlage + Merker; `belegSourceIds` ohne Twin per
  `getItemById` pruefen — nur diese wenigen Zeilen).
- Bruecke (`tools-sitzungen-register.ts`, nur `archivpflege`, schreibende mit
  `begruendung` + `mitProtokoll`):
  - `sitzungen_melden` — Stapel, idempotent; `entscheidung` und `bemerkung`
    ueberschreibt nur `sitzung_setzen`. Antwort: angelegt, ergaenzt,
    unveraendert, Fehler je Zeile.
  - `sitzungen_auflisten` — liest nur; Filter Stand, Quelle, Vorhaben,
    Zeitraum, `auffaellig` (`notiz_ohne_beleg` | `gemeldet_ohne_beleg` mit
    `seitTagen` | `beleg_ohne_vorhaben` | `doppelt`); `zusammenfassung: true`
    = Bilanz je Stand und Quelle.
  - `sitzung_setzen` — Entscheidung, Grund, Zugbereiche, Vorschlag, Bemerkung,
    Kennung nachtragen.
- `sichten_regenerieren` (Sicht `sitzungen`) und `sitzungen_block_schreiben`
  legen fehlende Zeilen an (`gemeldetVon: archiv`) und schreiben `ablage` und
  `berichtetAm` (W3, W4, W7). Eine Regel fuer Zuordnung: die von S1.
- `tools-info.ts`: `TOOLSET_VERSION` 2.71.0, `TOOL_NAMES`, `NEU_IN_VERSION`;
  `toolliste-drift.test.ts`, `archivpflege.test.ts`.
- Tests (`tests/unit/agent-view/sitzungen-register/`): Stand je Fall und je
  Widerspruch, Upsert idempotent, Umschluesseln, Filter, Bilanz.

## 4. Welle R2 — Import der Arbeitsliste

Werkzeug `sitzungen_importieren` (`pfad` der Liste, `nurVorschau` Vorgabe
`true`, nach E2 wieder entfernbar). Parser fuer die Tabellenzeilen
`| [ ] | A1 | … |`; „Erl." wird nur als Erwartung gefuehrt.

| Teil | Kennung | Weg |
|---|---|---|
| A (Code lokal) | voll | Wikilink der Notiz → Beleg gleichen Datums und Titels (Twin in MongoDB) → `session_id` |
| B/C abgeschlossen | Praefix → voll | Export-Kuerzel gegen `session_id` der Belege; eindeutig oder Hinweis |
| B offen, C „Unbenannt" | keine | `alt:<Nr>`; „Notiz vorhanden: [[…]]" → `altNotizPfad` |
| D (Code Cloud) | voll | `session_…` aus dem Link |

`ueberspringen: <Grund>` → `entscheidung`. Bericht: Zeilen „erledigt" ohne
Beleg, Belege ohne Zeile, mehrdeutige Praefixe, Zahlen gegen den Nachtrag vom
15.11. (266 abgehakt, darin 31 uebersprungen, 205 offen).

## 5. Welle R3 — Reiter „Sitzungen"

Konzept (Owner 15.11., Muster Werkbank): https://www.figma.com/design/4HmJYdP2R9IrUaTYyovhjo
mit den Frames „1 · Offen", „2 · Sitzung gewaehlt", „3 · Auffaellig" und „4 · Regeln".
Mockup-Treue ist Abnahmekriterium. Live am 15.11.: 241 Zeilen, davon 221
`notiz`. Eine flache Tabelle waere endlos, darum wird gruppiert.

- **Daten:** `GET /api/library/[libraryId]/agent-view/sitzungen` (Zeilen und
  Bilanz ueber `ladeRegisterSicht`, `filtereSitzungen`, `bilanz`), `PATCH
  …/sitzungen/[registerId]` (Felder von `sitzung_setzen`); Zugriff wie
  `worklists-zugriff.ts`. Liest nur MongoDB. `SitzungsSicht` bekommt
  `berichtet` (chronikAm, blockAm), damit „halb berichtet" sichtbar ist.
- **Reiter:** `TAB_WERTE` um `sitzungen`; die Reiterleiste haengt nicht mehr am Report (W8).
- **Liste links:**
  - Umschalter `Offen | Auffaellig | Alle` mit Zahlen; Offen = weder `berichtet` noch `uebersprungen`.
  - Gruppen: Bereich → Vorhaben (zugeklappt, mit Zahlen; je Gruppe 5 Zeilen, dann „N weitere") oder Werkzeug; in „Auffaellig" je Hinweis-Code eine Gruppe, leere Gruppen blass mit 0.
  - Suche ueber Titel, Kennung und Branch; Chips Code, Cowork, Chat, Zeitraum; Zustand in der Adresse (nuqs).
- **Zeile:** Datum, Werkzeug, Titel (einzeilig, gekuerzt), Zeichen B, N, R (gruen = da). Die gewaehlte Zeile ist orange hinterlegt.
- **Rechts:**
  - Ohne Auswahl: Kennzahlen; „Notiz da, Bericht fehlt" ist hervorgehoben.
  - Mit Auswahl: Pfad, Titel, Kennzeichen; der Stand als Schritte Gemeldet → Beleg → Notiz → Im Bericht; ein Kasten „warum" aus Hinweisen und Stempeln; Belege mit Zuegen; Kennung; Bemerkung.
- **Aktionen:** Ueberspringen (mit Grund), Vorhaben vorschlagen (verschiebt
  nichts), In Teile trennen, Beleg oeffnen. Eine Knopfzeile, die nie umbricht
  (Symbol + Tooltip). Sprung `?tab=werkbank&vorhaben=<folderId>`.
- **Vorher klaeren:** wie Code in der Cloud und Cowork erkannt werden (15.11.:
  0 Cloud, 1 Cowork); sonst laufen die Chips ins Leere. Contracts: `contracts-ui`.

## 6. Welle R4 — `sitzung_abschliessen`

Eingabe: `sitzungId`, `quelle`, Hauptvorhaben (`pfad`/`folderId`), Beleg als
`{ text }` oder `{ pfad }`/`{ sourceId }`, optional `nrAlt`, Nebenvorhaben,
Zugbereich, `begruendung`.

1. Beleg pruefen: Kopf `type: chatverlauf`, `session_id` = `sitzungId`, liegt
   im Hauptvorhaben. Bei `text`: anlegen; gleiche Kennung → ersetzen, andere →
   Fehler. Antwort nennt Bytes und SHA-256 (Byte-Vergleich beim Aufrufer).
2. Transformation `chatverlauf-de` starten (Weg von `transformation_starten`,
   bei Ersatz `erzwingen`).
3. Zeile anlegen oder ergaenzen, `alt:<nrAlt>` umschluesseln.
4. Antwort: Job-Id, Belegpfad, Stand, Folgeaufruf fuer nach dem Job (W5).

Abnahme mit einem Beleg ueber 300 kB ueber den Dateiverweis.

Fortsetzung: Wortlaut und Notiz im Chatbot, Urheber an Diktaten — Plan
[`sitzungen-befragbar`](sitzungen-befragbar.plan.md) (R5a–R5c). R5a haengt am
Folgeaufruf aus Schritt 4.

## 7. Abnahme (gesamt)

- Nach R2 nennt `sitzungen_auflisten` (`zusammenfassung`) die Zahlen des
  Nachtrags vom 15.11.; jede Abweichung steht im Importbericht.
- Eine Zeile wechselt von `gemeldet` auf `notiz`, sobald die Transformation
  fertig ist, ohne Schreibzugriff auf das Register.
- Ein am Register vorbei abgelegter und transformierter Beleg erscheint in
  `sitzungen_auflisten` und nach dem naechsten Sichten-Lauf als gespeicherte Zeile.
- Der Reiter zeigt neu gemeldete Chats als `gemeldet` und nach Abschluss und
  Sichten-Lauf als `berichtet`.

## 8. Entscheide beim Owner

- **E1** Register je Library fuer alle Berechtigten (Vorschlag) oder privat je User. *Gebaut nach Vorschlag (R1).*
- **E2** Arbeitsliste nach dem Import loeschen (Vorschlag) oder als Sicht weiterfuehren.
- **E3** Notiz-Kopien in `Organisation/Sitzungen` behalten oder loeschen (offen seit 08.11.).
- **E4** Nicht abgeschlossene Cowork-Chats nur beim Abschluss melden oder zusaetzlich taeglich.
- **E5** Zeilen ohne Kennung als `alt:<Nr>` fuehren und beim Abschluss umschluesseln (Vorschlag). *Gebaut nach Vorschlag (R1).*
- **E6** Import als eigenes Einmal-Werkzeug auf dem Server (Vorschlag) statt Abtippen durch einen Agenten.
- **E7** Folgeschritt nach dem Job ruft der Skill (Vorschlag) oder das Werkzeug wartet bis zu 60 s.
- **E8** Grosse Belege nur ueber den Dateiverweis (Vorschlag) oder zusaetzlich eine Upload-Route mit
  Konto-Schluessel (umgeht das Modell, aber der Schluessel kennt keine Scopes, ADR 0008 Nachtrag).
  Offen dabei: Cloud-Sitzungen haben keinen OneDrive-Ordner.

## 9. Stand und Hand-off

- **R1:** gemergt und live abgenommen (#439, Fix #440, Bruecke 2.71.1; 15.11.: 241 Zeilen).
- **Modell:** R2 Sonnet mittel; R3 Sonnet mittel (mit Figma-Konzept); R4 Opus (Speicher, Jobs, Fehlerfaelle).
- **Pflicht:** `pnpm test` vollstaendig, `pnpm lint`, `tsc` gegen den Stand vorher, `bash scripts/welle-pre-merge-check.sh` beim Owner.
