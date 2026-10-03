# Handover: Story-Dreiteilung, Online-Session D12a–D12e (Schreibtischtest, kein Live-Nachweis)

Stand: 02.10.2026, Ende der Cloud-Session. Plan:
[`../plans/story-dreiteilung-fragenchronik.plan.md`](../plans/story-dreiteilung-fragenchronik.plan.md)
(Abschnitte „Stand D12a" bis „Stand D12e" samt „Neu dazugekommen").
Vorgänger-Handover: [`2026-10-02-story-layout-d8-d11b-handover.md`](2026-10-02-story-layout-d8-d11b-handover.md)
(Start-Prompt dort), Testplan in
[`2026-10-02-story-dreiteilung-lokaler-test.md`](2026-10-02-story-dreiteilung-lokaler-test.md) Abschnitt 3.

## 1. Was in dieser Session passiert ist

Basis war `ccr-72b5c0ce-oj24xu` nach dem Merge der Sammel-PR #324 (Head
`6f90875`). Die Cloud hat weder Datenbank noch Secretary noch Clerk — der
Testplan ab Schritt 3 lief deshalb als **Schreibtischtest am Code**
(Datenfluss je Schritt, Subagent mit Tabelle), nicht live. Die Gates auf dem
ccr-Stand: `pnpm test` grün, `pnpm lint` 0 Fehler, tsc-Vergleich 38 Alt-Dateien.

Aus den Befunden sind fünf kleine Wellen entstanden, gestapelt (jede PR hat
die vorige als Basis), die erste gegen ccr:

| PR | Branch | Welle | Inhalt |
|---|---|---|---|
| #325 | `claude/story-d12a-uebersicht-log-lesen` | D12a | `toc`-Log innerhalb der Library für alle lesbar (ohne Erstellerdaten) — behebt den 404 unter der Übersicht (Nebenbefund D6c, Schritt 2) |
| #326 | `claude/story-d12b-cache-treffer-verlauf` | D12b | Cache-Treffer einer Frage bekommt ein eigenes Query-Log in der Sitzung (Stream-Route, `cache-treffer-log.ts`) |
| #327 | `claude/story-d12c-verlauf-sitzungswechsel` | D12c | Sitzungswechsel A→B lässt den Verlauf von A fallen (Chronik, `chatHistory`) |
| #328 | `claude/story-d12d-neu-berechnen-knopf` | D12d | „Themenübersicht neu berechnen" bleibt während der Berechnung und nach einem Fehler stehen; `gesperrt` während einer Frage |
| #329 | `claude/story-d12e-belege-folgen-auswahl` | D12e | Belege rechts folgen der gezeigten Antwort (leer ohne Antwort); Markenklick bei zugeklappten Quellen öffnet die Schicht (`STORY_BELEG_ZEIGEN_EVENT`, `useBelegSprung`); Anker je Nummer |

Spitze der Kette: `claude/story-d12e-belege-folgen-auswahl` (ccr + fünf
Commits + dieses Handover). Je Welle: Unit-Tests der Pakete grün, tsc-Vergleich
leer, Lint 0 Fehler, Plan-Eintrag. **Kein `pnpm build`, kein Live-Nachweis**
— beides ist Aufgabe der nächsten lokalen Sitzung.

## 2. Schreibtischtest: Ergebnis je Schritt (Testplan Abschnitt 3)

Passt am Code: 3, 4, 8, 9, 11, 15, 16, 17, 19, 20. Abweichungen und was
daraus wurde:

