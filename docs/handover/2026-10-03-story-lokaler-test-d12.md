# Handover: Story-Dreiteilung lokal testen — Wellen D8 bis D12i

Stand: 03.10.2026, Ende der zweiten Cloud-Session. Plan:
[`../plans/story-dreiteilung-fragenchronik.plan.md`](../plans/story-dreiteilung-fragenchronik.plan.md)
(„Stand D12a" bis „Stand D12i"). Vorgänger:
[`2026-10-02-story-online-d12.md`](2026-10-02-story-online-d12.md) (Schreibtischtest,
D12a–D12e), Testplan in
[`2026-10-02-story-dreiteilung-lokaler-test.md`](2026-10-02-story-dreiteilung-lokaler-test.md)
Abschnitt 3. Alle Wellen seit D8 sind **nur mit Unit-Tests belegt, nie live
gesehen** (außer D8–D11b, die der Owner am 02.10. im Dev-Server hatte). Diese
lokale Sitzung holt den Live-Nachweis nach.

## 1. Wo der Code liegt (Vorsicht, gestapelte Merges)

Stand am Ende der Cloud-Session (vor #336, siehe Nachtrag unten): Die Kette
D12a–D12e wurde am 02.10. von unten nach oben in die jeweilige Basis
gemergt, nicht nach ccr durchgereicht:

- `ccr-72b5c0ce-oj24xu` (`685065a6`) hat nur **D12a** (#325).
- `claude/story-d12e-belege-folgen-auswahl` (`bdcf7b2a`) hat **alles**: D8–D11b,
  D12a–D12e und das Handover vom 02.10. (Merges von #326–#330).
- Darauf gestapelt die vier Befund-Wellen dieser Session, jede PR hat die
  vorige als Basis:

| PR | Branch | Welle | Inhalt |
|---|---|---|---|
| #331 | `claude/story-d12f-letzte-frage-loeschen` | D12f | Letzte Frage löschen löscht die leer gewordene Sitzung mit; Chronik lädt neu (`storySitzungenStandAtom`) |
| #332 | `claude/story-d12g-fragenliste-aktuell` | D12g | Verlassene Sitzung behält den live gesehenen Fragen-Stand, nächstes Aufklappen lädt neu |
| #333 | `claude/story-d12h-leisten-zaehler` | D12h | Zähler der Quellen-Leiste zählt Dokumente (`anzahlBelegDokumente`) |
| #334 | `claude/story-d12i-markenklick-mobil` | D12i | Markenklick auf Mobil öffnet das Belege-Blatt statt der Desktop-Schicht |
| #335 | `claude/story-handover-lokal-d12` | — | dieses Handover |

**Nachtrag 03.10., nach der Cloud-Session:** Die PRs #331–#335 wurden
jeweils in ihre Basis gemergt. Dadurch trug `claude/story-d12e-…` nur
D12b–D12f, die Summe D12b–D12i plus beide Handover lag auf
`claude/story-d12i-markenklick-mobil` (Merge von #335). Von dort ging
**eine Sammel-PR #336 nach ccr** (`1347a313`). Seitdem gilt:

**Einzige Basis für die lokale Sitzung: `ccr-72b5c0ce-oj24xu`.** Sie
enthält D8–D12i und beide Handover. Die Wellen-Branches oben sind
Geschichte, nicht Arbeitsstand. Wo im Folgenden „Spitze" steht, ist ccr
gemeint.

```bash
git fetch origin
git checkout ccr-72b5c0ce-oj24xu
pnpm install
```

## 2. Pflicht-Gates lokal (vor allem anderen)

```bash
bash scripts/welle-pre-merge-check.sh   # Sperrliste; nur lokal
pnpm build                              # lief für keine Welle seit D8 (Pflicht seit M4b)
pnpm test && pnpm lint
npx tsc --noEmit -p tsconfig.json 2>&1 | grep 'error TS' | sed 's/(.*//' | sort -u   # 38 Alt-Dateien, keine neue
pnpm --filter @ks/embed build           # D12e ändert embed-story.tsx und @ks/contracts
```

Ergebnis 03.10. (lokal, Worktree auf ccr nach #336): Tests grün (zweiter
Lauf; der erste im kalten Worktree hatte sechs Timeouts), Lint grün,
Embed-Build grün. `pnpm typecheck:packages` war rot — die Embed-tsconfig
kannte `@ks/module-story` nicht, Fix in #338. `pnpm build` und der
tsc-Vergleich stehen noch aus (Build abgebrochen, damit `.next` für den
Dev-Server frei war).

## 3. Live-Nachweis je Welle (Dev-Server, Secretary erreichbar)

Voraussetzungen wie im Testplan vom 02.10.: `pnpm dev`, Secretary, eine
Library mit Dokumenten. Die `.env` zeigt auf die Prod-DB — jede Frage
schreibt Chats und Query-Logs. Je Punkt: Aktion, Erwartung, wo nachschauen.

| # | Welle | Aktion | Erwartet | Bei Abweichung |
|---|---|---|---|---|
| A | D12a | Story öffnen, Übersicht abwarten, unter die Karten scrollen | Konfig-Anzeige steht (Sprache, Modell …); Netz `GET …/queries/<id>` → 200, Antwort ohne `userEmail`/`sessionId`, wenn die Übersicht aus fremdem Cache kam | `query-log-zugriff.ts`, `queries-repo.ts getQueryLogById` |
| B | D12b | Dieselbe Themenfrage in zwei Sitzungen stellen (zweite: „Neue Sitzung") | Zweite Antwort kommt sofort (Cache); Chronik zeigt die Frage unter der zweiten Sitzung; Neuladen behält sie; Debug zeigt `cache_check` mit `cachedQueryId` | `cache-treffer-log.ts`, `stream/route.ts` Treffer-Zweig |
| C | D12c | Ältere Sitzung in der Chronik anklicken, Frage wählen | Chronik listet unter der neuen aktiven Sitzung nur deren Fragen; Anschlussfrage → Netz `POST …/stream`, `chatHistory` nur aus dieser Sitzung | `use-story-verlauf.ts` |
| D | D12d | Pfeilkreis an „Themenübersicht" klicken | Spinner am Knopf, Knopf bleibt; nach der Berechnung wieder Pfeilkreis; während einer Frage gesperrt ohne Spinner | `story-root.tsx` (Aktion), `gliederung.tsx` |
| E | D12e | Frage stellen, Quellen zu lassen, Zitatmarke ① klicken | Quellen-Schicht geht auf, scrollt zur Karte; Browser merkt „auf" | `antwort-text.tsx`, `beleg-sprung.ts` |
| F | D12e | Übersicht → ältere Antwort (Chronik, `?q=`, Zurück) | Leiste zeigt den blauen Zähler **dieser** Antwort; Übersicht/Thema: Zähler „n Quellen", keine Belege | `use-story-konversation.ts` (Effekt `gezeigteAntwort`) |
| G | D12f | Sitzung mit genau einer Frage, Papierkorb | Rückfrage, dann Netz `DELETE …/queries/<id>` und `DELETE …/chats/<id>`; Sitzung verschwindet aus der Chronik; nächste Frage eröffnet eine neue Sitzung mit eigenem Titel | `use-story-konversation.ts frageLoeschen`, `use-story-sitzungen.ts` (`stand`) |
| H | D12g | Sitzung A aufklappen (nicht aktiv), dann A aktiv machen, Frage stellen, nach B wechseln, A ansehen | A zeigt die neue Frage; A zuklappen/aufklappen → Netz `GET …/queries?chatId=A` erneut | `use-story-sitzungen.ts` (`aktiveFragen`) |
| I | D12h | Alte Antwort (vor D7) wählen, Quellen zu | Zähler = Zahl der Dokumente, nicht der Textstellen | `gallery-root.tsx` Leiste, `helpers.ts anzahlBelegDokumente` |
| J | D12i | Fenster < lg, Antwort mit Belegen, Marke klicken | Blatt „Quellenverzeichnis" öffnet sich mit den Belegen und scrollt zur Karte | `gallery-root.tsx belegSprungZiel`, `references-sheet.tsx` |
| K | D8–D11b | Testplan 02.10. Schritte 1–21 noch einmal zügig | wie dort; bekannte Lücken Abschnitt 6 dort | — |
| X | D12w | Erkunden-Seite, nach unten scrollen bis die Navigation weg ist | Galerie bzw. Story füllt die Höhe bis 16 px über den Rand, kein leeres Band unten | `use-gallery-mode.ts` |
| W | D12v | Erkunden-Seite, Inhalte | Ein Library-Name oben, direkt darunter die Ansichtszeile wie im Story-Modus; keine Plakette, keine Library-Beschreibung, kein Scroll-Effekt | `gallery-root.tsx seitenkopf`, `explore/[slug]/page.tsx` |
| V | D12u | Antwort, Quellen auf | Belegkarte wie Quellenkarte (Symbol rechts), nur der Einklapp-Pfeil, kein X; im Blatt am Telefon bleibt das X | `beleg-karte.tsx`, `beleg-liste.tsx`, `quellen-liste.tsx` |
| U | D12s/t | Fenster 600 px: Story-Zeile; Desktop: Chronik mit langen Fragen | Zeile zeigt nur Symbole, Tooltip nennt den Text, nichts abgeschnitten; Chronik-Einträge zweizeilig mit „…" | `story-header.tsx`, `story-kopfzeile.tsx`, `sitzung-eintrag.tsx`, `gliederung.tsx` |
| T | D12p | Story-Modus öffnen, scrollen | Nur Erkunden-Kopf und Übersichtstitel; Knopfzeile direkt unter dem Kopf, nichts blendet beim Scrollen aus, kein Rand unten | `story-mode-header.tsx`, `story-kopfzeile.tsx` |
| S | D12r | Fenster 800 px: Story-Modus; dann 600 px | 800: Leiste „n Quellen" rechts, aufklappbar, kein Knopf unten, „Themen und Fragen" oben; 600: Knopf „Quellen" oben öffnet das Blatt | `gallery-root.tsx` (istTelefon), `story-header.tsx`, `story-fuss.tsx` |
| R | D12m | Fenster < lg: Übersicht → „Quellenverzeichnis Themenübersicht"; Antwort → Marke klicken | Blatt zeigt dieselben kompakten Listen wie rechts am Desktop (Quellenliste bzw. Belege mit Marken); Markenklick scrollt im Blatt zur Karte | `references-sheet.tsx` |
| Q | D12q | Story-Modus ohne Antwort, Quellen aufklappen; scrollen | Kompakte Karten wie bei den Belegen (Titel, Kennzeile, Status, Original), Zähler „n Quellen", Filter-Chips; am Ende lädt es nach, Netz `GET …/docs?…&skip=50` | `quellen-liste.tsx`, `gallery-root.tsx` (Story-Rechts) |
| O | D12o | Facette setzen, Story-Modus: Übersicht und Themenseite | Neben „n Dokumente · …" steht „gefiltert: Arbeitsgruppe: X ✕ Zurücksetzen"; Zurücksetzen löst den Filter und rechnet die Übersicht neu | `filter-chips.tsx`, `story-uebersicht.tsx`, `story-thema.tsx` |
| N | D12n | Inhalte: Facette „Arbeitsgruppe: Energie" setzen, dann Story-Modus | Zähler „80 Quellen", Galerie nur Energie; Story: „80 Dokumente", Quellenverzeichnis 80; Netz `GET …/docs?…&arbeitsgruppe=Energie` → `total: 80` | `docs/route.ts` (Scope mit Ausschluss) |
| M | D12l | Antwort offen, Belege mit X schließen; dann „Alle n Originalquellen im Katalog" | X: Spalte klappt zur Leiste zu, Zähler zeigt die Belege, Aufklappen zeigt wieder die Belege; Katalog-Knopf: Mitte geht zur Themenübersicht, rechts der Katalog | `beleg-liste.tsx`, `gallery-root.tsx handleZumKatalog`, `story-root.tsx` (Ereignis) |
| L | D12k | Alte Antwort (vor D7, viele Marken) und neue Antwort ansehen, Quellen auf | Marken sind Kreise mit Zahl, je Dokument eine Nummer, keine Doppelmarke hintereinander; Karte kompakt (Marke, Titel, Status, Original), Textstellen erst nach Aufklappen; Tooltip nennt bei neuen Antworten den Titel | `zitatmarke.ts` (util), `antwort-text.tsx`, `beleg-karte.tsx`, `zitatmarken.ts excerpt` |

Befunde: unter „Neu dazugekommen" im Plan (jüngster Stand-Abschnitt), Fixes
als kleine PRs gegen ccr; Tests, tsc-Vergleich, Lint je PR.

## 4. Danach (Testplan 02.10., Abschnitte 4 und 5)

- Embed-Bündel bauen und in der Partner-App ansehen (Belege rechts folgen
  jetzt der Auswahl, `onBelege` liefert `queryId: string | null`).
- Backfill Seite je Chunk: Trockenlauf, `mongodump`, dann `--apply`.
- Owner-Entscheide: D6d (toter App-Chat), `gallery.subtitle`/`story.subtitle`.
- Zum Schluss: `pnpm build` grün auf dem Sammelstand, eine PR ccr → master.

## 5. Lehren

- Gestapelte PRs nicht von unten nach oben in ihre Basis mergen, wenn die
  Basis-Branches stehen bleiben: Die Kette landet dann auf dem obersten
  Zweig, nicht in ccr. Entweder von oben nach unten mergen oder die Spitze
  als eine PR nach ccr.
- Der Schreibtischtest findet Verdrahtungsfehler zwischen Slots; Layout,
  Timing und Mobil brauchen den Live-Blick.

## 6. Hand-off-Block (AGENTS.md §5)

1. **Pre-Merge-Check:** `bash scripts/welle-pre-merge-check.sh` lokal.
2. **Nächste Welle:** Live-Nachweis A–K oben; Befund-Fixes als
   `claude/story-d12j-…`; dann Abschnitt 4.
3. **Modell:** Opus mit Thinking für die Live-Sitzung mit Owner (Netz und
   Dev-Log lesen, Layout beurteilen); Sonnet für Befund-Fixes mit klarer Stelle.
4. **Agent-Typ:** neuer Agent, lokal.
5. **Start-Prompt (kopierbar):**

   > Lies CLAUDE.md, AGENTS.md, docs/guides/verification-playbook.md,
   > docs/handover/2026-10-02-story-dreiteilung-lokaler-test.md und
   > docs/handover/2026-10-03-story-lokaler-test-d12.md. Wir sind auf
   > `ccr-72b5c0ce-oj24xu` (einzige Basis, enthält D8–D12i). Führe zuerst
   > Abschnitt 2 aus (Pre-Merge-Check, `pnpm build`, Tests, Lint,
   > tsc-Vergleich, Embed-Build) und melde das Ergebnis. Dann `pnpm dev` und
   > mit mir Abschnitt 3 Punkt A bis K durchgehen: Ich klicke, du liest
   > Dev-Log und Netzwerk mit (Playbook: frischer Server, eine Aktion, dann
   > messen) und hältst je Punkt „passt" oder Symptom + Vermutung fest.
   > Befunde unter „Neu dazugekommen" im Plan, Fixes als kleine PRs gegen
   > ccr mit Tests, tsc-Vergleich und Lint. Keine Änderung an master ohne
   > meine Freigabe.

6. **Kosten:** Gates und Live-Sitzung 3–6 USD; je Befund-Fix 0,5–1,5 USD.
