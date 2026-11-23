---
name: teppich-der-dokumente
overview: "Hinter der Fragen-Sektion der Website liegt der Teppich der Dokumente: jedes Dokument der Library als Punkt an seinem festen Platz. Beim Fragen lösen sich die Punkte und schwärmen, die zitierten fliegen als Belege neben die Antwort, alle anderen zurück. Der Hintergrund zeigt, woher eine Antwort kommt."
status: entwurf
todos:
  - id: t0-entscheide
    content: "T0 Owner-Entscheide E1–E5 am 22.11.2026 getroffen (Abschnitt 7); E6 (Obergrenze auf dem Telefon) folgt nach der Messung in T2."
    status: completed
  - id: t0b-buehne-ausbauen
    content: "T0b Common-UX-Bühne ausbauen, vor T1 (Owner 22.11.2026): Player-Bündel, Bühnen-Ebene der App, Schalter `stageEnabled` in Formular, Brücke und Lese-Routen. GEBAUT 22.11.2026 (Brücke 2.79.0); das Skript `scripts/remove-stage-enabled.ts` muss noch in Dev und Prod laufen."
    status: completed
  - id: t1-plaetze
    content: "T1 Feste Plätze: Auftrag berechnet und speichert die Lage je Dokument; schlanke, anonym lesbare Punkte-Abfrage. GEBAUT 22.11.2026 (`phase-doc-teppich`, `GET /api/chat/<id>/teppich`, Brücke `teppich_berechnen` 2.80.0); Lauf an einer echten Library offen."
    status: completed
  - id: t2-hintergrund
    content: "T2 Hintergrund in Ruhe: Canvas-Baustein im Paket, über den Gastgeber montiert; Schweben, Tooltip, Klick blendet den Vordergrund aus; Schalter je Library. GEBAUT 22.11.2026 (Brücke 2.81.0, `carpetEnabled`); Linien zu verwandten Dokumenten nach T3 verschoben; Ansicht an einer echten Library und Messung der Bilder je Sekunde offen."
    status: completed
  - id: t3-ablauf
    content: "T3 Frage und Antwort: Vordergrund weicht beim Rechnen, Schwarm mit Mindestdauer, Belege fliegen rechts neben den Text, Faden mit Nummern, Ringe am festen Platz; Fragenbox am unteren Rand. GEBAUT 22.11.2026 ohne Fragenbox und ohne Linien beim Überfahren; Ziel ist `cards=column` statt eines neuen Werts; in Dev angesehen."
    status: completed
  - id: t4-stufen
    content: "T4 Suchstufen: Meldungen der Suche tragen die Kennungen der Dokumente; Kandidaten, Auswahl, Belege ziehen in Räume nach innen. GEBAUT 22.11.2026 mit zwei Stufen (Auswahl der Suche, zitierte Belege); in Dev angesehen."
    status: completed
---

# Teppich der Dokumente

> **Stand 22.11.2026, Entwurf.** Entstanden aus der Analyse „Tausende Dokumente interaktiv
> zeigen" und einem Klickmodell. Das Klickmodell liegt als eine Datei bei diesem Plan:
> [`assets/teppich-der-dokumente-prototyp.html`](assets/teppich-der-dokumente-prototyp.html)
> (erfundene Daten, 1.000 bis 20.000 Punkte, im Browser zu öffnen). Es ist die Vorlage für
> Aussehen und Ablauf, nicht für den Code. Vorbild der Mechanik ist der Teppich der Artefakte
> im Repo commoning-methods (Ausleihe, Schwarm, inszenierte Suche).

## 1. Ziel

Auf einer Website-Seite mit Sektion `layout=story` liegt hinter der Seite der Teppich.

- **Ruhe:** Jedes Dokument der Library ist ein Punkt an seinem festen Platz. Die Punkte
  schweben leicht, eine langsame Welle läuft durch. Der Vordergrund bleibt sachlich wie heute.
- **Frage:** Der Vordergrund weicht. Es bleiben die Frage und die Punkte, die sich lösen und
  um den Zeiger schwärmen.
- **Aussieben (T4):** Kandidaten ziehen nach innen, die Auswahl in die Mitte. Gezeichnet
  werden nur Punkte, keine Kreise.
- **Antwort:** Die zitierten Dokumente tragen ihre Nummern und einen Faden. Sie fliegen rechts
  neben den Text und landen neben ihrer Karte, von oben nach unten. Alle anderen fliegen an
  ihren Platz zurück. Dort, wo ein Beleg herkommt, bleibt ein nummerierter Ring.
- **Erkunden:** Über einem Punkt erscheinen Titel und Linien zu verwandten Dokumenten. Ein
  Klick auf eine freie Stelle blendet den Vordergrund aus und wieder ein. Ein Klick auf einen
  Punkt öffnet die vorhandene Detailansicht über der Seite.

