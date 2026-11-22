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
    content: "T2 Hintergrund in Ruhe: Canvas-Baustein im Paket, über den Gastgeber montiert; Schweben, Tooltip, verwandte Dokumente, Klick blendet den Vordergrund aus; Schalter je Library."
    status: pending
  - id: t3-ablauf
    content: "T3 Frage und Antwort: Vordergrund weicht beim Rechnen, Schwarm mit Mindestdauer, Belege fliegen rechts neben den Text, Faden mit Nummern, Ringe am festen Platz; Fragenbox am unteren Rand."
    status: pending
  - id: t4-stufen
    content: "T4 Suchstufen: Meldungen der Suche tragen die Kennungen der Dokumente; Kandidaten, Auswahl, Belege ziehen in Räume nach innen."
    status: pending
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

### 3.5 Suchstufen (T4)

- `retrieval_complete` bekommt `candidateFileIds`, `prompt_complete` bekommt
  `usedFileIds` (`packages/contracts/src/chat-processing.ts`). Beide optional; ohne sie läuft
  der Schwarm ohne Stufen.
- Der Hintergrund dehnt die Stufen auf feste Anteile der Wartezeit, hält aber die Reihenfolge
  der echten Meldungen ein. Kommt die Antwort aus dem Cache, gibt es keine Stufen.
- Das Suchverfahren über Zusammenfassungen meldet eigene Zahlen; welche Stufen es zeigt, wird
  in T4 am Code geklärt und hier nachgetragen.

## 4. Wellen

| Welle | Inhalt | Sichtbar danach |
|---|---|---|
| T0 | Entscheide E1–E5 (getroffen 22.11.2026) | — |
| T0b | Common-UX-Bühne ausbauen | Fragen-Sektion ohne Hintergrund und ohne Symbol „Zur Bühne" |
| T1 | Auftrag, Felder, Punkte-Abfrage, Tests | Zahlen in der Antwort der Route |
| T2 | Hintergrund in Ruhe, Erkunden, Schalter | Teppich hinter der Startseite |
| T3 | Schwarm, Flug, `cards=thread`, Fragenbox | Startseite wie das Klickmodell, ohne Stufen |
| T4 | Meldungen mit Kennungen, Räume | Aussieben in Stufen |

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

Offen:

| Nr. | Frage | Wann |
|---|---|---|
| E6 | Obergrenze bewegter Punkte auf dem Telefon | Nach der Messung in T2. |
