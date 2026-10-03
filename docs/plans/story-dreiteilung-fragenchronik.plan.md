---
name: story-dreiteilung-fragenchronik
overview: "Story-Modus von der Zweiteilung (Chatverlauf | Quellen) auf eine Dreiteilung umbauen: links eine Chronik der gestellten Fragen mit Kurztiteln (15 %), Mitte die gewählte Frage mit Antwort (50 %), rechts das Quellenverzeichnis (35 %). Erster Eintrag der Chronik ist immer die Themenübersicht. Mobil wandert die Chronik in ein Menü. Owner-Wunsch 01.10.2026 nach Live-Test; zuerst Layout-Konzept und Klickmodell (Figma), dann Wellen."
vorhaben: [24.09 KnowledgeScout]
status: konzept
todos:
  - id: d0-klickmodell
    content: "[Drahtgitter angelegt 01.10.2026, Abnahme offen] Layout-Konzept und Klickmodell in Figma: drei Bildschirme Desktop (Start mit Themenübersicht, Frage gewählt, Frage läuft), zwei Bildschirme Mobil (Chronik-Menü zu und auf). Verhältnis 15/50/35 als Startwert, Owner-Abnahme vor Welle D1."
    status: pending
  - id: d1-chronik-lesend
    content: "[Gebaut 01.10.2026 in PR zu Branch claude/zealous-darwin-wvlu4k, Live-Nachweis offen] [Paket zuerst: packages/module-story anlegen mit Gerüst, Gate und Test gegen fremdes fetch, alle neuen Komponenten dort] Linke Spalte lesend, zwei Ebenen: Gliederung aus der berechneten Themenuebersicht (beim Einstieg zu, klappt auf und markiert das aktive Thema sobald in der Mitte eines gewaehlt ist; Fragen nur in der Mitte) und darunter Meine Fragen nach Sitzungen = bestehende Chats mit Titel (umbenennen, fortsetzen); Liste aus allen Chats der Person in dieser Library (Owner 01.10.: auch fruehere Sitzungen; anonym per Sitzungskennung, 30 Tage), je Chat die Fragen chronologisch. Mitte beim Einstieg: Kopf des Ganzen (Titel, Dreizeiler, Kennzahlen) + Themenkarten; Themenseite gleich aufgebaut mit Fragen als Knoepfe, Kurztitel heuristisch (erste Worte), Klick wählt die Konversation. Keine Änderung an Chat-Logik, nur Darstellung."
    status: done
  - id: d2-auswahl-und-scroll
    content: "[Gebaut 01.10.2026 in PR zu Branch ccr-72b5c0ce-oj24xu (auf D1 gestapelt), Live-Nachweis offen] Auswahlmodell: genau eine Konversation ist aktiv (URL-Parameter per nuqs, z. B. q=<queryId>); Mitte zeigt sie oben bündig; neue Frage wird aktiv und erscheint sofort in der Chronik mit Zustand läuft. Scroll-Regel aus dem Fix vom 01.10. übernehmen (Frage oben, Antwort darunter)."
    status: done
  - id: d3-quellen-spalte
    content: "[Gebaut 01.10.2026 in PR zu Branch ccr-72b5c0ce-oj24xu (auf D1+D2 gestapelt), Live-Nachweis offen] Rechte Spalte auf 35 % und schmaler gestalten: Quellenliste der aktiven Antwort statt Galerie-Raster; ohne aktive Antwort die gefilterte Übersicht wie heute. Filterleiste bleibt oben."
    status: done
  - id: d4-mobil
    content: "[Gebaut 01.10.2026 in PR zu Branch ccr-72b5c0ce-oj24xu (auf D1–D3 gestapelt), Live-Nachweis offen] Mobil (unter lg): Chronik als Sheet hinter einem Menü-Knopf im Story-Kopf; Mitte füllt den Schirm; Quellen wie heute als Overlay. Keine doppelten Mounts (Lehre aus M4h)."
    status: done
  - id: d5-kurztitel-llm
    content: "[Gebaut 01.10.2026 (auf D1–D4 gestapelt), Live-Nachweis offen] Kurztitel (zwei bis vier Worte) aus derselben LLM-Antwort wie die Antwort selbst (Prompt-Erweiterung im Orchestrator, Feld shortTitle im QueryLog, Sprache = Zielsprache). Heuristik aus D1 bleibt Fallback für alte Einträge."
    status: done
  - id: d7-zitatmarken
    content: "[Gebaut 01.10.2026 (auf D1–D6a gestapelt), Live-Nachweis und Backfill-Lauf offen] Zitatmarken je Dokument statt je Textstelle: Belege nach fileId gruppieren, Kreiszahlen im Text = Karte rechts, DocReference um passages (chunkIndex, page, excerpt) erweitern, Seitenzahl je Chunk beim Einlesen speichern + Backfill, Tooltip mit Seiten und Zitaten, Sprung in die Detailansicht auf die Seite."
    status: done
  - id: d6-aufraeumen
    content: "[D6a gebaut 01.10.2026 (Entflechten, toter Code, Verlauf, Status, Sitzungstitel); D6b gebaut 01.10.2026 (Konversation im Paket, StoryRoot im Embed, Detailansicht aufgeteilt); D6c gebaut 01.10.2026 (App montiert StoryRoot, eingebettete Chat-Variante zurückgebaut); Live-Nachweis App und Embed offen; Befund: ChatPanel ist nirgends mehr montiert — Rückbau des App-Chats ist D6d] chat-panel.tsx entflechten (1.220 Zeilen): Chronik, Mitte und Quellen als eigene Komponenten unter 200 Zeilen im Paket; StoryRoot in @ks/embed montieren; alte Zweiteilung entfernen; welle-3-iii-galerie-chat-contracts und STAND.md nachziehen."
    status: done
---

# Story-Modus: Dreiteilung mit Fragen-Chronik

## Ausgangslage (Live-Test 01.10.2026)

Der Story-Modus ist heute zweigeteilt: links der Chatverlauf (Themenübersicht
plus Fragen und Antworten als Akkordeons), rechts das Quellenverzeichnis als
Galerie-Raster. Aufbau in `gallery-root.tsx` (Story-Reiter, zwei gleich breite
Spalten ab `lg`), Inhalt links aus `chat-panel.tsx` (1.220 Zeilen).

Befunde aus dem Test auf der veröffentlichten Seite:

- Nach dem Absenden scrollte der Verlauf ans Ende, danach mit
  `scrollIntoView(nearest)` zur Antwort. Bei kurzen Antworten stand die
  Antwort unten im Fenster und die Themenübersicht darüber. Korrigiert am
  01.10. in `use-chat-scroll.ts` und `use-chat-stream/hook.ts`: Frage oben
  bündig, Antwort darunter.
- Zehn Fragen hintereinander verlieren sich im Verlauf. Es gibt keine
  Übersicht, welche Fragen gestellt wurden, und kein Springen.
- Die Quellenspalte nimmt die Hälfte der Breite, obwohl sie nur Beleg ist.

## Zielbild

Drei Spalten ab Desktop-Breite, Startwerte 15 / 50 / 35 Prozent:

```
+----------+------------------------------+--------------------+
| Chronik  | Gewaehlte Konversation       | Quellen            |
|          |                              |                    |
| * Themen-| Frage (ausfuehrlich)         | Filterleiste       |
|   ueber- |                              | Belege der Antwort |
|   sicht  | Antwort                      | (schmale Liste)    |
| o Verkehr| ...                          |                    |
| o Heizen |                              |                    |
| o laeuft | Vorschlaege fuer Anschluss-  |                    |
|          | fragen                       |                    |
|          +------------------------------+                    |
| + Neue   | Eingabefeld                  |                    |
|   Frage  |                              |                    |
+----------+------------------------------+--------------------+
```

- **Linke Spalte, zwei Ebenen (Owner 01.10., Abend, gilt):**
  1. **Themen (Gliederung):** beim Einstieg ZUGEKLAPPT, weil die Themen in
     der Mitte stehen. Sobald in der Mitte ein Thema gewählt ist, klappt die
     Gliederung auf und markiert das aktive Thema. Das ist die Orientierung:
     Man weiß immer, wo man gerade ist. Die vorgeschlagenen Fragen stehen NUR
     in der Mitte, nie im Baum.
  2. **Meine Fragen, nach Sitzungen gegliedert:** Jede Sitzung hat einen
     Titel (änderbar, wie bei Claude) und enthält die gestellten Fragen als
     Kurztitel. Die erste Frage eröffnet eine neue Sitzung. Alte Sitzungen
     lassen sich aufklappen und fortsetzen. Egal ob eine Frage aus einem Thema
     gewählt oder selbst getippt wurde: sie wandert auf demselben Weg hierher,
     erst als „läuft“, dann mit Kurztitel.
  Sitzungen sind technisch die bestehenden Chats (MongoDB `chats`, Titel,
  Umbenennen per PATCH, Liste und Löschen gibt es schon). Es fehlt nur die
  Darstellung.
- **Mitte beim Einstieg: Kopf des Ganzen, dann die Themen.** Oben der Kopf
  des gesamten Inhalts: Titel, Kurzbeschreibung in drei Zeilen, generische
  Zähler (Dokumente, Themen). Status-Zähler wie „in Umsetzung“ sind
  library-spezifisch und kommen NICHT in die Mitte (Owner 01.10.); so etwas
  bleibt den Facetten rechts vorbehalten. Darunter eine Karte je
  Thema mit einem Satz und „n Fragen“. Thema gewählt → dieselbe Form eine
  Ebene tiefer: Titel, Dreizeiler, Zähler (Dokumente, Fragen), dann die Fragen
  als große Knöpfe. Frage gewählt → Konversation: Frage oben bündig, Antwort,
  Anschlussfragen. Verworfen am 01.10.: die Übersicht als reiner Lesetext
  (v4), weil ohne Themenwahl die Orientierung links fehlt.
- **Darstellung (Designkonzept Owner 01.10., plakativ für Nicht-Fachleute;
  Quelle: Stitch-Projekt „Dokumenten-Explorer Story-Mode Layout“, in Figma v3
  als Drahtgitter übernommen):**
  Frage als große Karte „Deine Frage“; Antwort als Karte „Synthese“ mit
  Zitatnummern im Text, Zustimmungsbalken und Anschlussfragen als Knöpfe;
  Belege rechts als Karten mit Nummer, Status-Plakette (In Umsetzung,
  Abgelehnt, Geplant, In Prüfung), Kurztext, Kennzeile und „Original
  ansehen“; darunter der Weg in den Katalog.
- **Quellen (rechts):** Belege der aktiven Antwort als schmale Liste. Ohne
  aktive Antwort die gefilterte Übersicht wie heute.
- **Mobil:** Chronik hinter einem Menü-Knopf im Story-Kopf (Sheet von
  links). Mitte füllt den Schirm. Quellen wie heute als Overlay.

## Klickmodell

| Auslöser | Linke Spalte | Mitte | Quellen |
|---|---|---|---|
| Story-Modus öffnen | Gliederung zu, „Meine Fragen“ mit alten Sitzungen | Kopf des Ganzen (Titel, Dreizeiler, Kennzahlen), dann eine Karte je Thema | alle Quellen |
| Themenkarte tippen | Gliederung klappt auf, Thema markiert | Thema: Titel, Dreizeiler, Kennzahlen, Fragen als Knöpfe | Quellen dieses Themas |
| Frage tippen oder eigene senden | neue oder aktive Sitzung, Eintrag „läuft“ | Frage oben, Stand in einfachen Worten darunter | leer bis Antwort |
| Antwort fertig | Kurztitel ersetzt „läuft“ | Synthese mit Zitatnummern, Anschlussfragen als Knöpfe | Belege als Karten |
| Anschlussfrage tippen | neuer Eintrag „läuft“ in derselben Sitzung | wie oben | wie oben |
| Eintrag unter „Meine Fragen“ tippen | wird aktiv | wechselt, Frage oben bündig | Belege dieser Antwort |
| Thema in der Gliederung tippen | Thema markiert | Themenseite | Quellen des Themas |
| „Themenübersicht“ tippen | Gliederung zu, Sitzungen bleiben | Kopf und Themenkarten | alle Quellen |

Die Auswahl lebt in der URL (`nuqs`), damit Zurück-Knopf und Teilen eines
Links funktionieren. Fehlt `q`, gilt die Themenübersicht.

## Datenhaltung

- Konversationen kommen wie heute aus `GET /api/chat/[libraryId]/queries`
  (Chat-Verlauf) und dem Stream. Für die Chronik braucht es kein neues
  Laden, nur eine andere Darstellung derselben Liste.