Die Aussage dahinter: Belege kommen immer aus dem ganzen Bestand, und jedes Dokument hat
seinen Ort.

Nicht Teil dieses Plans: der Graph-Modus der Galerie (bleibt für kleine Bestände), der volle
Story-Modus (`StoryRoot`), die Themen-Sektion (`layout=topics`).

## 2. Ausgangslage

| Vorhanden | Ort |
|---|---|
| Fragen-Sektion mit Beispielfragen, Eingabe, populären Fragen, jüngstem Paar | `packages/module-website/src/react/website-story-sektion.tsx` |
| Belege als Karten (`cards=column`, `cards=inline`) | `website-story-konversation.tsx`, `story-karten.ts` |
| Detailansicht über der Seite | `WebsiteStoryGastgeber.detail` |
| Anschluss für einen Hintergrund: Sektion meldet Gespräch und Lage der Zitatmarken | `WebsiteStoryGastgeber.buehne`, Plan `commonux-buehne-fragen-sektion`; bleibt in T0b im Paket und wird in T2 zum Anschluss des Teppichs |
| Schalter je Library für die Bühne, voreingestellt aus | `publicPublishing.stageEnabled`; entfällt in T0b |
| Nachbarn je Dokument, gespeichert | `docMetaJson.similarity_neighbors`, `src/lib/graph/similarity-persist.ts` |
| Meldungen der Suche (nur Zahlen) | `packages/contracts/src/chat-processing.ts` |

| Fehlt | Folge |
|---|---|
| Lage je Dokument | ohne festen Platz kein Teppich |
| Abfrage aller Dokumente in schlanker Form | `GET …/docs` liefert ganze Karten, höchstens 500 je Anfrage; der Graph-Modus bricht bei 2.000 ab |
| Kennungen der Dokumente in den Meldungen der Suche | die Stufen sind erst mit der fertigen Antwort bekannt |
| Zeichnen von Tausenden Punkten | die Bühne (Player) und der Graph-Modus zeichnen einzelne Seitenelemente |

## 3. Aufbau

```
Auftrag (external-jobs)        Lese-Route (anonym)             @ks/module-website
phase-doc-teppich      ──▶     GET /api/chat/<id>/teppich ──▶  WebsiteTeppich (Canvas)
  Lage je Dokument               Kennung, Lage, Jahr,            · Ruhe, Schwarm, Flug
  in docMetaJson                 Größe, Kurztitel                · montiert über gastgeber
```

### 3.0 Bühne ausbauen (T0b)

Der Teppich ersetzt die Common-UX-Bühne in KnowledgeScout (E1). Der Ausbau kommt zuerst, als
eigene PR; bis T2 hat die Fragen-Sektion keinen Hintergrund.

- Weg: die Abhängigkeit `@commonux/player` mit ihrem Bündel unter `vendor/`, die Bühnen-Ebene
  der App (`src/components/library/website/buehne/**`), das Symbol „Zur Bühne" mit `?buehne=`,
  der Schalter `publicPublishing.stageEnabled` in Typen, Formular „Öffentlich", Lese-Routen
  und Brücke (`veroeffentlichung_setzen`; `TOOLSET_VERSION` und `NEU_IN_VERSION` nachziehen).
- Geprüft 22.11.: `vendor/` enthielt nur das Player-Bündel, `COPY vendor` im Dockerfile
  diente nur ihm. Ordner und Zeile sind weg. Der Wächter
  `docker-datei-abhaengigkeiten.test.ts` bleibt und prüft jetzt beide Richtungen: jede
  `file:`-Abhängigkeit wird vor dem Install kopiert, und jede COPY-Quelle liegt im Repo.
- Der Schalter „Zur Bühne" und die Messung im Paket (`website-story-buehne.tsx`) bleiben
  bis T2 stehen, sind aber ohne Gastgeber-Feld wirkungslos; die App reicht `buehne` nicht mehr.
- Skript für gespeicherte Schalter: `scripts/remove-stage-enabled.ts` (Probelauf ohne
  `--apply`).
- Bleibt: `gespraechAusStory` und die Messung der Zitatmarken im Paket. T2 braucht beides.
- Ein gespeichertes `stageEnabled: true` wird beim Lesen nicht still übergangen: Der Ausbau
  entfernt das Feld per Skript aus den Library-Konfigurationen und nennt die Zahl.
- Der Player und die Bühne in commoning-methods sind davon nicht berührt.
- Vor dem Merge `pnpm build` lokal, weil ein Paket und das Dockerfile betroffen sind.

### 3.1 Feste Plätze (T1)

- Der Auftrag läuft als Phase der `external-jobs` nach dem Muster von
  `phase-doc-similarity`: deterministisch, ohne Sprachmodell, über den ganzen Bestand.
