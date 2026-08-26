# Projektauftrag: Werkbank-Abnahme (Wellen A1–A6)

**Stand 24.08.2026** · Nachfolge-Auftrag zu
[`projektauftrag-agentensicht-v2-werkbank.md`](projektauftrag-agentensicht-v2-werkbank.md)
(Wellen W1–W8, abgeschlossen).

Grundlage sind ein Live-Test des ganzen Wellenplans W1–W8 am 24.08.2026 und
die Entscheidungen, die Peter im Anschluss getroffen hat.

---

## Verbindliche Vorlage: das Mockup

**Mockup-Treue ist Abnahmekriterium jeder Welle dieses Auftrags.**

[`docs/concepts/mockups/agentensicht-abnahme.html`](mockups/agentensicht-abnahme.html)
— Stand 7, drei Zustände (A Vorhaben gewählt · B Artefakt gewählt · C
Einstieg). Was dort steht, ist die Vorgabe: Anordnung, Reihenfolge der
Elemente, Beschriftungen, Zustände. Wer davon abweichen will, meldet das
VOR der Umsetzung — Abweichungen ohne Rückfrage sind ein Stop-Grund.

Das ältere [`agentensicht-werkbank.html`](mockups/agentensicht-werkbank.html)
bleibt gültig für alles, was dieser Auftrag nicht anfasst.

## Die eine Leitidee

**Eine Bildschirmgliederung, zwei Inhalte.** Links wählt man aus, rechts
begutachtet und nimmt man ab. Rechts steht IMMER genau ein Dokument —
niemals ein Stapel aus Blöcken, die man zuklappen muss. Der Kopf ist in
jedem Fall gleich gebaut und nimmt ab, was rechts steht.

## Entschieden am 24.08.2026 (nicht neu verhandeln)

| # | Entscheidung |
|---|---|
| 1 | **Baumtiefe:** Bereich → Vorhaben → Ordner → Artefakt. Alle vier Ebenen. Das Archiv wird darauf umstrukturiert; **das Vorhaben IST das Thema** und wird von Hand vergeben. |
| 2 | **Zählerform:** `0/28` je Ebene. |
| 3 | **Sammelaktion:** getrennt nach Transkripten und Zusammenfassungen, je mit Rückfrage. |
| 4 | **Original:** erster Tab neben Transkript und Zusammenfassung, ohne eigenes Häkchen. |
| 5 | **Nach dem Verifizieren:** automatisch zum nächsten offenen Artefakt springen. |
| 6 | **Vorhaben abnehmen:** jederzeit möglich. Früher abzunehmen bleibt Peters Entscheidung — der Knopf sperrt nie wegen offener Menschen-Punkte. |

---

## Ausgangslage

Auf `master` liegen W1–W8. Auf dem Branch
`claude/mcp-merge-und-stand-werkzeug` liegen fünf Commits, die aus dem
Live-Test entstanden sind und **vor** diesem Auftrag gemergt gehören:

- MCP-Brücke: Teilbaum-Scan merged (`scan-speichern.ts`), neues Werkzeug
  `stand_setzen` (`stand-ausfuehren.ts`), Werkzeugsatz 2.3.0
- `stand_widerspruch`: der Zyklus-Schritt entscheidet
- `istAbnehmbar` als eigenes Prädikat (Knopf entsperrt, Entscheidung 6)
- Scroll-Fehler im Detail behoben, Bericht zuklappbar
- Befund-Texte in Alltagssprache, Beleg (`detail`) sichtbar
- Skill `archiv-aufraeumen` versioniert

---

## Welle A1 — Kopf entlasten, Leerzustand füllen

**Mockup: Zustand C.** Diese Welle holt nach, was Mockup Stand 3
(23.08.2026) bereits vorsah und was nie gebaut wurde.

- Der Seitenkopf schrumpft auf **eine Zeile**: Scan-Zeitpunkt ·
  „berechnet, nicht Wahrheit" · Fortschritt seit dem letzten Scan.
- Die acht Kennzahlen, die Akteur-Chips und die Zyklus-Zeile
  verschwinden von dort.
- Der Leerzustand rechts trägt vier Karten. Die **erste und betonte**
  nennt, wie viele Vorhaben jetzt auf den Menschen warten — nicht die
  Bestandszahlen. Diese folgen darunter als Nebenzeile.
- Die Konventionen-Zeile (Standard-Template, Vorhaben-Muster,
  `_INDEX`-Pflicht, Bericht-Frische) wandert in ein Aufklapp-Element
  oder ins Menü; sie ist Nachschlagewerk, kein Dauerinhalt.

**Fertig, wenn** der Bildschirm über der Arbeitsfläche höchstens zwei
Zeilen trägt und der Leerzustand die Frage „was muss ich tun?" ohne
Klick beantwortet.

## Welle A2 — Baum-Navigation bis zum Artefakt

**Mockup: linke Spalte in allen drei Zuständen.**

- Vier Ebenen: Bereich → Vorhaben → Ordner → Artefakt (Entscheidung 1).
- Jede Ebene mit Aufklapp-Pfeil und Zähler `n/m` (Entscheidung 2).
- Jedes Artefakt mit Prüf-Kennung: `✓` geprüft, `○` offen.
- Virtualisierung bleibt Pflicht — die Liste trägt heute 148 Vorhaben
  und mit Artefakten ein Vielfaches.
- Die bestehenden Filter (Alle · Zu tun · Bereit · Liste, Akteur- und
  Schritt-Chips, Suche) wirken weiter und blenden Äste aus, in denen
  nichts übrig bleibt.