- Neues Feld `shortTitle` am `QueryLog` (Welle D5). Es wird in derselben
  LLM-Anfrage erzeugt wie die Antwort, in der Zielsprache der Perspektive.
  Alte Einträge ohne Feld bekommen den heuristischen Kurztitel aus D1.
- Frontmatter und Templates sind nicht betroffen.

## Generisch oder library-spezifisch (Prüfung 01.10., Tafel in Figma)

Alle Bildschirme müssen für jede Library funktionieren. Die klimaspezifischen
Wörter in den Entwürfen („Bürgerrat“, „Vorschlag“, „Prio“) sind Beispielinhalt,
nie feste Beschriftung. Drei Quellen für Text:

| Quelle | Beispiele | Regel |
|---|---|---|
| **Generisch** (feste Oberfläche, i18n) | Themenübersicht, Meine Fragen, Sitzungen, Zähler „n Dokumente · n Themen · n Fragen“, „Deine Frage“, „Antwort“, „n Quellen zitiert“, Zitatmarken ①–④, „Das könntest du als Nächstes fragen“, „Alle n Originalquellen im Katalog“ | Übersetzungsschlüssel, Zahlen aus der Galerie |
| **Konfig** (Library-Einstellungen) | Kopf des Ganzen (Label und Beschreibung aus `publicPublishing`), Status-Plakette und Kennzeile an der Belegkarte, optionaler Bewertungsblock, Wissensquellen | Je Detailansichtstyp konfiguriert; fehlt das Feld, fällt der Block weg (kein stiller Platzhalter) |
| **Inhalt** (Dokumente, Sprachmodell) | Themenkarten, Themen-Zusammenfassung, Sitzungstitel, Kurztitel, Antworttext, Anschlussfragen, Belegtitel und Kurztext | Titel und Kurztext sind Basisfelder jedes Dokuments |

Folge: Die Wellen D1 bis D4 bauen nur Generisches und lesen drei Konfig-Stellen
(Label und Beschreibung, Status-Feld, Kennzeile je Detailansichtstyp). Kein Code
darf eine bestimmte Library kennen.

**Form der Antwort (Owner 01.10.):** Absätze mit Zwischentiteln statt eines
kurzen Blocks; Zitatmarken als Nummern im Text, dieselben Nummern an den
Belegkarten rechts; Anschlussfragen in derselben Kartenform wie die
Themenfragen in Schritt 2 (volle Breite, Pfeil). Der Prompt muss Absätze und
Zwischentitel verlangen; die Marken ersetzen die heutigen „[1]“.

## Zitatmarken: Dokument statt Textstelle (Owner 01.10.)

Heute nummeriert der Orchestrator jede gefundene **Textstelle** (Chunk) durch:
Treffer 1..n werden zu „[1]“..„[n]“, zwei Stellen aus demselben Dokument
bekommen zwei Nummern (`src/lib/chat/orchestrator.ts`, Belege aus
`sources.map((s, index) => number: index + 1)`). Das Beleg-Panel gruppiert
rechts schon nach Dokument (`chat-document-sources.tsx`), die Nummern im Text
passen dann nicht mehr zur Liste.

**Zielbild:**

- Eine Nummer je **Dokument**, im Text und an der Belegkarte dieselbe
  Kreiszahl ①–④. Beide Seiten sind damit eindeutig zuzuordnen.
- Beim Überfahren einer Marke (Text oder Karte) ein Tooltip: Dokumenttitel,
  „stützt sich auf n Textstellen“, je Stelle ein kurzes Zitat. Eine
  **Seitenzahl nur, wenn die Quelle Seiten hat** (PDF mit Seitenankern).
  Audio, Video, Markdown und andere Quellen ohne Seiten zeigen nur das
  Dokument und das Zitat, keine Seite, keine Zeitmarke (Owner 01.10.). Klick
  öffnet das Dokument, bei Seite an dieser Seite, sonst am Anfang. Figma:
  Schritt 4 zeigt beide Tooltip-Fälle.

**Daten, was fehlt:**

1. **Nummern je Dokument:** Belege vor dem Prompt nach `fileId` gruppieren,
   Nummer je Dokument vergeben, dem Sprachmodell die Dokument-Nummern geben;
   die Textstellen hängen als Liste unter dem Beleg (`DocReference` bekommt
   `passages: Array<{ chunkIndex, page?, excerpt }>`). Cache-Hash
   unverändert (Nummerierung ist Darstellung).
2. **Seitenzahl je Textstelle, optional:** Nur Quellen mit Seitenankern
   (PDF-Transkripte, `page-split.ts`) bekommen beim Einlesen ein Feld `page`
   je Chunk; für bestehende PDF-Libraries nachziehen (Skript, wie beim
   Klimamaßnahmen-Backfill). Alle anderen Quellen (Audio, Video, Markdown,
   Sammeldateien) haben kein `page`; das Tooltip lässt die Seiten-Plakette
   dann weg. Kein Ersatzwert, kein Platzhalter (no-silent-fallbacks).
3. **Zitat-Ausschnitt:** die ersten ~160 Zeichen des Chunks, serverseitig
   mitgeliefert, damit das Tooltip ohne Nachladen steht.
4. **Sprung auf die Seite:** Detailansicht mit Parameter `page`; die
   PDF-Vorschau kann zu einer Seite springen, Markdown-Ansichten scrollen zum
   Seitenanker.

Einordnung: eigene Welle **D7** nach D5, weil Orchestrator, Prompt und
Ingestion betroffen sind (Contracts: chat-contracts, ingestion-contracts).

## Grenzen und Regeln

- Die Galerie liegt im Paket `@ks/module-explorer`; der Story-Inhalt kommt
  als Slot (`storyPanel`) aus der App. Die Dreiteilung gehört in den
  Story-Reiter des Pakets, Chronik und Mitte bleiben App-Komponenten, die
  über Slots montiert werden. Keine Chat-Typen ins Paket ziehen (Lehre
  aus M4h).
- Contracts: `welle-3-iii-galerie-chat-contracts`, `chat-contracts`,
  `no-silent-fallbacks`. Dateien unter 200 Zeilen, `chat-panel.tsx` wird
  dabei entflochten, nicht erweitert.
- Mobil keine doppelten Mounts der Quellenliste (heute über `isMobile`
  gelöst, beibehalten).
- Kosten: D5 ändert den Prompt. Cache-Hash und Query-Log-Vergleich
  müssen den Kurztitel ignorieren, sonst entwerten sich alle Zwischenspeicher.

## Paketierung: Story-Modus als einbettbare Komponente (Owner-Entscheidung 01.10.: mitnehmen)

Die Galerie liegt seit M4i als Komponente in `@ks/module-explorer` und läuft
über `@ks/embed` in fremden Anwendungen. Der Story-Modus sollte als nächstes
denselben Weg gehen; STAND.md führt „Story und Chat im Embed“ bislang außerhalb
von Vorhaben 1. Diese Wellen bauen genau die Komponenten, die später das
Paket bilden. Owner-Entscheidung 01.10.2026: **mitnehmen, nicht nachziehen** — die
Regeln kosten beim Neubau fast nichts, beim Nachziehen einen zweiten Durchgang
durch dieselben Dateien.

Regeln ab D1 (aus M4f bis M4i übernommen):

- Neue Komponenten entstehen unter `packages/module-story/src` (Arbeitsname
  `@ks/module-story`), nicht unter `src/components/library/chat`. Alte
  Dateien werden nur abgebaut, nicht erweitert (D6).
- Das Paket spricht ausschließlich über die Instanz-Schnittstelle
  (`InstanceApi` aus `@ks/api-client`, wie der Explorer); kein eigenes
  `fetch`, kein `next/*`, kein Clerk. Ein Unit-Test verbietet fremdes
  `fetch` wie im Explorer.
- Alles, was das Paket nicht kennen darf, kommt als Slot oder Prop: Anmeldung,
  Bilder über den Gastgeber, Detailansicht öffnen, Perspektive-Seite.
- Chat-Vokabular (`lib/chat/constants`) nur über `@ks/contracts`; keine
  Server-Typen ins Paket (`src/lib/chat` bleibt Server-Stack).
- Embed liefert nur Öffentliches (ADR 0008 Nachtrag): Der Story-Modus im Embed
  läuft anonym über die Sitzungskennung; Sitzungen und Chronik funktionieren
  damit, Umbenennen und Löschen auch (an die Kennung gebunden).
- Wurzelkomponente `StoryRoot` mit denselben Montagepunkten wie
  `ExplorerRoot`: `/explore/[slug]?mode=story`, `/library/gallery`, Embed.

Was dadurch zu den Wellen dazukommt: D1 legt das Paket an (Gerüst, Gate,
Test gegen fremdes `fetch`); D4 prüft Mobil auch im Embed; D6 montiert
`StoryRoot` in `@ks/embed` und entfernt die alte Zweiteilung. Mehraufwand
grob ein halber Tag über alle Wellen, gegenüber zwei bis drei Tagen beim
Nachziehen.

## Wellen

| Welle | Inhalt | Nachweis |
|---|---|---|
| D0 | Figma: drei Desktop-Bildschirme, zwei Mobil-Bildschirme, Klickpfade verbunden (angelegt 01.10., Link unter Entscheidungen) | Owner klickt das Modell durch, Abnahme der Verhältnisse |
| D1 | Chronik lesend, heuristische Kurztitel, Klick wählt Konversation | Live: zehn Fragen, jede per Klick erreichbar |
| D2 | Auswahl in der URL, Frage oben bündig, Zustand „läuft“ (gebaut 01.10., Stand D2 oben) | Live: Neu laden mit `q=` zeigt die richtige Konversation |
| D3 | Quellen auf 35 %, Belege der aktiven Antwort als Liste (gebaut 01.10., Stand D3 oben) | Live: Belege wechseln mit der Auswahl |
| D4 | Mobil: Chronik im Sheet (gebaut 01.10., Stand D4 oben) | Browser-Pane mobil, keine Doppel-Mounts |
| D5 | Kurztitel aus dem LLM, Feld `shortTitle` (gebaut 01.10., Stand D5 oben) | Live: neue Frage bekommt treffenden Titel in der Zielsprache |
| D6 | Entflechten und Doku (D6a, D6b, D6c gebaut 01.10.: App und Embed montieren `StoryRoot`; D6d offen: toten App-Chat entfernen) | Story-Mitte in App und Embed aus demselben Paket; Live: Übersicht, Frage mit ①, Chronik, Löschen |
| D7 | Zitatmarken je Dokument, Seite je Chunk, Sprung auf die Seite (gebaut 01.10., Stand D7 oben) | Live: ① im Text = Karte rechts; Seitenknopf öffnet das PDF an der Seite |
| D8 | Sitzungsstart: Themenübersicht eröffnet keine Sitzung, erst die erste Frage; Altlasten-Skript (gebaut 02.10., Stand D8 unten) | Live: Übersicht ansehen legt keinen Chat an; „Meine Fragen“ ohne Systemtitel |
| D9 | Kopf-Plaketten: Perspektive im Story-Kopf als Plaketten statt Info-Symbol, wie Figma Schritt 1; Chronik ohne Aufruf bei leerer Library-Kennung (gebaut 02.10., Stand D9 unten) | Live: Plaketten sichtbar, Klick führt zur Perspektive-Seite; kein 405 beim Start |
| D10 | Kopf der Seite für beide Ansichten: Titel und Zweizeiler der Library oben, darunter die Ansichtszeile („Inhalte erkunden“ / „Story-Modus“) mit ⓘ-Erklärung zum Auf- und Zuklappen; Mitte ohne Konfig-Kopf, Modelltitel vor den Themen (Figma „6“ und „Schritt 7“ abgenommen 02.10., gebaut als D10 + D10b 02.10., Stand D10 unten) | Live: Erklärung beim ersten Besuch auf, Pfeil klappt zu, ⓘ wieder auf; Kopf zeigt Library in Galerie und Story; Plaketten nur Gesetztes |

Jede Welle eine PR, lokal `pnpm build` grün vor dem Merge.

### Stand D1 (gebaut 01.10.2026)

Was steht:

- Paket `@ks/module-story` (`packages/module-story`): React-freies
  Wurzel-Barrel mit `storyGate` (`SiteModule` um `story` erweitert, die
  Voll-App liefert es aus), React-Einstieg `@ks/module-story/react`. Tests:
  kein nacktes `fetch`, kein `next/*`, kein Clerk, kein `@/`, keine
  Adresszeile. Die Chat-Routen bleiben bis D6 unter `explorerGate`.
- `StoryTopicsData` liegt in `@ks/contracts`; `src/types/story-topics.ts`
  ist Shim.
