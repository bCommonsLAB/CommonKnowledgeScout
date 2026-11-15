---
name: sitzungen-befragbar
overview: "Fortsetzung von sitzungen-register (R1–R4): Sitzungen im Chatbot der eigenen Library befragbar machen. Je Sitzung zwei Eintraege im Index — der Wortlaut des Menschen (wörtlich, vom Code aus dem Beleg kopiert) und die Sitzungsnotiz. Dazu traegt authors bei Diktaten, eigenen Texten und Wortlauten den Namen des Owners, damit der Filter „nur ich\" ueber alle Textarten greift."
status: geplant
umsetzung_ab: null
todos:
  - id: r5a-wortlaut
    content: "R5a — Wortlaut-Bauer (Beleg zerlegen, Wortlaut rendern), Kontext-Vorlage, Folgeaufruf von sitzung_abschliessen: Notiz indexieren, Wortlaut schreiben und publizieren; Tests"
    status: pending
  - id: r5b-urheber
    content: "R5b — ohne Code: Diktate und eigene Texte schaetzen, Owner korrigiert, authors und Tag per dokument_felder_setzen nachtragen"
    status: pending
  - id: r5c-altbestand
    content: "R5c — Einmal-Lauf: fuer alle Belege mit Notiz den Wortlaut bauen und beide Eintraege publizieren; Bericht"
    status: pending
---

# Sitzungen befragbar: Wortlaut, Notiz und Urheber im Chatbot

**Grundlage:** Gespraech mit dem Owner am 15.11.2026; Plan
[`sitzungen-register`](sitzungen-register.plan.md) (R1–R4). Betroffen ist die
Library „Peters Archiv" (Steckbrief 1, privat). „Publizieren" heisst hier:
in den Index der eigenen Library, nicht oeffentlich.

## 1. Ziel

- „Was habe ich zu X gesagt?" liefert die eigenen Worte des Owners, egal ob
  aus einer Sitzung, einem Diktat oder einem selbst geschriebenen Text.
  Weg: Filter `authors` = Name des Owners.
- „Was wurde zu X entschieden oder gemacht?" liefert die Sitzungsnotiz.
- Claudes Antworten im vollen Wortlaut kommen nicht in den Index. Sie bleiben
  im Beleg; Wortlaut und Notiz verlinken ihn.

**Entschieden (Owner, 15.11.):** Wortlaut und Notiz in den Index, Claudes Text
nur im Beleg. Audioaufnahmen sind in der Regel vom Owner; ob Diktat oder
Aufnahme mit anderen, wird aus Transkript und Zusammenfassung geschaetzt, der
Owner korrigiert.

## 2. Befund (15.11.2026, lesend ueber die Bruecke, Stand `9e89cf39`)