- Die Auswahl steht in der URL, wie bisher — jetzt zusätzlich mit dem
  gewählten Artefakt.

**Offene Frage an Peter vor dem Bau:** Sollen die Filter leere Äste ganz
ausblenden oder ausgegraut stehen lassen?

## Welle A3 — Detail als Dokument-Ansicht

**Mockup: Zustände A und B, rechte Spalte.**

- Rechts steht immer **genau ein Dokument**. Die heutigen Abschnitte
  (Bericht · Befunde · Twin-Familien) als gestapelte Blöcke entfallen.
- Bei gewähltem **Vorhaben**: Tabs `Bericht` · `Ordner-Beschreibung`.
- Bei gewähltem **Artefakt**: Tabs `Original` · `Transkript` ·
  `Zusammenfassung` (Entscheidung 4). Transkript und Zusammenfassung
  tragen je ein eigenes Häkchen im Tab, das Original keines.
- `Original` zeigt je nach Art einen Abspieler (Audio), eine Vorschau
  (PDF, Word) oder den Rohtext.
- Die Befunde des Vorhabens verschwinden nicht, sondern werden zur
  **Kennzeichnung am Baum** und zum Inhalt des Kopfes (siehe A4).

## Welle A4 — Einheitlicher Abnahme-Kopf

**Mockup: `.dhead` in Zustand A und B — identisch aufgebaut.**

- Zeile 1: Titel · Zustands-Chip · **ein** primärer Knopf · Menü `⋯`.
  Der Knopf heißt „Vorhaben abnehmen" bzw. „Verifizieren", je nachdem,
  was rechts steht.
- Zeile 2: Breadcrumb · Fortschritt (`0 von 28 geprüft`) ·
  Sammelaktionen bzw. Sprung-Hinweis.
- Das Menü `⋯` trägt alles Seltene: Stand-Menü, Teilbaum neu scannen,
  zu einer Liste hinzufügen, im Archiv öffnen, folderId kopieren.
- Der Abnehmen-Knopf folgt Entscheidung 6 — er sperrt nur bei offenen
  **maschinellen** Befunden (`istAbnehmbar`, liegt bereits vor).

## Welle A5 — Verifizieren im Fluss

- Sammelaktionen auf Vorhaben-Ebene, **getrennt** nach Transkripten und
  Zusammenfassungen, je mit einer Rückfrage, die die Zahl nennt
  (Entscheidung 3).
- Nach jeder Verifikation springt die Auswahl zum nächsten offenen
  Artefakt, der Baum zieht mit (Entscheidung 5).
- Am Ende eines Ordners: Hinweis, dass er fertig ist, und Sprung zum
  nächsten Ordner mit offenen Punkten.
- Fehler beim Schreiben erscheinen als Klartext an der Zeile, nie still.

**Achtung:** Verifikation bleibt eine bewusste menschliche Aussage. Die
Rückfrage der Sammelaktion ist kein Formalismus, sondern die Stelle, an
der Peter bestätigt, dass er die Gruppe wirklich gesehen hat.

## Welle A6 — Thema als eigenes Feld

- Die Gruppierung „Thema" stützt sich heute auf `themen` aus dem
  BERICHT.md-Frontmatter. Das Feld enthält technische Bausteine eines
  Projekts und erzeugt fast nur Ein-Element-Gruppen (Stand 24.08.: 10
  von 148 Vorhaben, 59 verschiedene Themen, 138 × „Ohne Thema").
- Peter vergibt Themen selbst; **das Vorhaben ist das Thema**
  (Entscheidung 1).
- Diese Welle klärt zuerst mit Peter, **wo** das gepflegte Thema wohnt,
  und baut die Gruppierung darauf um. Bis dahin bleibt der Umschalter
  „Thema" als irreführend markiert oder verschwindet.

**Diese Welle beginnt mit einer Rückfrage, nicht mit Code.**

---

## Reihenfolge und Abhängigkeiten

A1 ist unabhängig und kann zuerst laufen. A2 → A3 → A4 bauen
aufeinander auf und ergeben zusammen die neue Werkbank; A5 setzt A2–A4
voraus. A6 hängt an einer Entscheidung von Peter und kann jederzeit
danach laufen.

## Was aus dem Live-Test offen blieb

- **Concurrency 8 wirkt nicht.** Der Voll-Scan dauert unverändert ~8
  Minuten (479 s für 1100 Ordner). Vermutlich drosselt der
  OneDrive-Provider selbst. Eigene Untersuchung wert, gehört aber nicht
  in diesen Auftrag.
- **Der Baum-Tab ist veraltet:** Er zeigt Ordner, nicht Vorhaben, und
  kennt die Werkbank-Felder nicht. Nach A2 überschneidet er sich mit der
  Werkbank — dann entscheiden, ob er bleibt.
- **Der Kollaps-Fix aus W8** ließ sich nicht belegen: Peters Archiv hat
  aktuell keinen ungesichteten Ordner.

## Regeln für die Umsetzung

Es gelten `AGENTS.md`, `CLAUDE.md` und die `alwaysApply`-Regeln
unverändert. Besonders:

- Dateien max. 200 Zeilen. Das Werkbank-Panel liegt bei 183, das Detail
  bei 195 — beide reißen bei Erweiterung sofort die Grenze.
- Kein stiller Fallback: Jeder leere Zustand nennt seinen Grund.
- Geteilte Prädikate statt Kopien (`istAbnehmbar`, `istBereitZurAbnahme`,
  `matchtBefundFilter`) — MCP-Brücke und UI dürfen nicht auseinanderlaufen.
- Pro Welle EINE PR mit Hand-off-Block.