- Linke Spalte (`StoryChronik`): Gliederung (zu beim Einstieg, klappt auf und
  markiert das Thema der Auswahl) und „Meine Fragen" nach Sitzungen; Fragen
  der aktiven Sitzung live aus dem Verlauf, ältere Sitzungen laden beim
  Aufklappen; Umbenennen per PATCH; „Neue Sitzung".
- Mitte (`StoryUebersicht`, `StoryThema` im Paket; `StoryMitte` in der App
  hängt Konfig-Texte, Rechen-Status, „neu berechnen", KI-Hinweis an): Kopf des
  Ganzen (Label, Beschreibung, Zähler) mit Themenkarten; Themenseite mit
  Fragen als Knöpfen. Gewählte Konversation steht allein in der Mitte.
- Zustand zwischen den Spalten über drei Jotai-Atome (`storyAuswahlAtom`,
  `storyGliederungAtom`, `storyAktiveSitzungAtom`); `useActiveChatId` teilt
  die aktive Sitzung über ein Atom. Die Auswahl ist noch lokal (URL ist D2).
- `GalleryRoot` hat den Slot `storyChronik`; mit Slot 15 / 50 / 35 als feste
  Startwerte (Ziehen, Entscheidung 2, kommt mit D3, wenn die Spalten ohnehin
  angefasst werden). Chronik nur auf Desktop gemountet; Mobil ist D4.
- Server: `GET …/queries` liefert `queryType` und `chatId` (die Chronik lässt
  die Themenübersicht weg); eine Sitzung, die die Themenübersicht eröffnet
  hat, bekommt mit der ersten echten Frage deren Titel.

Neu dazugekommen (beim Bauen gesehen):

- Jede erste Anfrage ohne `chatId` legt einen Chat an — im Story-Modus ist das
  die Themenübersicht. Solche Sitzungen trugen die englische Systemfrage als
  Titel; die Server-Regel oben behebt das für Sitzungen mit Fragen. Eine
  Sitzung, in der nie gefragt wurde, bleibt mit Systemtitel sichtbar.
  Entscheidung offen: ausblenden (braucht Zähler je Sitzung) oder in D5/D6
  gar keinen Chat für die Themenübersicht anlegen.
- `publicPublishing.story` (topicsTitle, topicsIntro) erreicht anonyme
  Betrachter auf `/explore/[slug]` nicht: `GET /api/public/libraries/[slug]`
  liefert das Feld nicht, `toClientLibrary` kennt es nicht. Die Karten-
  Überschrift fällt dort auf den Titel der Gliederung zurück. Kandidat für
  D3 (Konfig-Stellen) oder D6.
- Toter Code im Chat: `chat-welcome-assistant.tsx` und
  `hooks/use-chat-config.ts` importiert niemand; `StoryTopics` wird mit D1
  nur noch von nichts gerendert. Alle drei fallen in D6.
- `use-chat-history` lädt je Frage eine zweite Anfrage (N+1), um `queryType`
  zu kennen; mit dem Feld in der Liste kann D6 das streichen.
- Der Live-Nachweis (zehn Fragen, jede per Klick erreichbar) steht aus; die
  Welle wurde ohne Mongo nur mit Unit-Tests (Hook, Komponenten, Helfer)
  belegt.

### Stand D2 (gebaut 01.10.2026)

Was steht:

- **Auswahl in der Adresse:** `q=<queryId>` per `nuqs`. Das Paket bleibt
  URL-frei (`paket-schnitt.test.ts`): `auswahl-kennung.ts` legt nur fest,
  welche Auswahl eine Kennung hat (gespeicherte Konversationen) und was eine
  Kennung von außen ändert — fehlt `q`, gilt die Themenübersicht; ein Thema
  und eine laufende Frage (noch ohne queryId) stehen nicht in der Adresse
  und bleiben unberührt. Die App bindet das Atom in `StoryAuswahlUrl`
  (`src/components/library/story/story-auswahl-url.tsx`, montiert in
  `client.tsx` neben dem Chat-Panel), wie `NextGalleryNavigation` für die
  Galerie: Klick schreibt mit Verlaufseintrag, der Nachtrag der queryId an
  eine laufende Frage ersetzt nur (Zurück führt nicht auf „läuft").
- **Neu laden / Zurück / geteilter Link:** Kommt `q` von außen, löst die
  App die Sitzung über `GET …/queries/<queryId>` (liefert `chatId`) auf und
  stellt den Chat darauf um; sonst bliebe die Mitte leer, wenn die
  Konversation zu einer anderen als der zuletzt aktiven Sitzung
  (localStorage) gehört. Nicht auffindbar (404, fremde Sitzung): Auswahl
  bleibt, Warnung in der Konsole, Mitte meldet „nicht im Verlauf".
- **Frage oben bündig:** `use-chat-scroll` stellt beim Auswahl-Wechsel
  (Chronik-Klick, Zurück, Neu laden) die Frage der gewählten Konversation
  oben bündig — dieselbe Regel wie beim Senden (Fix vom 01.10.,
  `scrollElementToViewportTop` mit Platzhalter). Der Schlüssel ist die
  lokale Kennung, damit der Nachtrag der queryId keinen zweiten Sprung
  auslöst.
- **Zustand „läuft":** `fragenAusVerlauf` kennt den Stream-Zustand; offen
  ist nur die letzte Frage ohne Antwort, solange gesendet wird (eine
  abgebrochene Frage stand sonst ewig als „läuft"). Die erste Frage einer
  neuen Sitzung erscheint sofort unter einer vorläufigen Sitzung („Neue
  Sitzung", nicht umbenennbar), bis der Server die Kennung vergibt.
- **Verarbeitung in einfachen Worten:** `VerarbeitungEinfach` im Paket
  (`verarbeitungInWorten` als reine Funktion): eine Zeile je Phase
  (erinnern, verstehen, lesen, zusammenstellen, formulieren, aufbereiten),
  keine Technikbegriffe; i18n `processing.plain.*` in fünf Sprachen.
  `ProcessingStatus` hat dafür `einfach`; Story-Mitte und eingebetteter
  Verlauf nutzen es, Chat-Reiter und Protokoll-Dialog bleiben technisch.
  Dafür liegt `ChatProcessingStep` jetzt in `@ks/contracts`
  (`src/types/chat-processing.ts` ist Shim, `formatSSE` bleibt dort).

Neu dazugekommen (beim Bauen gesehen):

- `use-chat-history` lädt je Sitzung nur die letzten 20 Fragen. Ein `q` auf
  eine ältere Frage derselben Sitzung findet die Konversation nicht und
  meldet „nicht im Verlauf", obwohl die Chronik (100 je Sitzung) sie
  listet. Kandidat für D6 zusammen mit dem N+1 aus D1.
- Der Wechsel in die Galerie-Ansicht trägt `q` mit (`nextParamsForMode`
  kopiert alle Parameter); zurück im Story-Modus ist die Konversation wieder
  gewählt. Bewusst so gelassen; wer das anders will, löscht `q` in
  `nextParamsForMode` für `gallery`/`site`.
- Contract `welle-3-iii-galerie-chat-contracts` §5 nannte `?q=<query>` als
  Suchtext — nie gebaut, nirgends gelesen. Die Zeile heißt jetzt
  `q=<queryId>` (Story: gewählte Konversation).
- `story-topics/index.tsx` (seit D1 ohne Aufrufer) nutzt weiter die
  technische Ansicht; fällt in D6.
- Live-Nachweis (Neu laden mit `q=` zeigt die richtige Konversation) steht
  aus: ohne Mongo nur per Unit-Tests belegt (URL-Bindung mit
  `NuqsTestingAdapter`, Kennung-Regeln, Chronik, Verarbeitung in Worten).

### Stand D3 (gebaut 01.10.2026)

Was steht:

- **Spalten per Ziehen:** `StorySpalten` im Explorer-Paket
  (`gallery/components/story-spalten.tsx`): `ResizablePanelGroup` mit
  Chronik | Mitte | Quellen, Startwerte 15 / 50 / 35 (Entscheidung 2), Stand
  im localStorage über `autoSaveId` wie die Archiv-Panels; ohne Chronik-Slot
  50 / 50 unter eigenem Schlüssel. Mobil wird nur die Mitte gemountet (keine
  Doppel-Mounts, Lehre aus M4h); Quellen bleiben dort das Overlay.
- **Belege rechts:** Mit aktiver Antwort zeigt die Spalte `BelegListe` statt
  des Galerie-Rasters: je Dokument eine Karte mit Fußnoten-Nummern (heute
  noch je Textstelle, D7 macht sie je Dokument), Titel, Status-Plakette,
  Kennzeile, Kurztext und „Original ansehen" (Galerie-Adressierung, sonst
  Rückfall über `open-document-detail`). Darunter „Weitere gefundene
  Dokumente" zugeklappt und der Weg in den Katalog („Alle n Originalquellen
  im Katalog"); beides und „Schließen" setzen Referenzen und Antwort-Filter
  zurück. Ohne aktive Antwort: Filterleiste oben, gefilterte Übersicht wie
  bisher. Die Filterleiste bleibt in der Beleg-Ansicht ausgeblendet (wie
  bisher im Raster: sie filtert den Katalog, nicht die Belege).
- **Konfig je Detailansichtstyp** (Registry `belegKarte` in `@ks/contracts`):
  Status-Feld mit Zuordnung seiner Werte auf vier generische Plaketten
  (`umsetzung`, `geplant`, `pruefung`, `abgelehnt`; Labels aus i18n
  `story.beleg.status.*`) und Kennzeilen-Felder. Fehlt die Konfig oder das
  Feld, fällt der Block weg; ein Wert ohne Zuordnung erscheint roh als
  neutrale Plakette (sichtbar, nicht geraten). Kein Code kennt eine Library.
- **Zuordnung climateAction (festgelegt, Offene Punkte):** in_umsetzung,
  im_klimaplan, in_fachplaenen → In Umsetzung; neu_umsetzbar → Geplant;
  vertieft_pruefen, unklar → In Prüfung; nicht_umsetzbar → Abgelehnt.
  Kennzeile: massnahme_nr · arbeitsgruppe · vorschlag_quelle. book: Autoren,
  Jahr; session: Vortragende, Track, Datum. Test
  `beleg-karte-config.test.ts` hält Felder und Plaketten fest.

Neu dazugekommen (beim Bauen gesehen):

- **Kurztext:** `DocCardMeta` (die Galerie-Karte) trägt keine
  Zusammenfassung — weder `summary` noch `teaser` kommen in der
  Galerie-Projektion an. Der Kurztext des Belegs ist deshalb die Begründung
  der ersten Referenz (warum zitiert). Soll die „Beschreibung des
  Vorschlags" auf die Karte, muss die Galerie-Projektion das Feld liefern
  (Server, `docs`-Route) — Kandidat für D7 zusammen mit den Zitaten.
- **Zwei Status-Zuordnungen:** Die Galerie-Karte (`document-card/
  status-config.ts`: neu_umsetzbar = aktiv, vertieft_pruefen = geplant) und
  die Detailansicht (`climate-action-detail.tsx`) ordnen `lv_bewertung`
  anders zu als die Belegkarte. Vereinheitlichen auf die Registry-Konfig ist
  Kandidat für D6.
- **Zustimmungsbalken** (Offene Punkte) bleibt weg: kein Feld dafür.
- Live-Nachweis (Belege wechseln mit der Auswahl, Spalten ziehen und merken)
  steht aus: ohne Mongo nur per Unit-Tests belegt (Helfer, Belegliste mit
  Adressierung, Registry-Konfig).

### Stand D4 (gebaut 01.10.2026)

Was steht:

- **Chronik mobil als Sheet:** `StoryChronikSheet` im Explorer-Paket (Sheet
  von links, Inhalt ist der `storyChronik`-Slot). `GalleryRoot` hält den
  Zustand und mountet den Slot unter `lg` NUR im Sheet, solange es offen ist
  (Radix hält geschlossenen Inhalt nicht im DOM); auf dem Desktop nur in der
  Spalte. Verlässt man den Story-Modus oder springt die Breite auf Desktop,
  fällt das Sheet zu — nie zwei Mounts (Lehre aus M4h). Mitte füllt den
  Schirm, Quellen bleiben das Overlay (`ReferencesSheet`).
- **Menü-Knopf im Story-Kopf:** Der `storyHeader`-Slot bekommt
  `onOpenChronik` (nur mit Chronik-Slot); `StoryHeader` der App zeigt dafür
  unter `lg` den Knopf „Themen und Fragen" (`story.chronik.open`, fünf
  Sprachen). Das Paket kennt keine App-Komponente — der Knopf ist App.
- **Schließen nach Auswahl:** Der `storyChronik`-Slot bekommt
  `ctx.schliessen` mit; `StoryChronik` (`@ks/module-story`) meldet jede
  Auswahl über `onGewaehlt` (Übersicht, Thema, Frage, neue Sitzung), die App
  reicht beides durch. Nach dem Tipp steht die Mitte frei.

Neu dazugekommen (beim Bauen gesehen):

- **Embed:** `@ks/embed` montiert `GalleryRoot` ohne Story-Slots (M5: Story
  und Chat nicht mitnehmen); dort gibt es keinen Story-Modus und damit
  nichts mobil zu prüfen. Sobald D6 `StoryRoot` im Embed montiert, gilt
  dieselbe Mechanik (Slot + Sheet) ohne weitere Änderung.
- Live-Nachweis (Browser-Pane mobil: Knopf, Sheet, Auswahl schließt,
  kein Doppel-Mount) steht aus: ohne Mongo nur per Unit-Tests belegt
  (Sheet mountet nur offen, Chronik meldet jede Auswahl).

### Stand D5 (gebaut 01.10.2026)

Was steht:

- **Kurztitel aus derselben Antwort:** Das Antwort-Schema
  (`chatAnswerZodSchema`, JSON-Schema) hat ein optionales Feld `shortTitle`;
  der Prompt (`buildChatUserMessage` und `buildPrompt`) verlangt es als
  viertes Feld: zwei bis vier Worte, in der Sprache der Antwort, ohne
  Anführungszeichen und Satzzeichen. Kein zweiter LLM-Aufruf. Optional,
  damit ein Modell ohne das Feld nicht die ganze Antwort verwirft.
- **Bereinigen statt raten:** `normalizeShortTitle` (reine Funktion,
  `src/lib/chat/common/short-title.ts`) entfernt Anführungszeichen,
  Satzzeichen am Ende und Mehrfach-Leerzeichen, kürzt über 60 Zeichen an der
  Wortgrenze; nichts Brauchbares → `undefined`, kein Platzhalter. Der
  Orchestrator setzt es im Haupt- und im Retry-Pfad, schreibt es über
  `finalizeQueryLog` ins Log und liefert es im Ergebnis.
- **Feld und Projektion:** `QueryLog.shortTitle`; `GET …/queries` liefert es
  in der Liste (Projektion in `listRecentQueries`), der Stream im
  `complete`-Schritt (frisch und aus dem Cache; `ChatProcessingStep` in
  `@ks/contracts`).
- **Cache unberührt:** `createCacheHash` baut aus einer festen Feldliste —
  `shortTitle` ist nicht dabei, der Query-Log-Vergleich läuft über den Hash.
  Test in `cache-key-utils.test.ts`; `chat-contracts` §5 nennt die Regel.
- **Chronik:** `ChronikFrage.kurztitel` (aus `shortTitle` der Liste bzw. der
  Frage-Nachricht im Verlauf, die der Stream-Hook beim Abschluss ergänzt);
  `kurztitelFuer` nimmt ihn, sonst die Heuristik `kurztitel(text)` — alte
  Einträge bleiben lesbar. Sitzungstitel (D1-Serverregel) bleiben, wie sie
  sind.

Neu dazugekommen (beim Bauen gesehen):

- Der Analyse-Schritt (`question-analyzer.ts`) erzeugt schon einen
  `chatTitle` (bis 60 Zeichen) in einem eigenen LLM-Aufruf, der heute den
  Sitzungstitel speist. Zwei Titel aus zwei Aufrufen: Kandidat für D6, den
  Sitzungstitel aus dem `shortTitle` der ersten Frage zu nehmen und den
  Analyse-Aufruf zu verschlanken.
- TOC-Antworten (Themenübersicht) bekommen bewusst keinen `shortTitle`; die
  Chronik lässt sie ohnehin weg.
- Live-Nachweis (neue Frage bekommt treffenden Titel in der Zielsprache)
  steht aus: ohne Mongo und Sprachmodell nur per Unit-Tests belegt (Schema,
  Prompt, Normalisierung, Hash, Verlauf, Chronik).

### Stand D6a (gebaut 01.10.2026) — D6b (Embed) offen

Was steht:

- **chat-panel.tsx entflochten:** 1.220 → 372 Zeilen. Sieben Hooks unter
  `chat-panel/hooks/` (Perspektive, Aufklappen beim Laden, Story-Brücke
  D1/D2, Nachladen-Hinweis, Abschluss-Schritt, Autostart der
  Themenübersicht, Filter-Ereignisse, Aktionen) und zwei Layout-Teile
  (`panel-header`, `panel-footer`), jede Datei unter 200 Zeilen, Verhalten
  1:1. Die Varianten `default` und `compact` teilen sich einen Render-Pfad.
  Der Umbau lief in vier Commits unter 1.000 Zeilen, jeder baut.
- **Toter Code weg:** `chat-welcome-assistant.tsx`, `hooks/use-chat-config.ts`,
  `story-topics.tsx` und `story-topics/**` (alte Zweiteilung) samt
  Export-Vertragstest. `src/types/story-topics.ts` bleibt Shim.
- **Verlauf ohne N+1:** `GET …/queries` projiziert jetzt auch
  `accessPerspective`, `genderInclusive`, `facetsSelected` und `cacheParams`;
  `use-chat-history` lädt eine Liste je Sitzung (bis 100 Fragen) und baut die
  Nachrichten über die reine Funktion `verlaufZuNachrichten`
  (`utils/verlauf-utils.ts`). Damit findet `q=` auch ältere Fragen.
- **Status-Zuordnung vereinheitlicht:** Klimakarte (`climate-action-card`)
  und Detailansicht (`climate-action-detail`) nehmen die Registry-Konfig
  `belegKarte` (`plaketteFuer`, Labels `story.beleg.status.*`) wie die
  Belegkarte; `document-card/status-config.ts` ist weg. Ohne Wert keine
  Plakette, unbekannter Wert roh.
- **Sitzungstitel aus dem Kurztitel:** Hat eine Frage die Sitzung benannt
  (neu angelegt oder Systemtitel der Themenübersicht ersetzt), wird nach der
  Antwort der `shortTitle` des Sprachmodells (D5) zum Sitzungstitel — frisch
  wie aus dem Cache. Der Analyse-`chatTitle` bleibt vorerst (Verschlanken des
  Analyse-Aufrufs ist Server-Arbeit für eine eigene kleine Welle).

Was in D6b bleibt (eigene PR):

- `StoryRoot` mit denselben Montagepunkten wie `ExplorerRoot` und Montage in
  `@ks/embed` (anonym über die Sitzungskennung); dafür muss die Konversation
  (`ChatMessagesList`, Stream-Hook, Verlauf) ohne `@/`-Importe im Paket
  stehen — das ist der große Rest des Monolithen. Die Mitte im Paket ist
  heute `StoryUebersicht`/`StoryThema` plus App-Glue (`StoryMitte`); die
  Konversations-Ansicht kommt mit D7 (Zitatmarken), die sie ohnehin neu
  baut.

### Stand D7 (gebaut 01.10.2026)

Was steht:

- **Eine Nummer je Dokument:** `dokumenteNummerieren` (`src/lib/chat/common/zitatmarken.ts`)
  gruppiert die Treffer nach `fileId` in Trefferreihenfolge; Prompt
  (`buildContext`, `beschreibeDokumente`) und Orchestrator
  (`belegeAusGruppen`) rechnen mit derselben Nummerierung. Das Sprachmodell
  zitiert Dokument-Nummern („one number = one document“); `usedReferences`
  meint Dokumente. `DocReference.passages` (`@ks/contracts`, `DocPassage`:
  `chunkIndex`, `page?`, `excerpt` ≈ 160 Zeichen) hängt die Textstellen an.
  Cache-Hash unverändert.
- **Seite je Chunk, nur mit Seitenankern:** `buildVectorDocuments` bekommt die
  `PageSpan[]` aus `splitByPages(finalMarkdown)` und setzt `page` über die
  Chunk-Mitte (`seiteFuerOffset`, `page-split.ts`); `vector-repo` schreibt es
  in die Chunk-Metadaten, der Chunk-Retriever reicht es als
  `RetrievedSource.page` weiter. Quellen ohne `--- Seite N ---` haben kein
  Feld — kein Ersatzwert. Bestehende Libraries:
  `pnpm tsx scripts/backfill-chunk-pages.ts --collection <name> [--apply]`
  rechnet den eingebetteten Text aus dem Meta-Dokument nach (Trockenlauf
  ohne `--apply`). **Noch nicht gelaufen** — Owner entscheidet, welche
  PDF-Libraries nachgezogen werden.
- **Marken im Text und an der Karte:** `zitatmarkenImText` (`@ks/util`) macht
  aus `[n]` den Anker `[①](#beleg-n)`; `MarkdownPreview` lässt `#`-Links in
  der Seite. Die Belegkarte trägt `id="beleg-<n>"`, zeigt ①… statt Zahlen,
  ein Tooltip „stützt sich auf n Textstellen“ und darunter die Textstellen
  mit Zitat; die Seite ist ein Knopf („S. 7“), „Original ansehen“ öffnet an
  der ersten Seite. Ohne Seite nur das Zitat (Audio, Video, Markdown).
- **Sprung auf die Seite:** `openDocument(slug, { page })` in beiden
  Adressierungen (App: `openDocumentBySlug` setzt/löscht `page`; Embed:
  `SpeicherGalleryNavigation`), `closeDocument` räumt `page` mit auf.
  `GalleryRoot` liest `page` und gibt es an `DetailOverlay`; der Hook
  `useSeitenSprung` (`detail-overlay/seiten-sprung.ts`) sucht
  `[data-page-marker]` (Markdown, `injectPageAnchors`) oder `[data-page]`
  (PDF-Canvas) im Viewport, versucht es bis 3 s nach dem Laden und meldet
  einen fehlenden Anker einmal.

Was bewusst anders ist als im Zielbild:

- **Kein Tooltip auf der Marke im Text.** Die Marke ist ein Anker auf die
  Karte; das Tooltip mit Zitaten sitzt an der Karte. Ein Tooltip im
  Markdown-Text bräuchte einen eigenen Link-Renderer in `MarkdownPreview`
  (App) und `markdown-body` (Paket) — kommt mit D6b, wenn die Konversation
  ins Paket zieht und beide Renderer ohnehin zusammenfallen.
- **Alte Antworten** (Query-Log vor D7) haben Referenzen je Textstelle ohne
  `passages`; die Karte zeigt dann wie bisher den Kurztext aus der
  Beschreibung, die Nummern im Text bleiben die alten.
- `detail-overlay.tsx` ist mit 493 Zeilen weiter über der 200-Zeilen-Grenze
  (Altlast, +5 Zeilen für den Sprung); das Aufteilen gehört zu D6b.

### Stand D6b (gebaut 01.10.2026) — Konversation im Paket, StoryRoot im Embed

Was steht:

- **Konversation in `@ks/module-story`** (`src/react/konversation/`): Vokabular
  (`Nachricht`, `Perspektive`, `AntwortLaenge`), SSE-Zeilen, Fragenliste →
  Nachrichten mit Paaren, Chronik-Fragen und Auswahl (`verlauf.ts`), Verlauf
  einer Sitzung (`useStoryVerlauf`) und Stream (`useStoryStream`: Frage und
  Themenübersicht über denselben Weg, `complete` bringt Antwort, Belege,
  Kurztitel, Sitzung) — alles über die Instanz, ohne Clerk, ohne `@/`,
  Paket-Schnitt- und Fetch-Tests grün. Die Systemfrage der Themenübersicht
  liegt als `STORY_TOC_QUESTION` in `@ks/contracts`; die App exportiert sie
  weiter als `TOC_QUESTION`.
- **Antworttext mit Zitatmarken** (`AntwortText`): dieselbe Markdown-Engine
  wie die Buch-Ansicht (`md` aus `@ks/viewers`), Marken ①… als Anker mit
  `title` „Dokument: stützt sich auf n Textstellen“ (`mitMarkenTiteln`, reine
  String-Arbeit auf dem HTML). Klick scrollt zur Belegkarte `#beleg-n`, die
  Adresse bleibt unberührt (Embed). Das ist der Tooltip im Text aus D7 — im
  Paket; die App zeigt im Chat-Panel weiter nur den Anker (MarkdownPreview
  rendert HTML aus einem eigenen Pfad).
- **`StoryRoot`** (Mitte + Eingabe): Themenübersicht, Themenseite oder genau
  die gewählte Konversation; Anschlussfragen und Themenfragen landen in der
  aufklappbaren Eingabe; aktive Sitzung je Library über `useStorySitzungId`
  (Atom + localStorage, derselbe Schlüssel wie `useActiveChatId` der App);
  Verdrahtung in `useStoryKonversation` (Autostart der Übersicht einmal je
  Filter- und Perspektiven-Stand, gesendete Frage wird die aktive
  Konversation per Rückruf `onFrage`, Kennung und Thema werden nachgetragen,
  Chronik-Atome gefüllt). `StoryKopfzeile` für Montagepunkte ohne eigenen
  Story-Kopf.
- **Embed `view="story"`** (`packages/embed/src/embed-story.tsx`): die drei
  Story-Slots der Galerie mit `StoryRoot`, `StoryChronik` und
  `StoryKopfzeile`, Start im Story-Modus (`initialParams=mode=story`).
  Perspektive aus der Chat-Konfig der Library, Sprache = `locale` des
  Embeds, Modell = erstes öffentlich gelistetes (Regel wie `useStoryContext`),
  Belege über `chatReferencesAtom` an die Belegliste rechts, Dokumentenzahl
  aus dem geteilten Galerie-Zustand. Ohne Modell eine sichtbare Meldung.
  Bündel gebaut und geprüft (`pnpm --filter @ks/embed build`, 1,7 MB ESM).
- **Detailansicht aufgeteilt**: `detail-overlay.tsx` 493 → 139 Zeilen;
  Props-Vertrag, Doc-Meta, Bewertungsmodus, Kopf und Inhalt unter
  `detail-overlay/`, jede Datei unter 200 Zeilen.

Was bewusst (noch) nicht ist:

- **Die App montiert weiter `ChatPanel`** (`variant='embedded'`) als
  Story-Mitte. Sie trägt, was das Paket nicht hat: Perspektiven-Seite,
  Konfig-Anzeige, Debug und Protokoll, Löschen und Neu-Stellen,
  Filter-Ereignisse, Nachladen-Hinweis. Die Umstellung der App auf
  `StoryRoot` (und der Rückbau von `chat-panel/`, `chat-messages-list`,
  `use-chat-stream`, `use-chat-history` für die Story-Mitte) ist **D6c** —
  erst nach dem Live-Nachweis des Embeds, damit beide Wege nicht gleichzeitig
  kippen.
- Im Embed gibt es keine Perspektiven-Wahl (ADR 0008: nur Öffentliches, keine
  Identität); Interessenprofil und Sprachstil kommen aus der Library.
- `publicPublishing.story` (topicsTitle, topicsIntro) fehlt der öffentlichen
  Library-Route weiterhin (Befund D1); im Embed heißt die Übersicht nach der
  Gliederung.
- Live-Nachweis offen: `view="story"` in einer fremden Next-App — Übersicht
  entsteht, Frage antwortet mit ① auf der Karte rechts, Chronik listet die
  Sitzung nach dem Neuladen.

### Stand D6c (gebaut 01.10.2026) — App auf StoryRoot

Was steht:

- **Die App montiert `StoryRoot`** (`story/story-root-mount.tsx`) als
  Story-Mitte statt `ChatPanel variant="embedded"`. Hereingereicht, was nur
  die App kennt: Anmeldung (Clerk), Perspektive aus dem Story-Context
  (Perspektiven-Seite; gendergerechte Sprache aus dem gespeicherten Kontext),
  Konfig-Texte aus `useLibraries`, Eingabegrenze aus der Chat-Konfig, Filter
  und Dokumentenzahl der Galerie, Belege an `chatReferencesAtom`. Füße
  (`story-fuss.tsx`): KI-Hinweis, Konfig-Anzeige (aus dem Query-Log),
  Quellen-Sheet für Mobil (`show-reference-legend`, `show-toc-references`),
  Protokoll und Debug für Angemeldete.
- **Paket-Ergänzungen:** Frage löschen (Rückfrage, `DELETE …/queries/<id>`
  über die Instanz, zurück zur Übersicht; opt-in `loeschenErlaubt`, die App
  setzt es, das Embed nicht), „Frage neu stellen“ (Text in die Eingabe),
  `uebersichtFuss` bekommt die gespeicherte Kennung der Übersicht.
- **Eine Sitzung für alle:** `useActiveChatId` ist ein Mantel um
  `useStorySitzungId` — Chronik-Montage, `StoryAuswahlUrl` und Mitte sehen
  dasselbe Atom und denselben localStorage-Schlüssel.
- **Rückbau:** `chat-panel.tsx` kennt nur noch `default`/`compact`
  (265 Zeilen); weg sind `story-mitte.tsx`, `use-story-auswahl-bridge`,
  `use-story-toc-autostart`, `use-story-filter-events`, `use-toc-reload-hint`,
  `chronik-utils` (+ Test), der Story-Zweig von `use-chat-perspective-state`,
  die aufklappbare Variante von `chat-input`/`panel-footer`, der Mobil-
  Platzhalter und `storyPerspectiveOpenAtom`.

Was bewusst anders ist als vorher:

- **Filter-Ereignisse:** `StoryRoot` holt die Übersicht neu, sobald sich
  Filter oder Perspektive ändern — über den Server-Cache. Die App erzwang
  bei `gallery-filters-changed` eine Neuberechnung ohne Cache; das entfällt
  (Cache-Treffer sind erwünscht, „neu berechnen“ bleibt als Knopf).
- **Nachladen-Hinweis:** Der Knopf „Übersicht neu berechnen“ steht immer,
  wenn eine Gliederung da ist, nicht nur bei abweichenden Parametern
  (`use-toc-reload-hint` verglich dafür den Query-Log).
- **„Frage neu stellen“** füllt die Eingabe statt sofort zu senden (die alte
  Variante setzte zugleich die Perspektive der alten Frage zurück).
- **Scroll:** Jede Auswahl beginnt oben in der Mitte; der Platzhalter für
  „Frage oben bündig“ ist weg, weil die Konversation allein steht.

Neu dazugekommen (beim Bauen gesehen):

- **`ChatPanel` ist nirgends mehr montiert.** Der angenommene „Chat-Reiter“
  existiert nicht: Außer dem eigenen Ordner importiert niemand mehr
  `chat/chat-panel` (nur der Debug-Footer nennt den Namen als Text). Damit
  sind `chat-panel.tsx`, `chat-panel/**`, `chat-messages-list`,
  `chat-conversation-item`, `chat-message`, `chat-input`, `chat-config-bar`,
  `chat-config-popover`, `chat-selector`, `use-chat-stream`,
  `use-chat-history`, `use-chat-toc`, `use-chat-scroll` toter Code in der
  App. Noch gebraucht werden `chat-config-display`, `query-details-dialog`,
  `processing-logs-dialog`, `processing-status`, `chat-storage` (über die
  Story-Füße bzw. den Story-Context). **D6d** räumt den toten App-Chat weg —
  nach dem Live-Nachweis, falls der Owner den Chat-Reiter nicht doch
  zurückholen will.
- Live-Nachweis offen (App): Themenübersicht entsteht, Themenfrage →
  Eingabe → Antwort mit ① und Belegen rechts, `q=` nach dem Neuladen,
  Chronik-Klick auf eine ältere Sitzung, Löschen einer Frage.
- **02.10., lokaler Test, Schritt 1 (Kopf):** Figma „1 · Einstieg“ zeigt die
  Perspektive neben „Perspektive anpassen“ als Plaketten (Sprache,
  Interessen, Stil). Die App rendert dort `PerspectiveDisplay
  variant="header"`: ein Info-Symbol, die Werte stehen im Tooltip. Der
  Story-Kopf (`story-header.tsx`) war in keiner Welle dran. → **D9**.
- **02.10., lokaler Test, Schritt 9/12 (Chronik):** Unter „Meine Fragen“
  stehen Sitzungen mit dem Titel „What topics are covered here? …“. Das ist
  die Systemfrage der Themenübersicht: Der Stream legte für jede Anfrage ohne
  `chatId` einen Chat an, auch für die Übersicht; wer nur ansah, hinterließ
  eine Sitzung mit Systemtitel (in der Testlibrary 56 von 59). Figma
  Schritt 1: „Deine erste Frage eröffnet eine neue Sitzung“. → **D8**.
- **02.10., lokaler Test, Schritt 2 (Übersicht, Fuß):** Unter der
  Themenübersicht steht „Keine Konfiguration gefunden“. Netz:
  `GET …/queries/<Übersichts-Query>` → 404. Ursache: `getQueryLogById`
  filtert nach `userEmail`/`sessionId`, der Übersichts-Cache ist aber
  benutzerübergreifend (Hash + Library) — ein Treffer aus fremder Sitzung ist
  für die Konfig-Anzeige unsichtbar. Vermutung: Lesen einer Query nur noch
  an Library binden, wenn sie `toc` ist (oder die Konfig aus dem
  `complete`-Schritt nehmen statt nachzuladen). Noch nicht gebaut.
- **02.10., lokaler Test, Schritt 1 (Start):** Beim Öffnen der Seite feuert
  die Chronik `GET /api/chat/chats?limit=50` (ohne Library) → 405, zweimal.
  `StoryChronikMount` wird mit leerer `libraryId` montiert, bevor die
  Library geladen ist; `useStorySitzungen` wartet nicht darauf. Vermutung:
  Laden erst bei nicht-leerer Kennung (kein stiller Fallback, aber auch kein
  Aufruf ins Leere). Noch nicht gebaut.

### Stand D8 (gebaut 02.10.2026) — Sitzungsstart

Owner-Entscheidung 02.10.: Ein Chat beginnt erst mit einer Frage. Die
Themenübersicht braucht keine Sitzung — ihr Cache ist benutzerübergreifend
(Hash + Library), ihre Kennung für Konfig-Anzeige, Logs, Debug und
Quellen-Sheet hängt an der Query, nicht am Chat. Die einzige Kopplung war
das Pflichtfeld `chatId` im Query-Log, und das war selbst gemacht.

Was steht:

- **Stream-Route:** Für `isTOCQuery` wird kein Chat angelegt und keiner
  berührt; `activeChatId` bleibt leer, der `complete`-Schritt trägt dann keine
  `chatId`. Der Zweig „Systemtitel durch die erste Frage ersetzen“ (D1) ist
  weg, mit ihm `sitzungstitelAusFrage`. Der Kurztitel des Sprachmodells (D5)
  wird nur noch gesetzt, wenn die Frage die Sitzung angelegt hat.
- **Typen:** `chatId` ist optional in `QueryLog`, `startQueryLog` und im
  `complete`-Schritt (`@ks/contracts`), mit Kommentar: nur die Übersicht hat
  keine.
- **Stream-Hook (`use-story-stream`):** `onSitzung` feuert nur aus einer
  Frage, nie aus der Übersicht — auch wenn ein alter Server eine Kennung
  mitschickt (Test).
- **Altlasten:** `scripts/cleanup-toc-chats.ts` (Analyse ohne `--apply`,
  `--db=` Pflicht, vorher `mongodump` von `chats` und `queries`): über alle
  Libraries Chats mit Systemtitel (`istThemenuebersichtTitel`); ohne Frage
  einer Person → löschen, ihre Übersichts-Logs verlieren die `chatId` (wie D8
  sie heute anlegt); mit Fragen (App-Chat vor D1) → Titel aus der ersten
  Frage (Kurztitel, sonst 60 Zeichen), wie D1 ihn gegeben hätte.
- Belege: `sitzungstitel.test.ts`, `use-story-stream.test.tsx` (neuer Fall),
  tsc-Vergleich leer, Lint 0 Fehler. Live 02.10. (Dev-Server, Prod-DB,
  Cache-Treffer): der `complete`-Schritt der Übersicht trägt `queryId` und
  `storyTopicsData`, keine `chatId`; die Übersicht erscheint wie zuvor.

Was bewusst anders ist als vorher:

- Eine neue Sitzung erscheint in der Chronik erst mit der ersten Frage
  (Figma Schritt 1), nicht schon beim Öffnen des Story-Modus.
- „Übersicht neu berechnen“ in einer laufenden Sitzung hängt die Übersicht
  nicht mehr an die Sitzung; `touchChat` entfällt dafür.

### Stand D9 (gebaut 02.10.2026) — Kopf-Plaketten

Owner 02.10. nach dem Vergleich mit Figma Schritt 1: Die Perspektive steht
neben „Perspektive anpassen“ als Plaketten, nicht als Info-Symbol mit
Tooltip.

Was steht:

- **`PerspectiveDisplay variant="header"`** rendert je gesetztem Wert eine
  Plakette „Sprache: Deutsch“, „Interessenprofil: …“, „Zugangsperspektive:
  …“, „Sprachstil: …“ (Reihenfolge wie bisher im Tooltip). Leere Werte
  lassen die Plakette weg. Das Modell steht nicht im Kopf — es bleibt in der
  Konfig-Anzeige unter der Antwort. Mit `onClick` sind die Plaketten Knöpfe;
  `StoryHeader` reicht denselben Weg wie der Knopf „Perspektive anpassen“
  herein (Perspektive-Seite, `from=story`). Die Inline-Variante (Antwort-Fuß)
  ist unverändert.
- **Chronik ohne Library-Kennung:** `useStorySitzungen` lädt nichts, solange
  `libraryId` leer ist (die Schale montiert die Chronik vor der Library);
  kein `GET /api/chat//chats` → 405 mehr. Sobald die Kennung da ist, lädt der
  Hook wie gewohnt (Test).
- Belege: `perspective-display-plaketten.test.tsx`,
  `use-story-sitzungen-leer.test.tsx`, tsc-Vergleich leer, Lint 0 Fehler.

Nicht in D9 (Owner 02.10., Konzept offen):

- **Themenzeile über den Karten:** Fehlt `story.topicsTitle`/`topicsIntro`
  in der Konfig, zeigt die Übersicht Titel und Einleitung des Sprachmodells
  als zweiten Kopf unter dem Konfig-Kopf — wirkt doppelt (Befund 02.10.,
  Schritt 2). Figma hat dort nur eine kleine Zeile „Die vier Themen · wähle
  eines“. Vorschlag: generische Zeile mit Zahl, Konfig-Felder als
  Übersteuerung, Modelltext nicht mehr anzeigen. Wartet auf das Konzept zum
  Kopf.
- **Kopf der Seite vs. Kopf des Inhalts:** Über den drei Spalten stehen
  heute Erklärtexte zum Story-Modus (`gallery.storyMode.headline`,
  `subtitle`, `description` bzw. `publicPublishing.story.headline/subtitle/
  intro`). Owner 02.10.: Das ist Hilfetext zur Bedienung, kein Kopf des
  Inhalts. Dort gehören Titel und Zweizeiler der Library hin (heute in der
  Mitte als „Kopf des Ganzen“); die Erklärung des Story-Modus wird ein
  einmaliger Hinweis zum Wegklicken. Konzept folgt, generisch für alle
  Libraries.

### Stand D10 + D10b (Figma abgenommen und gebaut 02.10.2026) — Kopf der Seite für beide Ansichten

Owner 02.10.: Der Kopf über den drei Spalten erklärt heute die Bedienung
(`gallery.storyMode.headline/subtitle/description` bzw.
`publicPublishing.story.headline/subtitle/intro`). Das ist Hilfetext, kein
Kopf des Inhalts. Dort gehören Titel und Zweizeiler der Library hin.

Figma: Bildschirm „6 · Kopf der Seite (D10)“ mit Erklärtext „Schritt 6“ auf
der maßgeblichen Seite (Node `22-169`), Kopie von „1 · Einstieg“ mit diesen
Änderungen:

- **Kopf:** Titel der Library (24 px) und Zweizeiler (14 px, gedämpft) über
  der Knopfzeile; darunter „Zurück“, „Perspektive anpassen“, neu
  „? So funktioniert der Story-Modus“, dann die Plaketten (D9).
- **Mitte:** oben ein einmaliger Hinweis (ⓘ, Erklärtext, „Verstanden ✕“),
  gemerkt im Browser wie die Perspektive; „?“ im Kopf holt ihn zurück. Dann
  Kennzahlen, die Themenzeile „Die vier Themen · wähle eines“ und die
  Karten. Der „Kopf des Ganzen“ in der Mitte und der Modelltitel entfallen.
- **Generisch:** Titel und Zweizeiler aus den Library-Einstellungen
  (`publicPublishing` Titel/Beschreibung, wie heute der Kopf in der Mitte);
  die Erklärung aus den Übersetzungen oder `publicPublishing.story`; die
  Themenzeile aus der Übersetzung mit Zahl, `story.topicsTitle/topicsIntro`
  bleiben als Übersteuerung. Kein Library-Wissen im Code.

Was steht (gebaut 02.10., Owner „passt“ zum Figma-Bildschirm):

- **Kopf der Seite (`StoryModeHeader`):** Titel (`publicName`, sonst Label)
  und Zweizeiler (`description`) der Library, beim Scrollen ausgeblendet wie
  bisher; darunter die Knopfzeile mit neuem „?“-Knopf (`StoryHeader`,
  `onHilfe`). Die drei Erklärzeilen oben sind weg.
- **Hinweis (`StoryHinweis`, Paket):** ⓘ, Titel, Text, Zusatzzeile
  „Erscheint nur beim ersten Besuch …“, Knopf „Verstanden ✕“. Die App
  (`useStoryHinweis`, Jotai-Atom + `localStorage` `story-hinweis-gesehen`)
  zeigt ihn beim ersten Besuch, „Verstanden“ merkt es im Browser, „?“ holt
  ihn zurück. Texte: `publicPublishing.story.headline/intro` der Library,
  sonst `story.hinweis.titel` bzw. `gallery.storyMode.description`. Das Feld
  `story.subtitle` wird nicht mehr angezeigt.
- **Mitte (`StoryUebersicht`):** kein Kopf des Inhalts mehr; oben der
  Hinweis-Slot, dann Kennzahlen mit „neu berechnen“ rechts, dann die
  Themenzeile „7 Themen · wähle eines“ (`story.uebersicht.themenzeile`,
  Konfig `topicsTitle` ersetzt sie, `topicsIntro` ergänzt) und die Karten.
  Titel und Einleitung des Sprachmodells werden nicht mehr angezeigt.
- **Paket-API:** `StoryRoot.kopf` ist jetzt optional und trägt nur
  `themenTitel`/`themenIntro` (`StoryKopf`); neuer Slot `uebersichtHinweis`.
  `StoryHinweis` exportiert.
- **Embed:** `EmbedStoryKopfzeile` bekommt Label und Beschreibung der
  Library als Überschrift und Einleitung — der Kopf wandert auch dort nach
  oben. Kein Hinweis im Embed (kein „?“-Knopf; später opt-in).
- Übersetzungen de/en/it/es/fr. Belege: `story-mitte.test.tsx` (angepasst),
  `story-root.test.tsx`, `story-root-mount.test.tsx` (Hinweis, Verstanden),
  `story-hinweis.test.tsx`, `use-story-hinweis.test.tsx`; tsc-Vergleich
  leer, Lint 0 Fehler.

**D10b (Owner-Rückmeldung 02.10. nach dem Live-Blick auf D10):** „Gar kein
Titel mehr in der Mitte, das war vorher besser“ und „die Hilfe gehört in eine
Ansichtszeile über den Knöpfen, gleich für Galerie und Story“. Figma
„Schritt 7 · Kopf für beide Ansichten“ (Node `23-2`, vier Köpfe: Galerie und
Story, Erklärung zu und auf), abgenommen mit der Auflage, dass das Einklappen
ohne Lesen erkennbar ist (runder Pfeil nach oben im Kasten).

Was seit D10b steht (ersetzt den Hinweis in der Mitte und den „?“-Knopf):

- **`AnsichtsZeile` + `useAnsichtErklaerung` (`@ks/ui`, generisch):** links
  der Name der Ansicht mit rundem ⓘ-Knopf, rechts die Werkzeuge; ⓘ klappt die
  Erklärung der Ansicht darunter auf, im Kasten rechts oben klappt ein
  runder Pfeil sie ein. Beim ersten Besuch offen, der Browser merkt sich „zu“
  je Ansicht (`ansicht-erklaerung-zu:<ansicht>`). Beim Scrollen bleibt die
  Zeile, die Erklärung geht zu.
- **Galerie-Kopf (`GalleryStickyHeader`):** Kopf der Seite = `publicName`
  (sonst Label) und `publicPublishing.description`; Ansichtszeile „Inhalte
  erkunden“ mit Suche, Ansichtswahl, Aktionen; Erklärung aus
  `publicPublishing.gallery.headline/description` (sonst Übersetzung
  `gallery.texts.*`). `gallery.subtitle` wird nicht mehr angezeigt.
- **Story-Kopf (`StoryModeHeader`, App) und `StoryKopfzeile` (Embed):**
  gleicher Kopf der Seite; Ansichtszeile „Story-Modus“ mit Zurück,
  Perspektive anpassen, Plaketten; Erklärung aus `story.headline/intro`
  (sonst Übersetzung). `story.subtitle` wird nicht mehr angezeigt.
- **Mitte (`StoryUebersicht`):** Titel und Einleitung des Sprachmodells
  stehen wieder vor den Karten (h2 + Absatz), darunter die Themenzeile
  „7 Themen · wähle eines“ (h3). Kein Hinweis-Slot mehr; `StoryHinweis` und
  `useStoryHinweis` sind weg.
- **Plaketten (`PerspectiveDisplay` header, Owner 02.10.: Platz ist
  wertvoll):** nur Gesetztes — „nicht spezifiziert“ fällt weg, die Sprache
  nur, wenn sie von der Oberflächensprache abweicht (`resolveTargetLanguage`
  gegen `locale`). Die Inline-Variante unter der Antwort zeigt weiter alles.
- Übersetzungen: neuer Block `ansicht.*` (de/en/it/es/fr), `story.hinweis.*`
  entfernt. Belege: `ansichts-zeile.test.tsx`,
  `use-ansicht-erklaerung.test.tsx`, `perspective-display-plaketten.test.tsx`
  (D10b-Regeln), `story-mitte.test.tsx` (Kopf der Gliederung zurück); tsc-
  Vergleich leer, Lint 0 Fehler.

**D10c (Owner 02.10., Startansicht):** „Links scheint der erste Eintrag von
„Meine Fragen“ selektiert zu sein, obwohl in der Mitte die Themenübersicht
steht — irreführend. Der sollte am Anfang zugeklappt und nicht selektiert
sein.“ Ursache: Die Chronik hob die aktive Sitzung (gemerkte Kennung aus dem
Browser) hervor und klappte sie auf, unabhängig davon, was in der Mitte
steht. Seit D10c ist eine Sitzung nur hervorgehoben und von selbst offen,
wenn eine ihrer Fragen in der Mitte steht oder gerade läuft
(`istHervorgehoben` in `sitzungen-liste.tsx`, `istGewaehlt` aus
`sitzung-eintrag.tsx`); die aktive Sitzung bleibt im Hintergrund die, in der
die nächste Frage landet. Von Hand Auf- und Zuklappen geht weiter. Beleg:
`story-chronik.test.tsx` (Einstieg zu und unmarkiert, Auswahl klappt auf).

**D10d (Owner 02.10., Testplan Schritt 5, „bitte bessere Fehlermeldung“):**
Ohne laufenden Secretary stand unter der Konversation die technische
Meldung „Secretary Service nicht erreichbar (http://127.0.0.1:5001/api/rag/
embed-text) … fetch failed“. Seit D10d gibt der Stream dem `error`-Schritt
eine Kennung (`code: 'dienst_nicht_erreichbar'`, Vertrag `StoryFehlerCode`
in `@ks/contracts`), wenn der Secretary nicht antwortet. Die Oberfläche
zeigt dann Klartext („Die Antwort kann gerade nicht erstellt werden: Der
Sprachdienst ist nicht erreichbar. Bitte in ein paar Minuten noch einmal
versuchen.“, `story.fehler.dienstNichtErreichbar`, de/en/it/es/fr) und die
technische Meldung klein darunter als „Technische Angabe“ — nichts
verschwindet. Unbekannte Fehler bleiben wie bisher (`fehlerText`). Beleg:
`use-story-stream.test.tsx` (Kennung → Klartext + Detail). Weitere Kennungen
(Modell fehlt, Schlüssel ungültig) folgen bei Bedarf nach demselben Muster.

**D11a (Owner 02.10., „der Knopf oben stört“):** „Übersicht neu berechnen“
stand als Knopf in der Mitte neben den Kennzahlen. Jetzt steht er als
dezentes Symbol (Pfeilkreis, beim Rechnen Spinner) rechts in der
Chronik-Zeile „Themenübersicht“, mit Tooltip „Themenübersicht neu berechnen“
(`story.recompute`, de/en/it/es/fr). Technik: `StoryRoot` stellt die Aktion
über `storyUebersichtAktionAtom` bereit (`null` ohne Gliederung), die
Chronik (`Gliederung`) zeigt den Knopf nur dann. Die Mitte beginnt damit
direkt mit den Kennzahlen. Beleg: `story-chronik.test.tsx` (Knopf erscheint
mit der Aktion, ruft sie, ist beim Rechnen gesperrt).

**Neu dazugekommen (Owner 02.10., noch Konzept):**

- **Quellenverzeichnis rechts** nimmt ungefragt Platz; Wunsch: anders
  formatieren und als „fliegendes Verzeichnis“ einblenden, wenn es jemand
  braucht. Vorschlag: rechte Spalte einklappbar auf eine schmale Leiste mit
  „Quellen (610)“ bzw. „Belege (4)“, Aufklappen als Spalte (Desktop) oder
  Sheet (mobil, gibt es seit D4); nach einer Antwort kurz aufmerksam machen
  (Zähler), nicht aufdrängen. Figma zuerst (D11b).
- **KI-Hinweis für Laien** (Owner 02.10., Variante 2 gewählt): Antwort
  „Eine KI hat die Antwort aus den Quellen rechts zusammengestellt. Die
  Quellen kannst du dort nachlesen.“, Übersicht „Eine KI hat diese Übersicht
  aus den Quellen rechts erstellt. …“ (`common.aiGenerated.contentAutoGenerated`
  / `overviewGenerated`, de/en/it/es/fr; `AIGeneratedNotice variant`).
  Gebaut 02.10. auf dem D11b-Branch.
- **Rand unten (Owner 02.10., „die Anwendung ist nicht voll nutzbar“):**
  `useGalleryMode` rechnete die Rahmenhöhe aus Fensterhöhe minus Navigation
  minus pauschal 115 px (mobil 70) — je nach Kopf blieben bis zu 90 px
  ungenutzt. Jetzt ab der tatsächlichen Oberkante des Rahmens, unten nur der
  Innenabstand der Seite (Desktop gemessen: 981 statt 894 px Höhe). Gebaut
  02.10. auf dem D11b-Branch.
- **D11b Quellen als fliegendes Verzeichnis:** Figma „Schritt 8“ (Node
  `27-557`): 8a Einstieg mit eingeklappter Leiste (56 px, Pfeil, Symbol,
  „610 Quellen“), 8b Antwort mit aufgeklappten Belegen (Chip „Belege · 4“,
  Pfeil › klappt ein), 8c Antwort eingeklappt mit blauem Zähler „4“ auf der
  Leiste. Browser merkt sich auf/zu; mobil bleibt das Blatt aus D4.
  Abgenommen und gebaut 02.10.: `QuellenLeiste` + `useQuellenOffen`
  (`story-quellen-offen`, Einstieg zu) in `quellen-leiste.tsx`;
  `StorySpalten` bekommt `leiste` (ohne Angabe wie bisher, Embed) und
  rendert zu die Leiste (Zähler = Belege der Antwort, blau, sonst Quellen
  im Bestand) statt der Spalte, auf die Spalte mit Pfeil zum Einklappen;
  Owner-Korrektur nach dem ersten Live-Blick: Die Quellen legen sich als
  **Schicht** über den rechten Teil der Mitte (480 px, max. 55 %), die
  Breiten von Chronik und Mitte ändern sich dabei nicht (die Leiste bleibt
  unsichtbar stehen); zugeklappt ist die Chronik breiter (22 % statt 15 %),
  damit die Fragen lesbar sind. Eigene Breiten-Schlüssel
  `story-spalten-fliegend-*`; ohne `leiste` (Embed) die alte Dreiteilung.
  Beleg: `story-spalten.test.tsx`; live: Chronik 260 px und Mitte 923 px vor
  und nach dem Aufklappen identisch, keine neuen Aufrufe. Übersetzungen
  `story.leiste.*`.

### Stand D12a (gebaut 02.10.2026, Cloud) — Übersichts-Log lesbar für alle

Befund aus dem lokalen Test (Schritt 2, „Keine Konfiguration gefunden“,
`GET …/queries/<Übersichts-Query>` → 404): `getQueryLogById` band jedes Log
an `userEmail` bzw. `sessionId`, der Übersichts-Cache ist aber
benutzerübergreifend (Hash + Library) — der `complete`-Schritt trägt deshalb
oft die Kennung eines Logs, das eine andere Person angelegt hat.

Was steht:

- **Regel in `src/lib/db/query-log-zugriff.ts`** (`logFuerLeser`): Eigene
  Logs (E-Mail bzw. anonyme Sitzung) wie bisher; ein `toc`-Log ist innerhalb
  seiner Library für alle lesbar, kommt aber **ohne `userEmail` und
  `sessionId` des Erstellers**, wenn es nicht das eigene ist. Fremde Fragen
  bleiben unsichtbar. Ohne Leser-Kennung wirft die Regel wie bisher.
- `getQueryLogById` sucht nach `queryId` + `libraryId` und legt die Regel an;
  die Routen `GET`/`DELETE …/queries/<id>` sind unverändert. Folge für
  `DELETE` einer fremden Übersicht: 403 statt 404 (das Log existiert, gehört
  aber nicht der Person) — gewollt.
- Beleg: `tests/unit/chat/query-log-zugriff.test.ts`; tsc-Vergleich leer,
  Lint 0 Fehler. Kein Live-Nachweis (Cloud-Session ohne DB und Secretary) —
  im nächsten lokalen Test Schritt 2 prüfen: Konfig-Anzeige unter der
  Übersicht steht, Netz `GET …/queries/<id>` → 200.

### Stand D12b (gebaut 02.10.2026, Cloud) — Cache-Treffer einer Frage im eigenen Verlauf

Befund aus dem Schreibtischtest (Cloud, am Code): Trifft eine Frage den
benutzerübergreifenden Antwort-Cache (Hash + Library), schickte die
Stream-Route die Kennung des **fremden** Logs im `complete`-Schritt und
legte für die Person nichts an — der Chat wurde angelegt oder berührt, das
Query-Log nicht. Folgen in der Fragen-Chronik: Die Frage fehlte nach dem
Neuladen im Verlauf der Sitzung (`GET …/queries?chatId=` filtert nach
Person), `?q=<id>` lief auf 404, ebenso Konfig-Anzeige, Protokoll und Debug
unter der Antwort; eine mit dieser Frage eröffnete Sitzung stand ohne Frage
in der Chronik. Trifft vor allem die vorgeschlagenen Fragen der Themenseite,
die mehrere Personen wortgleich stellen. Vor D1 unsichtbar, weil der alte
App-Chat den Verlauf aus dem Browser nahm.

Was steht:

- **`src/lib/chat/cache-treffer-log.ts`** (`eigenesLogFuerCacheTreffer`):
  legt über `startQueryLog` ein Frage-Log im Rahmen der Person an (Sitzung,
  Perspektive, Filter, Modell, Dokumentenzahl — dieselben Felder wie beim
  regulären Lauf), hängt einen `cache_check`-Schritt mit der Kennung des
  Treffers an und setzt Antwort, Belege, Vorschläge, Kurztitel (nur wenn
  vorhanden) und die Cache-Schritte als Protokoll, Status `ok`. Der
  Cache-Hash entsteht wie immer in `insertQueryLog`; das eigene Log ist damit
  selbst ein gültiger Treffer für die nächste gleiche Frage.
- **Stream-Route:** Im Treffer-Zweig bekommt eine Frage (nicht die
  Übersicht, D8/D12a) das eigene Log; `cache_check_complete` und `complete`
  tragen die eigene Kennung, `cachedQueryId` weiter die des Treffers.
  `effectiveTargetLanguageForLog` steht jetzt vor dem Cache-Check. Der
  Sitzungstitel aus dem Kurztitel des Treffers (D6) bleibt wie er war.
- Belege: `tests/unit/chat/cache-treffer-log.test.ts`; tsc-Vergleich leer,
  Lint 0 Fehler. Kein Live-Nachweis — im nächsten lokalen Test: dieselbe
  Frage zweimal in zwei Sitzungen stellen; die zweite Antwort kommt aus dem
  Cache, die Frage steht nach dem Neuladen trotzdem in der Chronik, `?q=`
  und Debug zeigen das eigene Log mit `cachedQueryId`.

### Stand D12c (gebaut 02.10.2026, Cloud) — Verlauf beim Sitzungswechsel

Befund aus dem Schreibtischtest (Schritte 10, 11, 12, 16): `useStoryVerlauf`
leerte die Nachrichten nur beim Wechsel auf `null` („Neue Sitzung“). Beim
Wechsel von Sitzung A nach B (Chronik-Klick, `?q=` aus anderer Sitzung,
Zurück-Knopf) mischte `verlaufMischen` die Nachrichten von A unter B: Die
Chronik listete unter B auch die Fragen von A, und die nächste Frage schickte
Paare aus A als `chatHistory` an das Sprachmodell.

Was steht: Beim Wechsel auf eine andere Kennung fallen die gespeicherten
Nachrichten (mit `queryId`) weg; Lokales ohne Kennung (eine gerade laufende
Frage) bleibt. Von `null` auf die erste Kennung (die erste Frage hat die
Sitzung eröffnet) bleibt alles stehen — sonst flackerte die eröffnende
Frage, bis der Verlauf geladen ist. Beleg: `use-story-verlauf.test.tsx`
(A→B, `null`→erste Kennung); tsc-Vergleich leer, Lint 0 Fehler.

### Stand D12d (gebaut 02.10.2026, Cloud) — „Neu berechnen“ bleibt stehen

Befund aus dem Schreibtischtest (Schritt 18): Die Aktion „Themenübersicht
neu berechnen“ (D11a) hing an der Gliederung; `uebersichtNeu` setzte die
Gliederung sofort auf `null`, damit verschwand der Knopf während der
Neuberechnung (kein Spinner) und nach einem Fehler ganz — ohne Weg zum
erneuten Versuch außer Neuladen. Während einer Frage zeigte er den
irreführenden Hinweis „Neuberechnung …“.

Was steht: `StoryRoot` stellt die Aktion bereit, sobald eine Übersicht
möglich ist (Dokumente und Modell), unabhängig von der Gliederung.
`laeuft` meint jetzt nur die Neuberechnung der Übersicht (Spinner,
Hinweis), neu `gesperrt` sperrt den Knopf, solange eine Frage läuft
(`UebersichtAktion` in `@ks/module-story`). Belege: `story-root.test.tsx`
(Aktion bleibt mit Spinner während der Neuberechnung, zweite Anfrage mit
`skipQueryCache`; ohne Dokumente keine Aktion), `story-chronik.test.tsx`
(gesperrt ohne Spinner); tsc-Vergleich leer, Lint 0 Fehler.

### Stand D12e (gebaut 02.10.2026, Cloud) — Belege folgen der Auswahl, Markenklick öffnet die Quellen

Befund aus dem Schreibtischtest (Schritte 6, 7, 12, 13, 14, 21):
`chatReferencesAtom` wurde nur aus dem Stream gesetzt (`onBelege` bei einer
frischen Antwort). Jede über Chronik, `?q=` oder Zurück-Knopf gewählte
ältere Antwort ließ rechts die Belege der zuletzt frisch beantworteten Frage
stehen; „Neue Sitzung“ und Löschen ließen sie ebenfalls stehen. Dazu: Seit
D11b steht die Belegliste nur im DOM, wenn die Quellen-Schicht offen ist —
der Klick auf eine Zitatmarke fand bei zugeklappter Schicht keine Karte und
tat nichts (nur `console.warn`). Bei alten Antworten (Nummern je Textstelle)
trug eine Karte nur den Anker der ersten Nummer.

Was steht:

- **Belege folgen der gezeigten Antwort** (`useStoryKonversation`): ein
  Effekt auf Auswahl und Nachrichten meldet `onBelege(belege, queryId)` der
  gezeigten Antwort; Übersicht, Themenseite und eine noch laufende Frage
  melden leer (`[]`, `null`) — rechts steht dann der Katalog (Figma
  Schritt 5: „leer bis Antwort“). Der Stream-Hook meldet nicht mehr selbst.
  `StoryRoot.onBelege` bekommt `queryId: string | null`; App-Montage und
  Embed setzen `undefined` ins Atom.
- **Markenklick öffnet die Schicht:** Findet `AntwortText` keine Karte,
  sendet es `STORY_BELEG_ZEIGEN_EVENT` (`@ks/contracts`, mit `marke`).
  `useBelegSprung` (`@ks/module-explorer`, in `GalleryRoot`) öffnet die
  Quellen (`useQuellenOffen.oeffnen`, merkt „auf“) und scrollt zur Karte,
  sobald sie gerendert ist; ohne Karte (Mobil, alte Antwort ohne diese Marke)
  eine Warnung, kein Schweigen.
- **Anker je Nummer:** `BelegKarte` rendert für weitere Nummern desselben
  Dokuments unsichtbare Anker `#beleg-n`.
- Belege: `story-root.test.tsx` (Übersicht leer → Antwort → Übersicht leer →
  Konversation wieder voll), `antwort-text.test.tsx` (Ereignis statt
  Warnung), `story-spalten.test.tsx` (`oeffnen`, `useBelegSprung`),
  `beleg-liste.test.tsx` (Anker je Nummer); Paket-Tests 183 grün,
  tsc-Vergleich leer, Lint 0 Fehler. Kein Live-Nachweis — lokal Schritte 6,
  7, 12: Marke klicken bei zugeklappten Quellen, ältere Antwort wählen.

Neu dazugekommen (Schreibtischtest Cloud 02.10., am Code belegt, nicht
gebaut):

- **Schritt 14, letzte Frage löschen:** `DELETE …/queries/<id>` löscht nur
  das Log; der Chat bleibt leer mit dem Kurztitel der gelöschten Frage, die
  nächste Frage landet darin und behält den alten Titel
  (`sitzungstitelAusDieserFrage` ist dann `false`). Vorschlag: Route oder
  Hook löscht einen leer gewordenen Chat mit, oder die Stream-Route benennt
  einen Chat ohne Fragen wie einen neuen.
- **Schritt 12, Fragenliste veraltet:** `useStorySitzungen.fragenLaden`
  lädt je Sitzung nur einmal (`geladeneFragen`); eine einmal aufgeklappte
  Sitzung, die danach aktiv war und Fragen bekam oder verlor, zeigt nach dem
  Zurückwechseln die alte Liste. Vorschlag: beim Wechsel der aktiven Sitzung
  die vorherige aus `geladeneFragen` streichen.
- **Schritt 21, Zähler der Leiste:** `chatReferences.references.length`
  zählt bei alten Antworten Textstellen statt Dokumente. Vorschlag: Zähler
  aus den gebündelten Belegen (`belegeAusReferenzen`) nehmen.
- **Mobil (< lg), Markenklick:** Die Belege liegen im Blatt (D4);
  `useBelegSprung` öffnet die Desktop-Schicht, die dort nicht gerendert ist
  (Warnung). Vorschlag: auf Mobil das Ereignis `show-reference-legend`
  auslösen.
- **Konfig-Felder ohne Anzeige** (`gallery.subtitle`, `story.subtitle`,
  seit D10b) und **D6d** (toter App-Chat) warten weiter auf den Owner.

### Stand D12f (gebaut 03.10.2026, Cloud) — Letzte Frage löschen räumt die Sitzung weg

Befund (Schreibtischtest, Schritt 14): `DELETE …/queries/<id>` löschte nur
das Log; der Chat blieb leer mit dem Kurztitel der gelöschten Frage stehen,
die nächste Frage landete darin und behielt den alten Titel.

Was steht: `frageLoeschen` (`useStoryKonversation`) löscht nach der letzten
gespeicherten Frage auch die Sitzung (`DELETE …/chats/<chatId>`), setzt die
aktive Sitzung auf `null` (die nächste Frage eröffnet eine neue, mit eigenem
Titel) und erhöht `storySitzungenStandAtom`; `useStorySitzungen` lädt die
Liste bei jedem neuen Stand neu, die Chronik zeigt die Sitzung nicht mehr.
Ein Fehler beim Löschen der Sitzung bleibt sichtbar. Belege:
`story-root.test.tsx` (zweiter DELETE auf die Sitzung, Kennung leer, Stand
1), `use-story-sitzungen.test.tsx` (neuer Stand lädt neu); tsc-Vergleich
leer, Lint 0 Fehler.

### Stand D12g (gebaut 03.10.2026, Cloud) — Fragenliste der verlassenen Sitzung

Befund (Schreibtischtest, Schritt 12): `useStorySitzungen.fragenLaden` lud
je Sitzung nur einmal (`geladeneFragen`); eine einmal aufgeklappte Sitzung,
die danach aktiv war und Fragen bekam oder verlor, zeigte nach dem
Zurückwechseln die alte Liste.

Was steht: Die Chronik reicht die live gesehenen Fragen der aktiven Sitzung
an `useStorySitzungen` (`aktiveFragen`). Beim Wechsel der aktiven Sitzung
behält die verlassene Sitzung diesen Stand (nur gespeicherte Fragen, keine
als „läuft“) und fällt aus dem Lade-Cache — das nächste Aufklappen holt den
Stand vom Server. Beleg: `use-story-sitzungen.test.tsx` (Stand bleibt, dann
neu geladen); `story-chronik.test.tsx` unverändert grün; tsc-Vergleich leer,
Lint 0 Fehler.

### Stand D12h (gebaut 03.10.2026, Cloud) — Zähler der Quellen-Leiste

Befund (Schreibtischtest, Schritt 21): Der blaue Zähler der eingeklappten
Leiste nahm `references.length`; alte Antworten (vor D7) nummerieren je
Textstelle, der Zähler zeigte dann Textstellen statt Dokumente — die
aufgeklappte Liste sagt „n Belege“ je Dokument.

Was steht: `anzahlBelegDokumente` (`beleg-liste/helpers.ts`) zählt die
verschiedenen `fileId`s; `GalleryRoot` gibt diese Zahl an die Leiste. Beleg:
`beleg-liste.test.tsx`; tsc-Vergleich leer, Lint 0 Fehler.

### Stand D12i (gebaut 03.10.2026, Cloud) — Markenklick auf Mobil

Befund (Schreibtischtest, Schritt 6 mobil): `useBelegSprung` (D12e) öffnete
immer die Desktop-Schicht; unter `lg` liegen die Belege im Blatt (D4), die
Schicht ist dort nicht gerendert — der Klick auf eine Zitatmarke warnte nur.

Was steht: `useBelegSprung` nimmt ein Ziel (`offen`, `oeffnen`); `GalleryRoot`
reicht auf Mobil das Belege-Blatt herein (öffnet es im Modus „answer“ mit
den Belegen der gezeigten Antwort), am Desktop wie bisher die Schicht. Der
Sprung scrollt, sobald das Ziel offen ist und die Karte im DOM steht. Beleg:
`story-spalten.test.tsx` (beliebiges Ziel); tsc-Vergleich leer, Lint 0 Fehler.

Damit sind die vier Befunde aus dem Schreibtischtest (D12e „Neu
dazugekommen“) gebaut: Schritt 14 (D12f), Schritt 12 (D12g), Schritt 21
(D12h), Mobil (D12i). Offen bleiben die Owner-Entscheide D6d und
`gallery.subtitle`/`story.subtitle` sowie der Live-Nachweis aller Wellen.

## Offene Punkte aus dem Designkonzept (01.10.)

- **Zustimmungsbalken** („Ø 78 % Konsens“): Dafür gibt es heute kein Feld. Die
  Klimamaßnahmen haben `lv_bewertung` und Score-Felder, aber keinen
  Konsenswert. Entweder aus vorhandenen Feldern ableiten (z. B. Anteil „in
  Umsetzung“ unter den Belegen) oder weglassen.
- **Status-Plakette am Beleg:** aus `lv_bewertung` abbildbar (in_umsetzung,
  nicht_umsetzbar, neu_umsetzbar, vertieft_pruefen …). Zuordnung auf vier
  Plaketten in D3 festgelegt (siehe Stand D3, Registry `belegKarte`).
- **Kurztext je Beleg:** vorhanden (Beschreibung des Vorschlags). „Original
  ansehen“ öffnet die Detailansicht.
- **Zusammenfassung je Thema:** gibt es nur als Kurzbeschreibung aus der
  Themenübersicht. Zähler je Thema (Dokumente) brauchen eine Zuordnung
  Thema → Dokumente, die die Themenübersicht heute nicht liefert; bis dahin
  nur „n Fragen“.
- **„Ich lese die passenden Vorschläge …“:** Verarbeitungsschritte in
  einfachen Worten statt Technikbegriffen (Cache, Retriever, Chunks). Kleiner
  eigener Schritt in D2.

## Entscheidungen (Owner, 01.10.2026)

1. Figma: Team Crystal Design GmbH. Klickmodell D0 angelegt am 01.10.2026: https://www.figma.com/design/RNJEZjUXPpNzrTYwEMEa2w — massgeblich ist die Seite „Klickmodell D0 v3 (Sitzungen, plakativ) · MASSGEBLICH“ (vier Schritte mit Erklaertext, Flows „Desktop v3“ und „Mobil v3“; Startseite seit dem Abend mit Kopf des gesamten Inhalts). v1, v2 und v4 bleiben zum Vergleich; v4 (Uebersicht als Lesetext ohne Themenwahl) hat der Owner verworfen, weil die Orientierung links fehlt.
2. Spaltenbreiten per Ziehen veraenderbar (wie im Archiv, react-resizable-panels), 15 / 50 / 35 als Startwerte, Stand im localStorage.
3. Die Chronik zeigt auch fruehere Sitzungen (Chats) der Person in dieser Library. Anonyme Chats sind heute schon gespeichert: Der Browser bekommt eine Sitzungskennung im localStorage (30 Tage, packages/api-client anonymous-session.ts), die Chats liegen in MongoDB unter dieser Kennung (chats-repo, Index libraryId+sessionId). Grenze: anderer Browser oder anderes Geraet = neue Kennung, die alte Chronik ist dann nicht erreichbar; nach 30 Tagen ohne Besuch ebenso. Angemeldete haengen an der E-Mail und sehen alles geraeteuebergreifend.
4. Kurztitel in der Antwortsprache (Zielsprache der Perspektive).

## Vorher offene Fragen (beantwortet, zur Nachvollziehbarkeit)

1. Figma-Team und Datei für D0.
2. Verhältnis 15 / 50 / 35 fest oder per Ziehen veränderbar (Panels sind im
   Archiv schon ziehbar, `react-resizable-panels`).
3. Soll die Chronik auch alte Chats (frühere Sitzungen) zeigen oder nur den
   aktiven Chat?
4. Kurztitel in der Zielsprache der Antwort oder in der Anwendungssprache?

## Ausblick: mehrere Libraries gemeinsam befragen (Owner-Frage 01.10., nicht Teil dieser Wellen)

Wunsch: Beim Einstieg in den Story-Modus wählen, welche Libraries gemeinsam
befragt werden (Häkchen oder „alle“). Themenübersicht, Antworten und Belege
entstehen dann über die gewählte Menge.

- **Benennung:** Vorschlag „Wissensquellen“ für die Auswahl (Knopf im
  Story-Kopf „Wissensquellen: Klimamaßnahmen + 2 weitere“, Dialog mit
  Häkchen). Nicht „Libraries zusammenführen“: Es wird nichts zusammengeführt,
  sondern gemeinsam befragt; die Libraries bleiben getrennt.
- **Figma:** Bildschirm „5 · Perspektive mit Wissensquellen“ auf der
  maßgeblichen v3-Seite (Häkchenliste mit Primärquelle, freigegebenen und
  gesperrten Sammlungen; Plakette „Wissensquellen“ im Story-Kopf der vier
  Schritte führt dorthin).
- **Ort in der Oberfläche:** eigener Schritt auf der Perspektive-Seite
  (Sprache, Modell, Interessen, Wissensquellen) und als Plakette im
  Story-Kopf neben Sprache und Interessen. Die Auswahl ist Teil der Sitzung
  und steht in der URL, damit ein Link sie mitträgt.
- **Grundlage:** ADR 0009 (Föderation: Primär-Library plus föderierte
  Libraries mit Rolle; Einwilligung der Quell-Library; Brücken read-only).
  Die Auswahl zeigt nur Libraries, die die Site bindet und die der Person
  erlaubt sind.
- **Technik, grob:** Jede Library hat ihre eigene Vektor-Sammlung. Der
  Retriever fragt alle gewählten Sammlungen an, nimmt je Library die besten
  Treffer und mischt sie nach Treffergüte; jeder Beleg trägt seine Library
  (Plakette an der Karte, Link führt in die richtige Detailansicht). Der
  Cache-Schlüssel enthält die sortierte Library-Menge, sonst vermischen sich
  Antworten. Die Themenübersicht wird je Library-Menge einmal berechnet und
  zwischengespeichert. Facetten rechts: Schnittmenge der gemeinsamen Felder
  (Regel aus facet-scope), plus Facette „Library“.
- **Offen:** eine Sitzung mit wechselnder Library-Menge oder je Menge eine
  Sitzung; Kosten (n Libraries = n Vektor-Suchen je Frage; Prod-Atlas ist
  RAM-gebunden); Sprache und Perspektive gelten für alle gewählten Libraries.

## Nicht in diesem Plan

- Antwortsprache folgt der Weltkugel (offene Frage aus dem Test vom 29.09.).
- Archiv-Fehler nach Sprachwahl (nicht reproduziert).
- Story und Chat im Embed (`@ks/embed`), siehe STAND.md.
