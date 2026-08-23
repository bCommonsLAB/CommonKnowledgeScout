# Handover: Werkbank-Wellen-Kickoff (W1–W8)

Stand: 2026-08-23 · für die nächste Online-Session. **EINE Quelle** für alles
Verbindliche ist der Projektauftrag
[`projektauftrag-agentensicht-v2-werkbank.md`](../concepts/projektauftrag-agentensicht-v2-werkbank.md)
— dieses Handover verweist und ordnet ein, es dupliziert nicht.

## Was auf master liegt (PR #179, gemerged 23.08., v1.2.164)

- **Konzept** `docs/concepts/projektauftrag-agentensicht-v2-werkbank.md`:
  Umbau des Baum-Tabs zur **Werkbank** (Master-Detail: links Vorhaben-Liste
  mit Filtern `Alle | Zu tun | Bereit | Liste`, rechts Detail mit gerendertem
  BERICHT.md, Befunden je Akteur, Twin-Familien, Abnehmen). F6–F12,
  Wellenplan §8, zehn Akzeptanzkriterien §9, offene Punkte §13.
- **Mockup** `docs/concepts/mockups/agentensicht-werkbank.html` (statisch,
  drei umschaltbare Zustände; Iterationshistorie Stand 1–5 aus dem Review
  mit Peter, einem UX-Vorschlag in Figma und Artifact-Kommentaren — die
  Stand-Notizen am Dateiende begründen, was übernommen wurde und was
  bewusst nicht).

**Entscheidungen (Peter, 22.–23.08.), im Konzept festgeschrieben:**

1. **Drei Bücher** (Leitprinzip 7): erklärt (Frontmatter) · berechnet
   (Report) · **persönlich** — Arbeitslisten („sich Projekte vornehmen")
   in Mongo je User+Library, unabhängig vom Report-Wegwerf-Test.
2. **Abnahme mit Schutz** (F8): neue Stand-Route schreibt
   `bearbeitungsstand` ins `_INDEX.md`; `abgenommen` nur nach frischem,
   **ungespeichertem** Teilbaum-Precheck; benannter 409-Katalog
   (`kein_index`, `stand_geaendert`, `report_veraltet`, `nicht_bereit`).
3. **Themen-Gruppierung vorgezogen** (F12 = Welle W5): `themen` aus dem
   BERICHT.md-Frontmatter (führend; `_INDEX.md` nur Fallback), Umschalter
   „Gruppieren nach: Bereich | Thema", benannte „Ohne Thema"-Gruppe, kein
   Themen-Editor in der Sicht.
4. **UI bleibt API-only** (v1-Kriterium 5 hält): Bericht-Body kommt über
   eine neue Lese-Route; der Report wird nur um Kleinst-Skalare erweitert.

## Wellenplan (Details + Tests: Konzept §8)

| Welle | Inhalt (Kurzform) | Hängt ab von | Modell |
|---|---|---|---|
| W1 | `VorhabenCard` + `ampel`/`berichtTitel`/`berichtFileId`/`berichtModifiedAt`/`berichtStatus`/`themen`; geteiltes Prädikat „bereit zur Abnahme" (MCP + UI umstellen) | — | Sonnet (eng spezifiziert, typengetrieben) |
| W2 | Bericht-Lese-Route `GET …/agent-view/bericht?folderId=` (`kein_bericht`/`zu_gross`-Semantik, `kopf` serverseitig) | — | Sonnet |
| W3 | Werkbank-Gerüst: Tab, nuqs-URL-Zustand, Resizable, virtualisierte Vorhaben-Liste, Filter/Suche/Sortierung, Leer-Begründungen | W1 | Opus (Layout-/State-Gerüst, viele Teile) |
| W4 | Detail-Panel (Kopf, Bericht-Render, Befunde je Akteur + Auftrag je Vorhaben, Familien, Deep-Links); Board/Todos verlinken | W2, W3 | Sonnet |
| W5 | Themen-Gruppierung (F12): „Bereich \| Thema", Vorhaben je Thema, „Ohne Thema" benannt | W1, W3 | Opus (Gruppierungs-Semantik) |
| W6 | Arbeitslisten: Repo + Routen + Pin/Filter + Fortschrittskopf + tote Einträge sichtbar | W3 | Sonnet |
| W7 | Stand-Route + `stand-plan` (409-Katalog inkl. Precheck) + Abnehmen-UI + lokale Überlagerung | W1 | Opus (Schreibweg mit Schutzstufen) |
| W8 | Teilbaum-Scan-Merge (Voll-Scan ≡ Merge als Test) + Scan-`concurrency` | alle | Opus (Merge-Invariante) |

Reihenfolge-Empfehlung: W1 → W2 → W3 → W4 → W5 → W6 → W7 → W8. W1/W2 sind
reine Backend-Wellen und notfalls parallelisierbar.

## Leitplanken (Erinnerung, verbindlich in AGENTS.md)

- **Eine PR je Welle** mit Hand-off-Block am Ende; Branch-Schema
  `cursor/refactor-welle-<welle>-<beschreibung>-<suffix>` sinngemäß, z. B.
  `cursor/werkbank-w1-vorhabencard-praedikat-<suffix>`.
- Diff-Limits (1.000z/Commit hart, 5.000z/PR weich, max. 15 Commits/PR);
  Dateien ≤ 200 Zeilen; kein `any`; keine stillen Fallbacks.
- Cloud-Agent: `pnpm test` + `pnpm lint`, **kein `pnpm build`**.
- Stop-Bedingungen aus AGENTS.md gelten (rote Tests vor Änderung, fehlende
  Plan-Ziele, >3 Fehlversuche → abbrechen und melden).
- Vor Merge lokal: `bash scripts/welle-pre-merge-check.sh`.

## Start-Prompt für W1 (kopierbar in die neue Session)

> Lies `docs/concepts/projektauftrag-agentensicht-v2-werkbank.md` (§F9 und
> §8, Welle W1) sowie `docs/handover/2026-08-23-werkbank-wellen-kickoff.md`
> und setze **Welle W1** um: Erweitere `VorhabenCard`
> (`src/lib/agent-view/types.ts`) um `ampel`, `berichtTitel`,
> `berichtFileId`, `berichtModifiedAt`, `berichtStatus`, `themen`; fülle
> die Felder in `vorhaben-board.ts`/`tree-builder.ts` aus den beim Scan
> bereits gelesenen Bericht-Daten (`titelLesen` aus
> `sichten/bericht-lesen.ts` wiederverwenden, KEIN zweiter Parser).
> Extrahiere das Prädikat „bereit zur Abnahme" als geteilte Funktion unter
> `src/lib/agent-view/` und stelle `src/lib/mcp/coverage-view.ts` +
> `src/components/library/agent-view/coverage-progress.tsx` darauf um.
> Alte Reports ohne die neuen Felder: sichtbarer Hinweis (Muster „Scan vor
> Welle 4"), kein stiller Fallback. Unit-Tests je neuem Feld + Prädikat.
> `pnpm test` + `pnpm lint`, kein `pnpm build`. Eine PR mit
> Hand-off-Block (nächste Welle: W2, Bericht-Lese-Route).

## Verweise

- Konzept v2: `docs/concepts/projektauftrag-agentensicht-v2-werkbank.md`
- Projektauftrag v1: `docs/concepts/projektauftrag-agentensicht.md`
- Mockup: `docs/concepts/mockups/agentensicht-werkbank.html`
- PR #179 (Konzept-Merge, mit W1-Hand-off im Body)
- Zyklus-Grundlage: `docs/concepts/erschliessungszyklus.md`
