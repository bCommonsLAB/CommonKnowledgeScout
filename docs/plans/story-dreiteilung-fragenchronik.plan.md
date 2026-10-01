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
    content: "Mobil (unter lg): Chronik als Sheet hinter einem Menü-Knopf im Story-Kopf; Mitte füllt den Schirm; Quellen wie heute als Overlay. Keine doppelten Mounts (Lehre aus M4h)."
    status: pending
  - id: d5-kurztitel-llm
    content: "Kurztitel (zwei bis vier Worte) aus derselben LLM-Antwort wie die Antwort selbst (Prompt-Erweiterung im Orchestrator, Feld shortTitle im QueryLog, Sprache = Zielsprache). Heuristik aus D1 bleibt Fallback für alte Einträge."
    status: pending
  - id: d7-zitatmarken
    content: "Zitatmarken je Dokument statt je Textstelle: Belege nach fileId gruppieren, Kreiszahlen im Text = Karte rechts, DocReference um passages (chunkIndex, page, excerpt) erweitern, Seitenzahl je Chunk beim Einlesen speichern + Backfill, Tooltip mit Seiten und Zitaten, Sprung in die Detailansicht auf die Seite."
    status: pending
  - id: d6-aufraeumen
    content: "chat-panel.tsx entflechten (1.220 Zeilen): Chronik, Mitte und Quellen als eigene Komponenten unter 200 Zeilen im Paket; StoryRoot in @ks/embed montieren; alte Zweiteilung entfernen; welle-3-iii-galerie-chat-contracts und STAND.md nachziehen."
    status: pending
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
| D4 | Mobil: Chronik im Sheet | Browser-Pane mobil, keine Doppel-Mounts |
| D5 | Kurztitel aus dem LLM, Feld `shortTitle` | Live: neue Frage bekommt treffenden Titel in der Zielsprache |
| D6 | Entflechten und Doku | `chat-panel.tsx` unter 400 Zeilen, Teile unter 200 |

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