- 719 Eintraege im Index; keiner ist eine Sitzung, eine Notiz oder ein BERICHT.md.
- Facetten: `date`, `authors`, `source`, `tags`. `authors` ist bei 675 leer,
  der Owner steht bei 32 (24 docx/pdf, 6 Mitschrift, 1 Audio). Rund 400
  Quellen sind Audio (`source` „Audioaufnahme" oder Dateiname .m4a/.mp3/.mp4).
- `source` nennt die Herkunft (Audioaufnahme, Mitschrift, Dateiname), nie die Person.
- `dokument_felder_setzen` ergaenzt Listenfelder an Twin, Meta-Dokument und
  Chunks (bis 30 Quellen je Aufruf). `authors` ist bei `book` optional, also setzbar.
- `dokument_publizieren` macht eine Markdown-Datei unveraendert zum Eintrag.
- `index_aktualisieren` nimmt `vorlage` und `nurPublizierte: false`. Damit
  lassen sich die Notizen (`chatverlauf-de`) ohne neuen Code indexieren.
- Je Quelle gibt es genau einen Eintrag (`<fileId>-meta`). Wortlaut und Notiz
  brauchen deshalb zwei Quellen: Die Notiz haengt am Beleg, der Wortlaut ist eine eigene Datei.

## 3. Zwei Eintraege je Sitzung

| | Wortlaut (neu) | Notiz (gibt es) |
|---|---|---|
| Quelle | eigene Datei `<Beleg-Name> – Wortlaut.md` neben dem Beleg | der Beleg, Transformation `chatverlauf-de` |
| Inhalt | je Zug: Kontext (ein Satz, maschinell, markiert), Owner woertlich, Hinweis auf Eingefuegtes (eine Zeile) | Entscheidungen, getan, Befunde, offen |
| entsteht durch | Code aus dem Beleg; nur der Kontext-Satz vom Modell | Modell (Vorlage) |
| in den Index | `dokument_publizieren` (unveraendert) | `index_aktualisieren` mit `vorlage` |
| `authors` | Owner | leer (Maschinentext) |
| `source` | `Sitzung` | `Sitzungsnotiz` |
| `werkzeug` | aus dem Beleg-Kopf | Feld der Notiz |

**Filter nach Werkzeug (E14):**
- Neue Facette `werkzeug` in der Library, optional dazu `vorhaben`. Dann
  filtert der Chat nach Code, Cowork und Chat. Die Liste in der Agentensicht
  kann das mit `quelle` schon (R1/R3).
- Die Notizen schreiben heute verschiedene Schreibweisen (`claude-code` und
  `code` …, siehe `WERKZEUG_ART` in `sitzungen-types.ts`). Vor dem Indexieren
  wird auf je einen Wert vereinheitlicht, sonst zeigt die Facette Dubletten.
- Die Facette vor R5c einrichten, dann entfaellt ein zweites Indexieren.
- Der Vektor-Suchindex wird nur beim ersten Anlegen gebaut
  (`ensureVectorSearchIndex`). Fuer das neue Filterfeld muss er einmal
  nachgezogen werden, sonst kann der Chat danach nicht filtern.

**Regeln fuer den Wortlaut**

- Die Worte des Owners werden aus dem Beleg kopiert, kein Modell fasst sie an.
  Test: Jede Zeile des Menschen im Beleg steht unveraendert im Wortlaut.
- Kopf (flach): `type: sitzung-wortlaut`, `sitzung`, `beleg` (Wikilink),
  `datum`, `vorhaben`, `authors`, `source`, `kontext: ja|fehlt`, `zuege_ausgelassen`.
- Sprecher-Marke des Menschen: aus dem Beleg-Kopf `mensch:` (neu im
  Export-Skript); fuer Alt-Belege Pflichtparameter des Werkzeugs. Weichen die
  beiden voneinander ab oder fehlen beide → Fehler, kein Raten.
- Eingefuegtes: Text zwischen Anfangs- und Endmarke wird zu einer Hinweiszeile.
  Alt-Belege haben keine Endmarke; dort gilt alles vom Marker bis zum Zugende
  als eingefuegt. Bekannte Grenze: Danach diktierter Text fehlt im Wortlaut,
  bleibt aber im Beleg.
- Kurze Bestaetigungen (E11) entfallen; ihre Zahl steht im Kopf.
- Register und Sichten erkennen den Wortlaut am Kopf `type`, nicht am Namen.
  Der Name passt sonst auf das Beleg-Muster (`belegNameLesen`) und erschiene
  als „Beleg ohne Notiz".
- Kontext-Satz (E10): eigene kleine Vorlage `sitzung-kontext-de`, ein Satz je
  Zug, hoechstens 25 Woerter, als flaches Listenfeld. `chatverlauf-de` bleibt
  unveraendert. Scheitert die Vorlage, wird der Wortlaut ohne Kontext gebaut,
  mit `kontext: fehlt` im Kopf; die Antwort des Werkzeugs sagt es.
- Der Wortlaut ist abgeleitet, nie von Hand gepflegt. Ein neuer Lauf
  ueberschreibt ihn.

## 4. Urheber an Diktaten und eigenen Texten (R5b, ohne Code)

1. Ein Agent listet alle Audio-Quellen sowie docx/pdf/Mitschrift ohne
   `authors`, je mit Titel und Zusammenfassung. Er schaetzt: Diktat |
   Aufnahme mit anderen (Besprechung, Vortrag, Workshop) | eigener Text |
   fremder Text, mit einer Zeile Begruendung. Die Liste liegt als Datei im
   Archiv, damit der Owner sie korrigieren kann.
2. Der Owner korrigiert die Liste.
3. Der Agent setzt per `dokument_felder_setzen` (Stapel zu 30, etwa 15 Aufrufe):
   - Diktat und eigener Text: `authors` + Owner.
   - Dazu den Tag `diktat` bzw. `aufnahme`. Damit trennt der Filter auch
     zwischen Diktat und Aufnahme.
   - Aufnahmen mit anderen bekommen den Owner nicht (E13).
4. Danach wird die Liste geloescht.

R5b haengt an keiner anderen Welle und kann vor R1 laufen.

**Neue Diktate (E12):** Die Audio-Vorlage der Library schaetzt Diktat oder
Aufnahme und setzt `authors` beim Diktat. Der Name kommt aus einer festen
Quelle, nicht aus einer Schaetzung des Modells.

## 5. Wellen

- **R5a (nach R4, Code):**
  - Modul `src/lib/agent-view/sitzungen-register/wortlaut/`: Beleg in Zuege
    zerlegen, Wortlaut rendern. Reine Funktionen mit Tests, darunter der
    Byte-Test aus §3.
  - Vorlage `sitzung-kontext-de`.
  - Folgeaufruf von `sitzung_abschliessen` (R4, W5) ergaenzen: Notiz
    indexieren, Kontext holen, Wortlaut schreiben, `dokument_publizieren`.
  - `TOOLSET_VERSION` anheben.
- **R5b (ohne Code):** §4.
- **R5c (Einmal-Lauf):** Fuer alle Belege mit Notiz den Wortlaut bauen und
  beide Eintraege publizieren. Stapelweise, mit Bericht ueber gescheiterte
  Kontexte und Belege ohne Sprecher-Marke.
- **Skill `sitzung-abschliessen` (ausserhalb des Repos):** Das Export-Skript
  bekommt eine Endmarke fuer Eingefuegtes und den Kopf `mensch:`. Beim
  claude.ai-Export kommt zum Anhang-Namen eine Kurzbeschreibung.
- **Vorrat:**
  - Sprecher je Textstueck (Chunk-Merkmal), damit Aufnahmen mit anderen nur
    die Worte des Owners liefern. Neuere Transkripte kennen die Sprecher.
  - Projektberichte (BERICHT.md) in den Index; sie aendern sich oft und
    muessten nach jeder Aenderung neu indexiert werden.

## 6. Abnahme

- Mit Filter `authors` = Owner und der Frage „Was habe ich zu <Thema>
  gesagt?" kommen Zitate nur aus Wortlauten, Diktaten und eigenen Texten.
  Kein Satz von Claude, kein eingefuegter Text.
- Ohne Filter und mit der Frage „Was wurde zu <Thema> entschieden?" wird die
  Notiz zitiert, mit Link zum Beleg.
- Der Byte-Test aus §3 ist gruen fuer einen Code- und einen Chat-Beleg.
- Der Wortlaut erscheint im Register nicht als „Beleg ohne Notiz".

## 7. Entscheide beim Owner

- **E9** Ort des Wortlauts: neben dem Beleg (Vorschlag) oder in einem Sammelordner.
- **E10** Kontext-Satz: eigene Vorlage `sitzung-kontext-de` (Vorschlag) oder ein neues Feld in `chatverlauf-de`.
- **E11** Kurze Bestaetigungen weglassen (Vorschlag: unter 5 Woertern) oder alles aufnehmen.
- **E12** Name des Owners: Library-Einstellung (Vorschlag, eine Quelle fuer
  Vorlage und Wortlaut; Checkliste `library-config-field`) oder fest in
  Vorlage und Skill.
- **E13** Aufnahmen mit anderen ohne den Owner in `authors` (Vorschlag), bis es Sprecher je Textstueck gibt.
- **E14** Facette `werkzeug` (Vorschlag) und `vorhaben` (optional) im Chatbot, vor R5c eingerichtet.

**Hand-off:**
- R5a: Opus mittel. Zerlegen der Zuege, Grenzfaelle bei Eingefuegtem.
- R5b: jeder Agent mit Bruecke, Sonnet. Die Arbeit liegt beim Owner (Korrektur).
- R5c: Sonnet.
- Pflicht wie R1: `pnpm test` vollstaendig, `pnpm lint`, `tsc` gegen den
  Stand vorher, `bash scripts/welle-pre-merge-check.sh` beim Owner.