- Er schreibt je Dokument `docMetaJson.teppich_x`, `teppich_y` (beide 0 bis 1) und
  `teppich_stand`. Das Seitenverhältnis des Fensters rechnet erst der Browser ein.
- Grundlage sind Datum (waagrecht) und gespeicherte Nachbarn (senkrecht), eine Regel für alle
  Libraries (E2). Dazu `teppich_gewicht` (0 bis 1) aus dem Umfang des Dokuments (E3); welche
  Zahl den Umfang trägt (Zeichen des Texts oder Abschnitte im Index), klärt T1 am Code.
  Dokumente ohne Datum oder ohne Nachbarn bekommen einen eigenen
  Randbereich und werden im Ergebnis des Auftrags gezählt, nicht still weggelassen
  ([no-silent-fallbacks](../contracts/no-silent-fallbacks.md)).
- Neue Dokumente: Der Auftrag läuft neu; die Lage ändert sich dabei so wenig wie möglich
  (bestehende Plätze bleiben, Neues rückt an den rechten Rand der Zeit).
- Auslöser: Knopf für Owner und Co-Creator, dazu ein Werkzeug der Brücke (dann
  `TOOLSET_VERSION`, `TOOL_NAMES`, `NEU_IN_VERSION` in `tools-info.ts`).

**Gebaut 22.11.2026** (`src/lib/graph/teppich-lage.ts`, `teppich-felder.ts`, `teppich-persist.ts`):

- `teppich_x` ist der **Rang in der Zeit**, nicht die lineare Zeit: Datierte Dokumente liegen
  gleichmäßig in [0,04, 1]; so bleiben keine leeren Strecken zwischen wenigen alten und vielen
  neuen Dokumenten. Jahreszahlen an der Achse rechnet der Browser aus `jahr` der Punkte.
  Zeit = `date`, sonst Mitte von `year`; undatierte im Streifen [0, 0,04).
- `teppich_y` ist eine **Ordnung nach Ähnlichkeit**: Potenz-Iteration über den Graphen der
  gespeicherten Nachbarn (beide Richtungen, Gewicht = Ähnlichkeit), Gleichanteil nach Grad
  abgezogen, am Ende in gleichmäßige Ränge umgerechnet; Dokumente ohne Nachbarn im Streifen
  oben (0,96, 1]. 80 Schritte beim ersten Lauf, 10, wenn mindestens die Hälfte schon eine Lage
  hat. Getrennte oder schwach verbundene Gruppen ergeben zusammenhängende Bänder (Test).
- `teppich_gewicht` aus `chunkCount` (Abschnitte im Index), logarithmisch auf 0..1; ohne
  `chunkCount` fehlt das Feld.
- Gespeichert werden Ordnungen, keine Pixel: Der Browser packt in Spalten nach seiner Breite
  und sortiert jede Spalte nach `y`.
- Ohne Nachbarn bei allen Dokumenten scheitert der Lauf mit Hinweis auf „Nachbarn neu
  berechnen". Gemessen im Test: 20.000 Dokumente mit je sechs Nachbarn in rund 2 s.
- Auslöser: `POST /api/library/<id>/doc-teppich/recompute` (Owner und Co-Creator) und das
  Werkzeug `teppich_berechnen` (Brücke 2.80.0). Ein Knopf in der Oberfläche kommt mit T2.
- Re-Ingest eines Dokuments ersetzt `docMetaJson` und löscht damit seine Lage (wie bei
  `similarity_neighbors`); die Route meldet das als `veraltet`, ein neuer Lauf behebt es.

### 3.2 Punkte-Abfrage (T1)

- `GET /api/chat/<libraryId>/teppich`: je Dokument `fileId`, `x`, `y`, `jahr`, `gewicht`,
  `titel` (gekürzt), dazu `stand` und `gesamt`. Ein Aufruf, keine Seiten.
- Anonym lesbar wie `docs`: Eintrag in `isChatApiPath` (`src/middleware.ts`), dieselbe
  Sichtbarkeitsprüfung wie die Dokument-Route. Nur veröffentlichte Dokumente.
- Fehlt die Lage (Auftrag nie gelaufen), antwortet die Route mit einem benannten Zustand; der
  Hintergrund bleibt dann aus und die Seite sieht aus wie heute.
- Die Nachbarn eines Dokuments kommen erst beim Überfahren, über die vorhandene Lesersicht.

### 3.3 Hintergrund (T2)

- Baustein `WebsiteTeppich` in `@ks/module-website`: eine Canvas-Fläche, fest am Bild, hinter
  der Seite. Keine neue Abhängigkeit; `paket-schnitt.test.ts` gilt unverändert.
- Montiert wird er über den Gastgeber. Die Sektion meldet wie heute Gespräch und Lage der
  Belege; neu misst sie auch die Karten der Belege (Ziel des Flugs).
