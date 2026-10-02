# Handover: Story-Dreiteilung, Layout-Wellen D8–D11b (lokal getestet, Online-Fortsetzung)

Stand: 02.10.2026, Ende der lokalen Sitzung. Plan:
[`../plans/story-dreiteilung-fragenchronik.plan.md`](../plans/story-dreiteilung-fragenchronik.plan.md)
(Abschnitte „Stand D8" bis „D11b" unter „Stand D6c … Neu dazugekommen").
Vorgänger-Handover: `2026-10-02-story-dreiteilung-lokaler-test.md` (Testplan
Abschnitt 3, Schritte 1–21).

## 1. Was heute passiert ist

Die Gates aus dem Vorgänger-Handover (Pre-Merge-Check, `pnpm build`, Tests,
Lint, tsc-Vergleich) sind auf dem ccr-Branch durchgelaufen (Build grün). Beim
Live-Test ab Schritt 1 hat der Owner das Layout mit dem Figma-Klickmodell
verglichen; daraus sind acht kleine Wellen entstanden, jede als eigene PR,
**gestapelt** (jede PR hat die vorige als Basis), alle gegen den Branch
`ccr-72b5c0ce-oj24xu`:

| PR | Branch | Welle | Inhalt |
|---|---|---|---|
| #317 | `claude/story-fix-tsc-sitzungen-test` | — | 3 neue tsc-Fehler in `use-story-sitzungen.test.tsx` (Fetch-Stub-Signatur) |
| #318 | `claude/story-d8-sitzungsstart` | D8 | Themenübersicht eröffnet keine Sitzung mehr; `scripts/cleanup-toc-chats.ts` (Trockenlauf Prod: 490 zu löschen, 55 umzubenennen; `--apply` hat der Owner im eigenen Terminal ausgeführt, Chronik danach sauber) |
| #319 | `claude/story-d9-kopf-plaketten` | D9 | Perspektive als Plaketten; Chronik ohne Aufruf bei leerer Library (405) |
| #320 | `claude/story-d10-kopf-der-seite` | D10 + D10b | Kopf der Seite für beide Ansichten: Library-Titel oben, Ansichtszeile mit ⓘ-Erklärung (`AnsichtsZeile`, `useAnsichtErklaerung` in `@ks/ui`); Plaketten nur Gesetztes; Modelltitel zurück vor die Themen |
| #321 | `claude/story-d10c-chronik-einstieg` | D10c | Chronik hebt beim Einstieg keine Sitzung hervor |
| #322 | `claude/story-d10d-fehlertext` | D10d | Klartext bei nicht erreichbarem Secretary (`StoryFehlerCode`) |
| #323 | `claude/story-d11a-neu-berechnen-chronik` | D11a | „Themenübersicht neu berechnen" dezent in der Chronik-Zeile |
| #324 | `claude/story-d11b-quellen-leiste` | D11b | Quellen als fliegendes Verzeichnis (Leiste 56 px, Schicht über der Mitte, Browser merkt sich „auf"); KI-Hinweis in Laien-Sprache; Galerie-Rahmen nutzt die volle Höhe |

Die Spitze der Kette ist `claude/story-d11b-quellen-leiste`; sie enthält
alles (ccr-Head c1037065 + die acht Wellen). Figma: Seite „Klickmodell D0 v3",
Bildschirme „6 · Kopf der Seite", „Schritt 7 · Kopf für beide Ansichten",
„Schritt 8 · Quellen als fliegendes Verzeichnis" (Node `27-557`).

Alle Wellen: Unit-Tests grün, tsc-Vergleich leer (143 Alt-Fehler, keine neue
Datei), Lint 0 Fehler, live im Dev-Server gesehen. **`pnpm build` lief nur
auf dem ccr-Head**, nicht auf der Kette — Pflicht vor dem Merge nach master.

## 2. Wie es weitergeht (Owner-Entscheidung 02.10.: noch nicht nach master)

**Nachtrag 02.10. (Owner):** Die acht Einzel-PRs sind zu **einer Sammel-PR
zusammengefasst: #324 `claude/story-d11b-quellen-leiste` → ccr** (13
Commits, der Commit aus #317 per Cherry-pick dazu). #317–#323 sind
geschlossen, ihre Branches und Beschreibungen bleiben als Beleg je Welle.
Nach dem Merge von #324 ist ccr die Summe aller Wellen und die Basis für die
nächste Online-Session. master bleibt unberührt.

Alternative ohne Merge: Die Online-Session zweigt direkt von
`claude/story-d11b-quellen-leiste` ab und stapelt weiter.

## 3. Was laut Plan offen ist

1. **Testplan Abschnitt 3 ab Schritt 3** (Vorgänger-Handover): Thema, Frage,
   Antwort mit Zitatmarken ①, Belege rechts (jetzt im fliegenden Verzeichnis),
   Seitenknopf am PDF, Kurztitel, `q=` neu laden, Zurück-Knopf, ältere
   Sitzung, Umbenennen, Löschen, Filter, Fuß, Mobil, alte Antwort. Secretary
   muss laufen (lokal 127.0.0.1:5001 oder entfernte Instanz in `.env`).
2. **Abschnitt 4** Embed-Bündel bauen (`pnpm --filter @ks/embed build`),
   **Abschnitt 5** Backfill Seite je Chunk (Trockenlauf, dann `--apply`
   nach `mongodump`).
3. **D6d**: toten App-Chat entfernen — Owner entscheidet, ob der Chat-Reiter
   zurückkommt.
4. **Nebenbefunde** (Plan, Stand D6c): Konfig-Anzeige unter der Übersicht
   bekommt 404 (Übersichts-Cache ist benutzerübergreifend, Lesen filtert
   nach Person); Embed bekommt die Story-Texte der Library nicht.
5. **Konfig-Felder ohne Anzeige**: `gallery.subtitle`, `story.subtitle`
   werden seit D10b nirgends gezeigt — behalten oder entfernen.
6. **Designkonzept**: Zustimmungsbalken, Dokumente je Thema zählen.
7. **Zum Schluss**: `pnpm build` lokal auf dem ccr-Stand, dann die eine PR
   ccr → master.

## 4. Lehren aus dieser Sitzung (für die nächste)

- Figma zuerst hat sich bewährt: D10 wurde nach dem Live-Blick umgebaut
  (D10b), weil der Hinweis in der Mitte und der „?"-Knopf nicht passten.
- `ResizablePanelGroup`: ein wechselnder `key` baut alle Spalten neu auf —
  die Themenübersicht lief erneut an. Panels über `id`/`order` ein- und
  ausblenden, Schlüssel stabil halten.
- Der Freigabe-Filter im Auto-Modus verweigert Prod-Lesezugriffe und
  `mongodump` unregelmäßig; Prod-Läufe als PowerShell-Befehle an den Owner
  geben (Memory `feedback-prod-operationen-owner-terminal`).
- Die `.env` des Worktrees zeigt auf die **Prod-DB**; jede Frage im Test
  schreibt dort Chats und Query-Logs.

## 5. Hand-off-Block (AGENTS.md §5)

1. **Pre-Merge-Check**: `bash scripts/welle-pre-merge-check.sh` (lokal; die
   Sperrliste `.sperrliste.local` fehlt derzeit auch im Hauptcheckout).
2. **Nächste Welle**: Testplan ab Schritt 3 mit Befunden als kleine PRs;
   parallel D6d nach Owner-Entscheid. Branch-Schema wie bisher
   `claude/story-<welle>-<beschreibung>`, Basis ccr (nach Merge der Kette)
   oder `claude/story-d11b-quellen-leiste`.
3. **Modell**: Sonnet für Befund-Fixes mit klarer Stelle; Opus mit Thinking,
   wenn Layout oder Paket-API betroffen sind (wie D10b, D11b).
4. **Agent-Typ**: neuer Agent (Default).
5. **Start-Prompt** (kopierbar):

   > Lies CLAUDE.md, AGENTS.md, docs/guides/verification-playbook.md,
   > docs/handover/2026-10-02-story-dreiteilung-lokaler-test.md und
   > docs/handover/2026-10-02-story-layout-d8-d11b-handover.md. Basis ist
   > `claude/story-d11b-quellen-leiste` (oder ccr, falls die Sammel-PR
   > #324 gemergt ist). Gehe den Testplan in Abschnitt 3 des ersten
   > Handovers ab Schritt 3 durch; Befunde unter „Neu dazugekommen" im Plan,
   > Fixes als kleine PRs gegen die Basis mit Tests, tsc-Vergleich und Lint.
   > Kein `pnpm build` in der Cloud. Keine Änderung an master.

6. **Kosten**: Befund-Fixes je 0,5–2 USD; eine Layout-Welle wie D11b 3–5 USD.