| Schritt | Befund | Stand |
|---|---|---|
| 2 | Konfig-Anzeige unter der Übersicht → 404 (fremdes Übersichts-Log) | D12a |
| 5 | Belege der vorigen Antwort bleiben rechts, bis die neue da ist | D12e (laufende Frage meldet leer) |
| 6 | Markenklick bei zugeklappten Quellen tut nichts | D12e |
| 7, 12, 13 | Belege rechts folgen nicht der gewählten älteren Antwort, bleiben bei „Neue Sitzung" stehen | D12e |
| 10, 11, 12, 16 | Sitzungswechsel mischt den Verlauf von A unter B, `chatHistory` falsch | D12c |
| — | Cache-Treffer einer Frage ohne eigenes Log (Chronik, `?q=`, Debug → 404) | D12b |
| 18 | Knopf „neu berechnen" verschwindet beim Rechnen und nach Fehler | D12d |
| 14 | Letzte Frage löschen lässt einen leeren Chat mit altem Titel zurück | offen (Plan, D12e „Neu dazugekommen") |
| 12 | Fragenliste einer einmal aufgeklappten Sitzung veraltet (`geladeneFragen`) | offen |
| 21 | Leisten-Zähler zählt bei alten Antworten Textstellen statt Dokumente | offen |
| 6 mobil | `useBelegSprung` öffnet die Desktop-Schicht, auf Mobil liegen die Belege im Blatt | offen |

## 3. Was laut Plan weiter offen ist

- **Live-Nachweis** aller Wellen D8–D12e im Dev-Server (Secretary nötig),
  insbesondere: Übersicht → Konfig-Anzeige (D12a); dieselbe Frage in zwei
  Sitzungen (D12b); ältere Sitzung wählen (D12c, D12e); Pfeilkreis in der
  Chronik (D12d); Marke klicken bei zugeklappten Quellen (D12e).
- Die vier offenen Befunde oben (14, 12, 21, mobil) als kleine PRs.
- Abschnitt 4 Embed-Bündel (`pnpm --filter @ks/embed build`) — D12e ändert
  `embed-story.tsx` (`queryId ?? undefined`) und `@ks/contracts`.
- Abschnitt 5 Backfill Seite je Chunk (Trockenlauf, dann `--apply` nach `mongodump`).
- D6d (toter App-Chat), `gallery.subtitle`/`story.subtitle` — Owner-Entscheid.
- Zum Schluss: `pnpm build` lokal auf dem ccr-Stand, eine PR ccr → master.

## 4. Lehren aus dieser Session

- Ein Schreibtischtest am Code findet die Verdrahtungsfehler zwischen
  Slots (Belege, Verlauf, Atome), die kein Unit-Test je Paket sieht. Was er
  nicht ersetzt: Layout und Timing — das braucht den Live-Blick.
- Der Antwort-Cache ist benutzerübergreifend; alles, was eine `queryId` an
  die Person bindet (Verlauf, `?q=`, Debug), muss ein eigenes Log haben
  (D12b) oder die Kennung als fremd behandeln (D12a).
- Commit-Messages mit `„…"` nur über `-F <Datei>` — ein ASCII-`"` in
  `-m "…"` bricht die Shell.

## 5. Hand-off-Block (AGENTS.md §5)

1. **Pre-Merge-Check:** `bash scripts/welle-pre-merge-check.sh` lokal vor
   dem Merge der Kette nach ccr.
2. **Nächste Welle:** lokaler Live-Test ab Schritt 3 mit laufendem Secretary
   auf `claude/story-d12e-belege-folgen-auswahl` (oder ccr nach dem Merge der
   Kette); Befunde als kleine PRs; dann die vier offenen Punkte aus
   Abschnitt 2. Branch-Schema `claude/story-d12f-…` bzw. `d13-…`.
3. **Modell:** Sonnet für die vier offenen Befunde (Stelle und Vorschlag
   stehen im Plan); Opus mit Thinking für den Live-Test mit Owner (Layout,
   Timing, Netz lesen).
4. **Agent-Typ:** neuer Agent, lokal (Dev-Server, Prod-DB nur lesend, Fragen
   schreiben Chats und Query-Logs).
5. **Start-Prompt (kopierbar):**

   > Lies CLAUDE.md, AGENTS.md, docs/guides/verification-playbook.md,
   > docs/handover/2026-10-02-story-dreiteilung-lokaler-test.md und
   > docs/handover/2026-10-02-story-online-d12.md. Wir sind auf
   > `claude/story-d12e-belege-folgen-auswahl` (bzw. ccr, falls #325–#329
   > gemergt sind). Führe `pnpm build`, `pnpm test`, `pnpm lint` und den
   > tsc-Vergleich aus und melde das Ergebnis. Dann `pnpm dev` und mit mir
   > den Testplan ab Schritt 3 live durchgehen, mit Schwerpunkt auf den
   > Nachweisen für D12a–D12e (Abschnitt 3 des Online-Handovers). Befunde
   > unter „Neu dazugekommen" im Plan, Fixes als kleine PRs gegen die Basis
   > mit Tests, tsc-Vergleich und Lint. Keine Änderung an master ohne meine
   > Freigabe.

6. **Kosten:** vier Befund-Fixes je 0,5–1,5 USD; Live-Test-Sitzung mit
   Owner 3–6 USD (viele kleine Runden).