- Zustände: `ruhe`, `sucht`, `fliegt`, `antwort`. Der Zustand folgt dem Gespräch der Sektion,
  der Hintergrund hält keinen eigenen Ablauf.
- Bewegung: Schweben und Welle in Ruhe; bei „reduzierte Bewegung" steht alles, die Belege
  erscheinen ohne Flug.
- Schalter je Library `publicPublishing.carpetEnabled`, voreingestellt aus, über die
  Checkliste [library-config-field](../contracts/library-config-field.md); dazu Formular
  „Öffentlich" und Brücke.
- Der Anschluss im Paket heißt ab hier nach dem Teppich; das Feld `buehne` des Gastgebers
  geht darin auf.
- Embed (E5): `KnowledgeScoutSite` zeigt den Teppich ebenfalls, wenn die Library ihn
  eingeschaltet hat; die einbettende Anwendung kann ihn über eine Prop abschalten.

**Gebaut 22.11.2026:**

- Bausteine im Paket: `teppich-packen.ts` (reine Funktionen: Spalten nach Zeit, gleich voll,
  jede Spalte nach Ähnlichkeit mittig gestapelt; Jahreszahlen, Radius, Treffer),
  `react/website-teppich.tsx` (Canvas), `react/website-teppich-ebene.tsx` (lädt Punkte,
  öffnet Dokumente über `docs/by-fileids`, Escape).
- Ort: eine Ebene hinter der ganzen Sektion `layout=story`, nicht nur hinter der Karte. Die
  Karte bleibt weiß und sachlich; Klicks gehen nur dort an den Teppich, wo keine Karte liegt.
  Klick ins Leere blendet Kopfzeile und Karte aus (Hinweis unten), ein zweiter Klick oder
  Escape holt sie zurück.
