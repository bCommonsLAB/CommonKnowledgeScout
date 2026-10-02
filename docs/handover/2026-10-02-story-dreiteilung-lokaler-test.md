# Handover: Story-Dreiteilung lokal testen (Wellen D1–D7, D6b, D6c)

Stand: 02.10.2026. Plan: [`docs/plans/story-dreiteilung-fragenchronik.plan.md`](../plans/story-dreiteilung-fragenchronik.plan.md)
(Abschnitte „Stand D1" bis „Stand D6c"). Alle Wellen sind gebaut und nur mit
Unit-Tests belegt (583 Dateien / 4384 Tests, Lint 0 Errors, tsc-Vergleich
leer). **Kein Live-Nachweis, kein `pnpm build`** — beides ist Aufgabe dieser
lokalen Sitzung.

## 1. Wo der Code liegt

- Branch `ccr-72b5c0ce-oj24xu` auf GitHub trägt alles: D1–D7, D6b, D6c
  (gestapelte PRs #308–#315, alle gemergt). Head am 01.10.: `c1037065`.
- `master` (`2be29148`, 1.2.274) hat davon **nichts**. Der Weg nach `master`
  ist Schritt 3 unten.

```bash
git fetch origin
git checkout ccr-72b5c0ce-oj24xu
git pull
pnpm install
```

## 2. Pflicht-Gates lokal (vor allem anderen)

```bash
bash scripts/welle-pre-merge-check.sh   # Sperrliste; nur lokal moeglich
pnpm build                              # Docker-/Next-Build, lief in keiner Welle
pnpm test && pnpm lint
```

Bricht `pnpm build`, zuerst `npx tsc --noEmit -p tsconfig.json 2>&1 | grep 'error TS'`:
Es duerfen nur die 39 bekannten Alt-Fehler erscheinen (Liste im Plan nicht
gefuehrt; Vergleich: `git stash`-Trick aus AGENTS.md).

## 3. Testplan App (`/library/gallery?mode=story` und `/explore/<slug>?mode=story`)

Voraussetzungen: `pnpm dev`, Secretary erreichbar (Stream braucht ihn),
eine Library mit Dokumenten, darunter mindestens ein PDF-Transkript mit
`--- Seite N ---`-Markern. Fuer D7-Seitenknoepfe an **bestehenden** Dokumenten
zuerst Schritt 5 (Backfill).

Je Punkt: erwartetes Verhalten, Herkunft (Welle), wo nachschauen, wenn es
nicht stimmt.

| # | Schritt | Erwartet | Welle | Bei Abweichung |
|---|---|---|---|---|
| 1 | Story-Modus oeffnen, Desktop ≥ lg | Drei Spalten 15/50/35, per Ziehen verstellbar; links Chronik (Gliederung zu, „Meine Fragen"), Mitte Titel/Beschreibung/Zaehler, rechts gefilterte Galerie | D1, D3 | `story-spalten.tsx`, `gallery-root.tsx` (Slots `storyChronik`/`storyPanel`) |
| 2 | Warten | Themenuebersicht entsteht („Generiere Themenuebersicht…", Schritte in einfachen Worten), dann Themenkarten | D1, D2, D6c | Netz: `POST /api/chat/<id>/stream` mit `llmModel=`; fehlt das Modell → `story.modelMissing`; Autostart in `use-story-konversation.ts` |
| 3 | Thema anklicken | Themenseite mit Fragen als Knoepfen; Gliederung links klappt auf und markiert das Thema | D1 | `storyAuswahlAtom`, `StoryThema` |
| 4 | Frage anklicken | Eingabe unten rechts klappt auf, Frage steht drin | D6b | `StoryEingabe` (`story-eingabe.tsx`) |
| 5 | Senden | Konversation allein in der Mitte, Frage oben, Schritte in einfachen Worten, dann Antwort | D2, D6b | `useStoryStream`; Fehler stehen rot unter der Konversation |
| 6 | Antwort lesen | Zitatmarken ①②③ **je Dokument**; `title` beim Ueberfahren „Dokument: stuetzt sich auf n Textstellen"; Klick scrollt zur Belegkarte | D7, D6b | `AntwortText`, `zitatmarkenImText`; Server: `dokumenteNummerieren` in `src/lib/chat/common/zitatmarken.ts` |
| 7 | Rechte Spalte | Belegliste: Karte je Dokument mit Marke, Titel, Plakette/Kennzeile (climateAction), Textstellen mit Zitat; „Original ansehen" | D3, D7 | `beleg-liste/*`, Registry `belegKarte` |
| 8 | Seitenknopf „S. n" (nur PDF mit Seitenankern) | Detailansicht oeffnet und scrollt zur Seite; Adresse traegt `page=n`; Schliessen entfernt `doc` und `page` | D7 | `useSeitenSprung`, `openDocumentBySlug`; ohne Anker: Konsole „Kein Seitenanker gefunden" |
| 9 | Chronik links | Die Frage erscheint unter der aktiven Sitzung mit **Kurztitel** (2–4 Worte vom LLM); Sitzungstitel = Kurztitel der ersten Frage | D1, D5, D6a | `shortTitle` im Query-Log; `kurztitelFuer` |
| 10 | Adresse kopieren, neu laden | `?q=<queryId>` zeigt dieselbe Konversation, auch aus anderer Sitzung | D2 | `story-auswahl-url.tsx` (loest Sitzung ueber `GET …/queries/<id>`) |
| 11 | Zurueck-Knopf des Browsers | Zurueck zur Themenuebersicht / vorherigen Konversation | D2 | nuqs `history: push` |
| 12 | Aeltere Sitzung in der Chronik aufklappen, Frage anklicken | Fragen laden erst beim Aufklappen; Klick stellt die Sitzung um und zeigt die Konversation | D1, D6c | `useStorySitzungen`, `useStorySitzungId` (Atom + `chat-activeChatId-<lib>`) |
| 13 | Sitzung umbenennen, „Neue Sitzung" | PATCH greift; neue Sitzung leert die Mitte, naechste Frage legt neuen Chat an | D1, D6b | `/chats/<chatId>` PATCH |
| 14 | Papierkorb an der Frage | Rueckfrage, DELETE, Konversation weg, zurueck zur Uebersicht | D6c | `frageLoeschen` in `use-story-konversation.ts` |
| 15 | „Frage neu stellen" (Pfeil) | Text landet in der Eingabe, nicht sofort gesendet | D6c | bewusst so |
| 16 | Anschlussfrage unter der Antwort | wie 4 | D6b | |
| 17 | Filter rechts aendern | Uebersicht wird neu geholt (Server-Cache, keine Zwangs-Neuberechnung) | D6c | bewusst anders als vorher |
| 18 | „Uebersicht neu berechnen" | Neuberechnung ohne Cache | D6b | `uebersichtLaden(true)` |
| 19 | Unter der Antwort | KI-Hinweis, Konfig-Anzeige; angemeldet zusaetzlich „Logs" und „Debug" | D6c | `story-fuss.tsx` |
| 20 | Fenster < lg | Nur die Mitte; Knopf „Themen und Fragen" oeffnet die Chronik als Sheet, Auswahl schliesst es; „Quellenverzeichnis"-Knopf oeffnet das Sheet der Galerie | D4, D6c | `story-chronik-sheet.tsx`, `show-reference-legend` |
| 21 | Alte Antwort (vor D7) oeffnen | Nummern je Textstelle, Karte zeigt Kurztext statt Textstellen — erwartet | D7 | kein Fehler |

## 4. Testplan Embed (`view="story"`)

```bash
pnpm --filter @ks/embed build          # Buendel + styles.css + pruefe-buendel
pnpm --filter @ks/embed pack:datei     # .tgz fuer die Partner-App
```

In der Partner-App (Next 16): `<KnowledgeScoutExplorer baseUrl library view="story" locale="de" />`.
Erwartet: Start im Story-Modus, Themenuebersicht entsteht anonym
(Sitzungskennung `X-Session-ID`, 30 Tage im localStorage), Frage → Antwort
mit ① und Belegen rechts, Chronik listet die Sitzung nach dem Neuladen,
**kein** Loeschen (opt-in nur in der App), kein Perspektiven-Knopf. Ohne
oeffentlich gelistetes Modell (`GET /api/public/llm-models`) eine sichtbare
Meldung statt Fragen. Die Instanz muss CORS fuer `POST …/stream` und
`DELETE` nicht, aber `GET/POST/PATCH` auf `/api/chat/*` erlauben (wie fuer
die Galerie; `03-audit-embed-fetches.md`).

## 5. Backfill Seite je Chunk (D7, bestehende PDF-Libraries)

```bash
pnpm tsx scripts/backfill-chunk-pages.ts --collection <chunks-collection>          # Trockenlauf
pnpm tsx scripts/backfill-chunk-pages.ts --collection <chunks-collection> --apply  # schreibt `page`
```

Vorher `mongodump` der Collection (Playbook Regel 5). Danach eine Frage zu
einem PDF stellen: Textstellen tragen „S. n". Quellen ohne Seitenanker
(Audio, Video, Markdown) bleiben ohne — kein Ersatzwert.

## 6. Bekannte Luecken (kein Fehler, nicht melden)

- Marken-Tooltip im Text ist ein nativer `title`, kein Radix-Tooltip.
- `publicPublishing.story` (topicsTitle, topicsIntro) erreicht anonyme
  Besucher auf `/explore` nicht; Karten-Ueberschrift faellt auf den Titel der
  Gliederung zurueck (Befund D1).
- Der Hinweis „Uebersicht nicht mehr aktuell" ist durch den immer sichtbaren
  Knopf ersetzt.
- `ChatPanel` ist nirgends mehr montiert (kein Chat-Reiter); der tote
  App-Chat ist D6d — Owner entscheidet, ob er zurueckkommt.
- `detail-overlay.tsx` ist aufgeteilt (D6b); Verhalten 1:1, aber bisher
  nicht live gesehen — Pfeile, Stern, Kommentare, Bewertungsmodus kurz
  durchklicken.

## 7. Was zurueck ins Repo gehoert

- Befunde als „Neu dazugekommen" unter „Stand D6c" im Plan (Datum, Schritt-
  Nummer aus der Tabelle, Symptom, Vermutung); Fixes als eigene kleine PR
  gegen `ccr-72b5c0ce-oj24xu`.
- Ist alles gruen: PR `ccr-72b5c0ce-oj24xu` → `master` (eine PR, der Branch
  ist die Summe der gestapelten Wellen). `pnpm build` muss vorher lokal
  gruen gewesen sein (Pflicht seit M4b).

## 8. Start-Prompt fuer die lokale Claude-Code-Sitzung

> Lies CLAUDE.md, AGENTS.md, docs/guides/verification-playbook.md und
> docs/handover/2026-10-02-story-dreiteilung-lokaler-test.md. Wir sind auf
> Branch `ccr-72b5c0ce-oj24xu`. Fuehre zuerst Abschnitt 2 aus (Pre-Merge-Check,
> `pnpm build`, Tests, Lint) und melde das Ergebnis. Dann starte `pnpm dev`
> und gehe mit mir den Testplan in Abschnitt 3 Punkt fuer Punkt durch: Ich
> klicke, du liest Dev-Log und Netzwerk mit (Playbook: frischer Server, eine
> Aktion, dann messen) und haeltst je Punkt „passt" oder Symptom + Vermutung
> fest. Abweichungen sammeln wir unter „Neu dazugekommen" in „Stand D6c" des
> Plans; kleine Fixes direkt auf einem Branch gegen `ccr-72b5c0ce-oj24xu`
> mit Tests, tsc-Vergleich und Lint. Danach Abschnitt 5 (Backfill, erst
> Trockenlauf) und Abschnitt 4 (Embed-Buendel bauen). Keine Aenderung an
> `master` ohne meine Freigabe.