- Farbe der Punkte = Schriftfarbe der Sektionsfläche (hell auf dunklen Flächen).
- Gastgeber-Feld `teppich?: boolean` statt `buehne`; die Bühnen-Teile im Paket
  (`website-story-buehne.tsx`, `website-story-anker.ts`, Symbol „Zur Bühne") sind entfernt.
  `gespraechAusStory` bleibt für T3.
- App: `carpetEnabled` aus dem Library-Atom (Site-Modus) oder der Chat-Konfig (Root-Modus).
  Embed: `KnowledgeScoutSite` hat die Prop `carpet` (Standard an); der Teppich erscheint nur,
  wenn zusätzlich die Library ihn eingeschaltet hat.
- **Verschoben nach T3:** Linien zu verwandten Dokumenten beim Überfahren. Die Route liefert
  keine Nachbarn; sie kommen mit dem Sternbild der Belege.
- **Angesehen 22.11.2026 in Dev** (SFSCON lokal, 220 Dokumente; Nachbarn dafür lokal aus den
  Embeddings gerechnet, Website-Startseite mit Fragen-Sektion angelegt): Auftrag T1 in 0,7 s,
  Website-Seite ausgelassen, keine Lücken. Teppich montiert, Tooltip, Klick öffnet die
  Detailansicht, Ausblenden und Escape gehen. Zwei Nachzüge: Punkte blieben bei wenigen
  Dokumenten zu groß (Radius jetzt höchstens rund 5 px), der Hinweis beim Ausblenden lag über
  den Jahreszahlen (jetzt oben).
- **Nicht gemessen:** Bilder je Sekunde. Das eingebaute Browserfenster lieferte nur 19 Bilder
  je Sekunde schon für eine leere Schleife; die Messung muss in einem normalen Browser an einer
  großen Library laufen (E6).

### 3.4 Ablauf der Sektion (T3)

- Beim Senden einer Frage blendet die Sektion alles aus außer der Frage. Mindestdauer der
  Suche 2,5 s, auch aus dem Cache. Erst wenn die Belege gelandet sind, kommt der Vordergrund
  zurück.
- Neue Karten-Darstellung `cards=thread`: Belege rechts vom Text, von oben nach unten, in der
  Reihenfolge ihrer Nummern; links neben jeder Karte landet ihr Punkt, der Faden verbindet sie.
  Unter 700 px Breite stehen die Belege unter dem Text.
- Fragenbox: Beispielfragen und Eingabe als Leiste am unteren Rand der Sektion.
- Scheitert die Frage, endet der Schwarm, alle Punkte gleiten zurück, die Sektion zeigt den
  Fehler wie heute.

**Gebaut 22.11.2026:**

- Ablauf als reine Funktion `naechstePhase` (`ruhe` → `sucht` → `landet` → `antwort`, Mindestdauer
  2,5 s, Fehler endet in `ruhe`), geführt von `use-teppich-ablauf.ts`; Schwarm, Schweben und Flug in
  `teppich-bewegung.ts`, Zeichnen in `react/teppich-szene.ts` und `react/teppich-zeichnen.ts`.
- **Deckungsgleich und verzogen (Owner 22.11.2026; abgelöst am 23.11. durch die Storyline, siehe
  3.5):** Steht die Antwort, liegt jeder Beleg genau
  unter der Nummernmarke seiner Karte, auch wenn die Karte noch außerhalb des Bildes liegt (kein
  Sprung beim Scrollen). Das Raster verzieht sich mit (`rasterVerzerrung`, Gauß um jeden Beleg,
  Breite mindestens 60 px bzw. drei Zellen). Erkunden oder eine neue Frage: alles gleitet zurück,
  das Sternbild mit Ringen zeigt die Herkunft. Eine Leinwand, hinter dem Inhalt.
- **Die Antwort ist kein eigenes Fenster:** Mit Teppich hat die Karte der Sektion keinen
  Hintergrund, keinen Rand, keinen Schatten; auch die Flächen der Antwort sind durchsichtig.
- **Ziel sind die Karten von `cards=column`**, kein neuer Wert `thread`; jede Karte trägt
  `data-story-karte-datei`, die Nummernmarke ist ihr letztes Element. Der Faden steht nur, wo die
  Karten eine Spalte bilden; im zweispaltigen Raster entfällt er (kein Zickzack).
- **Punkte groß und blass:** Radius bis etwa die halbe Zelle (Grundmaß höchstens 6 px),
  Deckkraft 0,15 in Ruhe, 0,22 beim Schwarm, 0,32 beim Erkunden.
- **Teppich so hoch wie der sichtbare Bereich** und beim Scrollen stehend (sticky), damit er immer
  ganz im Bild ist (Owner 22.11.2026: nur ein Ausschnitt war zu sehen).
- **Befunde der Ansicht in Dev (SFSCON lokal):** Ein neues Raster brach den Flug ab, die Antwort
  blieb verborgen; behoben. Liegt der Reiter im Hintergrund oder die Fläche außer Sicht, landen die
  Belege sofort. 62 Bilder je Sekunde bei 220 Punkten im Vordergrund-Reiter. Öffentliche Libraries
  schicken dem Sprachmodell ihren eigenen Schlüssel (`publicPublishing.apiKey`); für lokale Tests
  muss er zum lokalen Secretary passen.
- **Offen:** Fragenbox am unteren Rand, Linien zu verwandten Dokumenten beim Überfahren, Ansicht
  auf dem Telefon.

### 3.5 Suchstufen (T4)

- `retrieval_complete` bekommt `candidateFileIds`, `prompt_complete` bekommt
  `usedFileIds` (`packages/contracts/src/chat-processing.ts`). Beide optional; ohne sie läuft
  der Schwarm ohne Stufen.
- Der Hintergrund dehnt die Stufen auf feste Anteile der Wartezeit, hält aber die Reihenfolge
  der echten Meldungen ein. Kommt die Antwort aus dem Cache, gibt es keine Stufen.
- Das Suchverfahren über Zusammenfassungen meldet eigene Zahlen; welche Stufen es zeigt, wird
  in T4 am Code geklärt und hier nachgetragen.

**Gebaut 22.11.2026 (zwei Stufen statt drei):**

- **Stufe 1, Auswahl der Suche:** `retrieval_complete` trägt `candidateFileIds` (die Dokumente,
  die dem Sprachmodell vorgelegt werden, je Dokument einmal). Der Orchestrator sendet die Meldung
  für alle Suchverfahren gleich, also auch für das über Zusammenfassungen. Der Teppich zieht sie
  beim Schwarm auf einen inneren Kreis (`schwarmKreise`, 0,3 bis 0,4 des Radius) und zeichnet sie
  deutlicher; alle anderen weichen nach außen.
- **Stufe 2, definitiv verwendet:** Mit der Antwort fliegen die zitierten Belege zuerst in einen
  engen Kreis in der Mitte, dann in die Storyline (siehe unten). Ein eigenes `usedFileIds` an `prompt_complete` entfällt: Vorgelegt wird genau die Auswahl aus
  Stufe 1, zitiert wird erst in der Antwort.
- Antworten aus dem Cache haben keine Stufe 1 (keine Suche), Stufe 2 läuft trotzdem.
- **Angesehen in Dev** (SFSCON lokal, 815 px Breite): Auswahl auf dem inneren Ring sichtbar,
  Suche 20 bis 37 s, Landung 2,7 bis 2,8 s, dann die Antwort.

**Umgebaut 23.11.2026, Storyline statt Nummernmarken (Owner 22.11.2026):** Den Flug unter die
Nummernmarken und die Verzerrung des Rasters verstand niemand; beides ist entfernt
(`rasterVerzerrung`, `markenPlatz`, `data-story-karte-datei`).

- **Storyline:** Die Belege verdichten sich zu einer Liste in der Mitte der Fläche, untereinander
  in der Reihenfolge ihrer Nummern, mit Nummer im Kreis und Titel daneben (`storylineLage`). Die
  Liste steht `STORYLINE_MS` (3,2 s) zum Lesen, dann erscheint die Antwort.
- **Botschaften unten** erklären den Rechenweg in Worten (`botschaftsStufe`,
  `use-teppich-botschaft.ts`, Schlüssel `website.story.teppich.*`): Dokumente werden durchsucht,
  {count} passende gefunden, gewichtet, die Antwort entsteht, zum Schluss „Ihre Storyline: Die
  Antwort stützt sich auf diese {count} Belege". Je Stufe mindestens 1,4 s.
- **Nach der Antwort** ~~dreht der Schwarm langsam weiter~~ — entschieden 23.11.2026 (Owner, nach
  dem Prod-Test auf FOSDEM): Das Kreisen störte. Mit der Antwort fliegen alle Punkte an ihren Platz
  im Raster zurück.
- **Kleiner Kasten statt ganzer Sektion (Owner 23.11.2026):** Der Teppich war so hoch wie die
  Sektion; man sah entweder die Frage oben oder die Botschaft unten. Jetzt liegt das Raster in
  einem Kasten so breit wie die Antwort und so hoch wie der sichtbare Bereich, darüber die Frage,
  darunter die Botschaft (`teppichKasten`, `TEPPICH_OBEN`/`TEPPICH_UNTEN`); alles zusammen klebt
  oben. Die Leinwand ist so breit wie die Sektion, der Schwarm fliegt über den Kasten hinaus.
- **Zur Frage scrollen (Owner 23.11.2026):** Beim Absenden einer Frage, auch einer Folgefrage
  unten in der Eingabe, scrollt die Seite an den Anfang der Fragen-Sektion
  (`use-zur-frage-scrollen.ts`).
- **Angesehen in Dev 23.11.2026** (SFSCON lokal, zwei Fragen): Botschaften in der richtigen
  Reihenfolge, Storyline mit 10 bzw. 13 Titeln lesbar, nach 5,8 bis 6,1 s die Antwort.

### 3.6 Wolke statt Raster (T5, geplant 23.11.2026)

**Wunsch des Owners:** Die Animation soll aus der Punktwolke der Graph-Ansicht entstehen, nicht
aus einem Raster. Die Wolke zeigt, was zusammengehört; das Raster zeigt es nur als Reihenfolge.

**Ausgangslage.** Beide Ansichten lesen dieselben Nachbarn (`similarity_neighbors`, Job
`doc-similarity`, Brücke `nachbarn_berechnen`). Verschieden ist nur, wo die Lage entsteht:

| | Graph-Ansicht (Galerie, Expertenmodus) | Teppich (T1–T4) |
|---|---|---|
| Lage | Physik im Browser (`d3-force`: Kanten ziehen, alle stoßen sich ab), bei jedem Aufruf neu | Ordnung auf dem Server: Zeit nach rechts, Ähnlichkeit nach unten |
| Zeichnen | SVG, ein React-Render je Rechenschritt | Canvas, eigene Schleife |
| Grenze | höchstens 2.000 Punkte, Ausschnitt per Hand zoomen | 2.184 Punkte bei 60 fps gemessen |

**Bau.** Die Physik der Graph-Ansicht läuft einmal auf dem Server, im Job `doc-teppich`, und ihr
Ergebnis wird der feste Platz jedes Punkts. Schwarm, Storyline und Rückflug bleiben, wie sie sind;
sie starten aus der Wolke und kehren in sie zurück.

1. **Lage rechnen** (`src/lib/graph/teppich-wolke.ts`, reine Funktion): `d3-force` ohne Browser
   (`forceSimulation(...).stop()`, dann eine feste Zahl `tick()`), mit denselben Kräften wie
   `use-graph-simulation.ts` und einer Kollisionskraft, damit sich Punkte nicht decken.
   Deterministisch: feste Startlage (Phyllotaxis-Spirale nach `fileId`-Reihenfolge, wie d3 sie
   ohne Startwerte setzt), d3-eigener fester Zufall, feste Schrittzahl. Liegt eine frühere Wolke
   vor, startet die Rechnung dort; bestehende Plätze bleiben nah. Dokumente ohne Nachbarn: ein
   Ring außen, gezählt, nicht verschwiegen.
2. **Speichern** flach in `docMetaJson`: `teppich_wx`, `teppich_wy` (0..1, auf die Hülle der
   Wolke normiert) neben `teppich_x`/`teppich_y`. Kein neues Format, kein verschachteltes Feld.
3. **Punkte-Abfrage** (`GET /api/chat/<id>/teppich`): je Punkt zusätzlich `wx`, `wy` und die
   stärksten Nachbarn als Indizes (höchstens 3 je Punkt, für die Linien). Bei 2.184 Punkten etwa
   +60 kB; zu messen.
4. **Zeichnen** (`packages/module-website`): `packeWolke` setzt `wx`/`wy` in den Kasten
   (`teppichKasten`), Seitenverhältnis der Wolke erhalten. `naechsterTeppichPunkt` trifft
   weiter. Die Jahreszahlen unten entfallen (siehe E8).
5. **Linien** zwischen Nachbarn nach E9.
6. **Nebenbei, eigene PR:** Die Graph-Ansicht passt sich nach dem Rechnen selbst auf die ganze
   Wolke ein (Zoom auf die Hülle), statt dass man herauszoomen muss. Später kann sie die
   gespeicherte Lage lesen und braucht dann weder die Rechenzeit noch die Grenze von 2.000.

**Zweite Animation: die Wolke bildet sich (Owner 23.11.2026).** Statt des Kreisens beim Rechnen
zeigt sie, wie die Wolke entsteht — der spannende Moment. Sie ersetzt den Schwarm NICHT, sondern
ist wählbar (E10).

1. **Ruhe:** die Wolke an ihren festen Plätzen. Weil die fertige Wolke bekannt ist, steht der
   Ausschnitt von Anfang an richtig (auf die Hülle eingepasst), es wird nie gezoomt.
2. **Frage abgeschickt:** alle Punkte ziehen sich in einen Punkt in der Mitte zusammen.
3. **Suche läuft:** der Punkt explodiert in alle Richtungen, die Wolke bildet sich vor den Augen.
   Weil die Rechnung deterministisch ist, endet sie genau in der gespeicherten Wolke (E11).
4. **Auswahl der Suche bekannt** (`retrieval_complete`, wie T4): Die Kandidaten kristallisieren
   sich heraus. Niemand schiebt sie: Zwischen ihnen entstehen zusätzliche, starke Kanten (sie
   sind jetzt eng verbunden), die Physik zieht sie zu einem Knäuel zusammen; die übrigen weichen
   durch die Abstoßung von selbst etwas aus.
5. **Belege bekannt:** Auch die Storyline bildet die Physik, kein Flug. Die Belege bekommen Kanten
   zum nächsten in ihrer Reihenfolge (1–2, 2–3, …) und eine Kraft zu einer gemeinsamen Spalte
   (`forceX`) sowie eine schwächere zu ihrem Platz in der Liste (`forceY`). Sie ziehen sich an wie
   beim Entstehen der Wolke, finden sich erst als Knäuel und ordnen sich dann zur Linie — in der
   Reihenfolge der Antwort. Erst wenn die Bewegung abgeklungen ist (Energie der Simulation unter
   einer Schwelle, höchstens nach einer festen Zeit), erscheinen Nummern und Titel.
6. **Antwort steht:** Die Zusatzkräfte fallen weg, eine Kraft zum eigenen Platz in der Wolke zieht
   jeden Punkt zurück.

**Grundsatz (Owner 23.11.2026): eine Physik, ein Bewegungsmuster.** In dieser Animation gibt es
keine berechneten Flüge (`flugVerlauf`). Es läuft durchgehend EINE Simulation; die Phasen ändern
nur ihre Kräfte — Kanten dazu oder weg, Ziele für `forceX`/`forceY`, Stärken. Eine physikalische
Ordnung wird nie durch eine mechanische ersetzt.

Die Mindestdauer der Suche (`SUCHE_MINDESTENS_MS`) gilt weiter, damit die Explosion auch bei
einer Antwort aus dem Cache zu sehen ist. Bei reduzierter Bewegung: keine Explosion, die Auswahl
wird nur hervorgehoben, dann steht die Storyline.

**Wahl der Animation** (E10): ein Parameter der Fragen-Sektion wie `cards=` und `rules=`, etwa
`animation=schwarm|wolke`; ohne Angabe `schwarm` (der heutige Ablauf). Ein unbekannter Wert ist
ein Fehler in der Konsole, kein stiller Rückfall. Beide Animationen teilen Szene, Storyline,
Botschaften und Rückflug; verschieden ist nur die Bewegung in der Phase `sucht`. Im Code: je
Animation eine Bewegungs-Strategie hinter einer Schnittstelle in `teppich-szene.ts`, nicht ein
Sonderzweig je Stelle.

**Aufwand der Rechnung:** `d3-force` mit Barnes-Hut wächst mit n·log n; für 2.184 Punkte und
rund 8.000 Kanten bei 300 Schritten wenige Sekunden im Job. Zu messen an FOSDEM, Abnahme wie T1.

**Contracts:** T5a fasst `src/lib/graph/**` und den Job an (`contracts-pipeline`,
no-silent-fallbacks), T5b `packages/module-website/**` (`contracts-ui`).

## 4. Wellen

| Welle | Inhalt | Sichtbar danach |
|---|---|---|
| T0 | Entscheide E1–E5 (getroffen 22.11.2026) | — |
| T0b | Common-UX-Bühne ausbauen | Fragen-Sektion ohne Hintergrund und ohne Symbol „Zur Bühne" |
| T1 | Auftrag, Felder, Punkte-Abfrage, Tests | Zahlen in der Antwort der Route |
| T2 | Hintergrund in Ruhe, Erkunden, Schalter | Teppich hinter der Startseite |
| T3 | Schwarm, Flug, `cards=thread`, Fragenbox | Startseite wie das Klickmodell, ohne Stufen |
| T4 | Meldungen mit Kennungen, Räume | Aussieben in Stufen |
| T5a | Wolke auf dem Server: Lage rechnen, speichern, Punkte-Abfrage mit `wx`/`wy` und Nachbarn | Zahlen in der Antwort der Route |
| T5b | Wolke zeichnen, Linien, Rückflug in die Wolke | Startseite mit Wolke statt Raster |
| T5c | Graph-Ansicht passt sich ein (eigene PR, unabhängig) | Ganze Wolke ohne Zoomen |
| T5d | Zweite Animation „die Wolke bildet sich", Parameter `animation=` | Explosion statt Kreisen, wählbar |

Je Welle eine PR. T1 fasst `src/lib/external-jobs/**` an (Skill `contracts-pipeline`), T2 und
T3 `packages/module-website/**` und `src/components/library/website/**` (Skill `contracts-ui`),
T4 `src/lib/chat/**` und `src/app/api/chat/**` (Skill `contracts-ingestion-chat`).

## 5. Leistung

Nicht gemessen. Annahmen, die T2 an einem Bestand mit über 2.000 Dokumenten prüft:

- Canvas zeichnet 5.000 Punkte flüssig, 20.000 auf einem Arbeitsrechner noch brauchbar.
- Der Schwarm rechnet ohne Nachbarsuche (Kreisen, Zug zum eigenen Radius, gemeinsame
  Strömung); der Aufwand wächst nur mit der Zahl der Punkte.
- Weil nichts ruht, zeichnet die Seite ständig. Ist der Reiter nicht sichtbar oder die Sektion
  aus dem Bild gescrollt, hält der Hintergrund an.

## 6. Abnahme

- T1: Auftrag an einer Library gelaufen, Zahl der Dokumente mit Lage gleich der Zahl der
  veröffentlichten; Route anonym belegt.
- T2 und T3: im Browser an einer Library mit echter Antwort gesehen, auf Rechner und Telefon,
  hell und dunkel, mit und ohne reduzierte Bewegung. Der Vergleich ist das Klickmodell.
- T4: eine Frage mit Suche und eine aus dem Cache.
- Jede Welle: `pnpm test`, `pnpm lint`, `tsc` vollständig gegen den Stand davor, vor dem Merge
  `bash scripts/welle-pre-merge-check.sh`.

## 7. Owner-Entscheide (22.11.2026)

| Nr. | Frage | Entscheid |
|---|---|---|
| E1 | Verhältnis zur Common-UX-Bühne | Der Teppich ersetzt die Bühne in KnowledgeScout. Die Bühne wird sofort ausgebaut, vor T1 (T0b). |
| E2 | Anordnung | Zeit nach rechts, Ähnliches beieinander; eine Regel für alle Libraries. |
| E3 | Größe eines Punkts | Nach dem Umfang des Dokuments. |
| E4 | Reichweite | Zuerst nur die Fragen-Sektion der Startseite. |
| E5 | Startseiten-Embed | Der Teppich läuft auch dort. |

Entschieden 23.11.2026 (Owner, Wolke T5):

| Nr. | Frage | Entscheid |
|---|---|---|
| E7 | Wolke oder Raster | Die Wolke ersetzt das Raster, eine Regel für alle Libraries; das Raster fällt nach T5b weg. Löst E2 ab (Zeit nach rechts). |
| E8 | Zeit in der Wolke | Zuerst gar nicht; nach dem Ansehen von T5b neu entscheiden (etwa Helligkeit nach Jahr). |
| E9 | Linien zwischen Nachbarn | Nur beim Überfahren eines Punkts und bei den Belegen der Antwort. |
| E10 | Wer wählt die Animation | Wer die Seite einrichtet, per Parameter der Sektion (`animation=`); ein Umschalter für Besucher kann später darauf aufsetzen. |
| E11 | Wie die Wolke sich bewegt | Echte Physik im Browser, durchgehend, nie ein Flug (Grundsatz in §3.6). |

Offen:

| Nr. | Frage | Wann |
|---|---|---|
| E6 | Obergrenze bewegter Punkte auf dem Telefon; mit E11: ist die Physik zu langsam, bewegen sich weniger Punkte (die fernen ruhen), nie ein Flug | Nach der Messung in T2 bzw. T5d. |
