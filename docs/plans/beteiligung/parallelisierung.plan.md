---
title: Parallelisierung — Verträge zuerst, dann Module in getrennten Sessions
date: 2026-09-24
status: vorgeschlagen (Owner 24.09.: so vorgehen)
overview: "Wie die Beteiligung (D1–D11) so gebaut wird, dass mehrere Cloud-Sessions gleichzeitig arbeiten: eine Vertrags-Welle legt Feldkatalog, Typen, Repository-Schnittstellen, Routen-Verträge, Zustände und Fixtures fest; danach bauen bis zu sechs Sessions parallel je ein Modul in eigenen Verzeichnissen; am Ende eine Verdrahtungs-Session. Mit Start-Prompt je Session."
---

# Parallelisierung: Verträge zuerst, dann Module isoliert

**Zweck.** Die Detailkonzepte D1–D11 hängen zusammen, aber nicht überall.
Wer die Nahtstellen einmal festschreibt, kann die Module danach getrennt
bauen. Dieser Plan legt fest, was vorher festgeschrieben wird (Welle 0),
welche Sessions danach gleichzeitig laufen (Welle 1 und 2), wie sie
verbunden werden (Welle 3) und mit welchem Prompt jede Session startet.

**Voraussetzungen.**
- Entscheidungen O1, O2, O10–O20 aus [`README.md`](README.md) sind getroffen.
  Ohne O10 (Owner-Prüfung) und O12 (Promotion-Zeitpunkt) kann Welle 0 die
  Verträge nicht schneiden.
- Der SessionStart-Hook (`.claude/hooks/session-start.sh`) ist auf `master`,
  damit `pnpm test`, `pnpm lint` und der tsc-Vergleich in jeder Cloud-Session
  laufen.
- Jede Session liest zuerst `CLAUDE.md`, `AGENTS.md`, `docs/STAND.md`, diese
  Datei, [`README.md`](README.md) und ihr Detailkonzept; bei Code-Änderungen
  die Contracts aus dem Routing-Index in `CLAUDE.md`.

## 1. Prinzip

1. **Ein Vertragspaket, eingefroren.** `packages/deliberation-contracts`
   (`@ks/deliberation-contracts`) enthält nur Typen, Zod-Schemas,
   Repository-Schnittstellen, In-Memory-Testdoubles und Fixtures. Kein
   Funktionscode, keine Mongo-, Storage- oder Next-Abhängigkeit. Nach Welle 0
   ändert es niemand nebenbei: Eine Vertragsänderung ist eine eigene kleine
   PR (`contracts:`-Präfix im Titel), die alle laufenden Sessions per Rebase
   übernehmen.
2. **Ein Modul, ein Verzeichnis, eine Session.** Jede Bau-Session bekommt im
   Prompt ihre Verzeichnisse und das Verbot, außerhalb zu schreiben. Ein
   PR-Diff außerhalb der genannten Pfade ist ein Befund, kein Versehen.
3. **Zwei Testschichten in derselben Session (Owner 24.09.).** Schnell:
   Unit-Tests gegen die In-Memory-Doubles und die Fixtures, ohne Netz.
   Echt: eine **Flow-Simulation** gegen eine Test-Mongo und echte Dateien
   in der Cloud-Session selbst (§8), damit jede Session Ursache und Wirkung
   am laufenden System prüft, nicht nur an Attrappen. Die endgültige
   Prüfung eines Flusses bleibt die lokale Offline-Session mit Secretary
   und dem echten Archiv.
4. **Merge-Reihenfolge nur zwischen Wellen.** Welle 0 ist auf `master`, bevor
   Welle 1 startet. Innerhalb einer Welle ist die Reihenfolge egal.
5. **AGENTS.md gilt.** Eine PR je Session, Diff-Limits, Hand-off-Block,
   `pnpm test` + `pnpm lint` + tsc-Vergleich grün, kein `pnpm build` in der
   Cloud, Repo-Bericht ins Archiv am Ende.

## 2. Welle 0: Verträge (eine Session, sequenziell)

Die teuerste Einzelsession. Sie erledigt die Überarbeitung nach dem
[Prüfbericht](pruefbericht-2026-09-24.md) §6.2 gleich mit, weil die
dreizehn Widersprüche (W1–W13) genau an den Nahtstellen liegen, die hier
festgeschrieben werden.

### 2.1 Lieferumfang

| Datei | Inhalt | Löst |
|---|---|---|
| `docs/plans/beteiligung/feldkatalog.md` | Anhang zu D0: jeder Frontmatter- und Facettenname genau einmal (Singular/Plural festgelegt), Listensyntax je Parser, welche Datei über welchen Weg ingestiert wird, Verweisschema (`*_id` als Kennung, `fileId` nur Cache mit Re-Resolve) | W6, W8, W9 |
| `packages/deliberation-contracts/src/types.ts` | Interfaces: `Series`, `TextPassage`, `Meeting` (mit `settings` = die 13 Schalter, `mode: live \| probe`), `MeetingTable` (mit `run`, `windows[]`, `closedAt`, `revision`), `TableParticipation` (`attribution.kind: person \| proxy \| table`), `DeliberationSubmission` (Anlagen, `context`, `attribution.scope`), `Measurement`, `Assessment`, `Synthesis`, `Result` (`ergebnis_art: konsens \| dissens`) | W1, W2, W3, W10, W13, A2, A5, A6 |
| `packages/deliberation-contracts/src/schemas.ts` | Zod-Schemas zu allen Typen, dazu Request/Response je Route | — |
| `packages/deliberation-contracts/src/repositories.ts` | Repository-Schnittstellen (nur Signaturen) je Collection; Namensschema `<domain>__<lib>` wie `mongodb-repository-pattern.md` | — |
| `packages/deliberation-contracts/src/routes.ts` | Pfade, Methoden, Fehlercodes: `meetings/release`, `tables/[id]/actions`, `tables/[id]/state`, `windows/[id]/submissions`, `measurements/[id]/…`, `syntheses`, `results`, `/t/[qrToken]` | W4, W5 |
| `packages/deliberation-contracts/src/runtime.ts` | Zustände und Aktionen der Laufzeit als Map (kein Enum): `start_meeting, pause, resume, next_item, extend, open_window {measurementId?}, close_window, close_table, mirror, mirror_source, end_meeting`; Vorbedingungen je Aktion als Tabelle im Kommentar | W4, W5, W13 |
| `packages/deliberation-contracts/src/roles.ts` | `resolveDeliberationRole(snapshot, userEmail, tableId)` mit Rechte-Matrix (inkl. Rolle `begleitung`) und Tests | A4, W11 |
| `packages/deliberation-contracts/src/testing/*.ts` | In-Memory-Implementierung je Repository-Schnittstelle, `serverNow`-Uhr als Injektion | — |
| `packages/deliberation-contracts/fixtures/probe-treffen/**` | Ein vollständiges Probe-Treffen als Dateien (`_reihe.md`, Textstellen, `_treffen.md`, zwei `_tisch.md`, zwei `_organisation.md`) und der dazu erwartete Snapshot als JSON | — |
| D0, D1, D3, D5, D6, D7, D8, D11 | überarbeitet nach Prüfbericht §6.2 und Owner-Entscheidungen; die Konzepte verweisen auf die Vertragsdateien statt eigene Feldnamen zu führen | alle |
| `docs/plans/beteiligung/spikes/2026-*.md` | Ergebnis der zwei Spikes (Promotion als Job am Tisch-Abschluss; Bildweg mit Inbox-Library), je eine Seite: was geprüft, was gemessen, was daraus im Vertrag steht | — |
| `scripts/beteiligung-probe-treffen.ts` | Test-Library in der Test-Mongo anlegen, Fixtures in den Dateispeicher legen, alles wieder entfernen (§8.4) | — |
| `README.md` | Aufwand neu geschätzt, je Session | — |

### 2.2 Abnahme

Welle 0 wird vom Owner abgenommen, bevor Welle 1 startet: Feldkatalog
und Typen einmal lesen, das Probe-Treffen in den Fixtures ist die
Lesehilfe. Ein falscher Vertrag kostet danach sechs Sessions gleichzeitig.

### 2.3 Start-Prompt Welle 0

```
Lies CLAUDE.md, AGENTS.md, docs/STAND.md, docs/plans/beteiligung/parallelisierung.plan.md,
docs/plans/beteiligung/README.md (Entscheidungen O1–O20 sind eingetragen),
docs/plans/beteiligung/pruefbericht-2026-09-24.md vollständig und
docs/plans/beteiligung-objektmodell-original-und-kopie.plan.md.
Aufgabe: Welle 0 nach parallelisierung.plan.md §2. Reihenfolge:
(1) die zwei Spikes aus Prüfbericht §6.3, je ein halber Tag, Ergebnis als
Seite unter docs/plans/beteiligung/spikes/; (2) Feldkatalog; (3) das Paket
packages/deliberation-contracts mit Typen, Zod-Schemas,
Repository-Schnittstellen, Routen-Verträgen, Laufzeit-Aktionen,
resolveDeliberationRole, In-Memory-Doubles und Fixtures des Probe-Treffens,
alles mit Unit-Tests; (4) D0, D1, D3, D5, D6, D7, D8, D11 nach Prüfbericht
§6.2 überarbeiten, so dass jeder Feldname aus dem Katalog kommt und jeder
Widerspruch W1–W13 an genau einer Stelle aufgelöst ist; (5) README-Aufwand
je Session neu schätzen. Regeln: Interfaces statt Types, keine Enums,
flaches Frontmatter, no-silent-fallbacks, Dateien max. 200 Zeilen. Kein
Funktionscode außerhalb des Pakets. Branch claude/beteiligung-w0-vertraege,
mehrere PRs erlaubt (Spikes getrennt), pnpm test, pnpm lint und der
tsc-Vergleich aus AGENTS.md grün. Am Ende Hand-off-Block nach AGENTS.md und
Repo-Bericht ins Archiv.
```

Modell: das stärkste verfügbare, hoher Denk-Aufwand. Neuer Agent.

## 3. Welle 1: sechs Sessions parallel

Alle starten nach dem Merge von Welle 0. Keine ändert das Vertragspaket.

| # | Session | Konzept | Eigene Verzeichnisse | Braucht |
|---|---|---|---|---|
| 1 | Owner-Prüfung im Bestand (O10) | Prüfbericht §1 | `src/lib/services/library-service.ts`, `src/lib/repositories/library-members-repo.ts`, `src/lib/submissions/capture-access.ts`, `src/lib/storage/server-provider.ts`, `src/lib/chat/publication-filter.ts`, `src/lib/chat/loader.ts`, zugehörige Tests | nichts aus Welle 0; kann auch vorher laufen |
| 2 | Planung lesen und freigeben | D1 | `src/lib/deliberation/plan/**`, `src/app/api/deliberation/[libraryId]/meetings/**`, `src/lib/mcp/tools-beteiligung.ts` (nur `treffen_freigeben`), `tests/unit/deliberation/plan/**` | Feldkatalog, Typen, Fixtures |
| 3 | Organisationen, Beitritt, Teilnahme | D2 | `src/lib/deliberation/participation/**`, `src/app/api/deliberation/[libraryId]/participations/**`, `src/app/t/[qrToken]/**`, `src/middleware.ts` (nur die Zeile für `/t`), `tests/unit/deliberation/participation/**` | Typen, `roles.ts`, Routen-Vertrag `/t` |
| 4 | Tisch-Laufzeit, Polling, Beamer | D4 | `src/lib/deliberation/runtime/**`, `src/app/api/deliberation/[libraryId]/tables/**`, `src/app/beamer/**`, `tests/unit/deliberation/runtime/**` | `runtime.ts`, Typen, `serverNow`-Uhr |
| 5 | Messen, reine Auswertung | D7 | `src/lib/deliberation/measurement/**`, `src/app/api/deliberation/[libraryId]/measurements/**`, `tests/unit/deliberation/measurement/**` | Typen, O17-Regel |
| 6 | Bestandseingriffe, vier kleine PRs | README „Eingriffe“ | (a) `promoteSubmission(…, {ingest:false})` in `src/lib/submissions/promotion.ts` + `promote-actions.ts`; (b) `enqueueSourceMarkdownJob({ingest:false})` in `src/lib/external-jobs/enqueue-markdown-job.ts`; (c) Bildweg und PDF-Weg der Start-Route auf `resolveJobLibrary`/`resolveShadowTwinLibrary`; (d) Protokoll-Kanal `'app'` in `aktions-protokoll-repo.ts`, `chat.allowMemberRoles` nach `library-config-field.md` | Spike 2 aus Welle 0 für (c) |

Die Oberflächen (Wellen-Plan, Figma) starten ab Welle 1 ebenfalls parallel
als eigene Sessions gegen die Routen-Verträge mit Attrappen aus
`testing/`; sie sind hier nicht aufgeführt, weil sie ein eigenes
Verzeichnis (`src/components/deliberation/**`) und eigene Abnahme haben.

### 3.1 Gemeinsamer Prompt-Kopf für Welle 1 und 2

Jeder Start-Prompt beginnt mit diesem Block; darunter steht der
Session-Teil.

```
Lies CLAUDE.md, AGENTS.md, docs/STAND.md,
docs/plans/beteiligung/parallelisierung.plan.md, docs/plans/beteiligung/README.md,
docs/plans/beteiligung/feldkatalog.md und das Paket
packages/deliberation-contracts (README, types.ts, routes.ts, runtime.ts,
testing/). Das Vertragspaket ist eingefroren: Du änderst es nicht. Brauchst
du eine Vertragsänderung, beschreibe sie im Hand-off als Vorschlag für eine
eigene contracts:-PR und arbeite mit einem lokalen Adapter weiter. Du
schreibst ausschließlich in die unten genannten Verzeichnisse; Tests laufen
gegen die In-Memory-Doubles und die Fixtures des Probe-Treffens, ohne Mongo.
Regeln: Interfaces statt Types, keine Enums, no-silent-fallbacks,
storage-abstraction, Dateien max. 200 Zeilen, Kommentare und Commits auf
Deutsch, keine realen Personennamen. Eine PR, pnpm test, pnpm lint und der
tsc-Vergleich aus AGENTS.md grün, kein pnpm build. Am Ende Hand-off-Block
nach AGENTS.md und Repo-Bericht ins Archiv.
```

### 3.2 Session-Teile Welle 1

**Session 1, Owner-Prüfung (O10):**
```
Aufgabe: Prüfbericht §1. LibraryService.getLibrary lässt jedes aktive
Mitglied durch; isModeratorOrOwner, isCoCreatorOrOwner, resolveCaptureRole,
der Provider-Fallback in server-provider.ts, canSeeDrafts und der
Chat-Loader nutzen das als Owner-Prüfung. Schreibe zuerst Unit-Tests, die
die heutige Wirkung nachweisen (Contributor bekommt Chat und Entwürfe,
Moderator bekommt Storage und Erfassung), dann stelle die sechs Helfer auf
eine strikte Prüfung je Rolle über getActiveMemberRole um, ohne das
Verhalten für Owner und Co-Creator zu ändern. Sicherheitsrelevant: keine
weiteren Änderungen in derselben PR. Branch claude/beteiligung-w1-o10.
```

**Session 2, Planung (D1):**
```
Aufgabe: D1 nach docs/plans/beteiligung/d01-veranstaltung-aufsetzen.plan.md
(Fassung nach Welle 0; der Prüfschritt entfällt, Owner 24.09.). Baue
parsePlanFile, buildReleasePlan und applyRelease in src/lib/deliberation/plan/,
die Route meetings/release und das MCP-Werkzeug treffen_freigeben. Freigeben
liest die Dateien des Probe-Treffens aus den Fixtures, schreibt den
Snapshot als neue release.version über die Repository-Schnittstellen und
scheitert laut bei unlesbarer Datei oder fehlendem Pflichtfeld. Der
erzeugte Snapshot muss dem erwarteten JSON in den Fixtures gleichen.
Branch claude/beteiligung-w1-d1-planung.
```

**Session 3, Organisationen und Teilnahme (D2):**
```
Aufgabe: D2 nach docs/plans/beteiligung/d02-organisationen-und-personen.plan.md.
Baue Rollen-Einladung beim Freigeben (addMember ohne Herabstufung),
QR-Token-Route /t/[qrToken] mit Ablauf und Erneuern, joinAsContributor
(nur wenn O2 in README auf „ja“ steht, sonst Stub mit Fehler
„nicht freigegeben“), Platz am Tisch mit Organisation, Interessengruppe
und Tischvereinbarung (agreementReadAt), Vertretung als
attribution.kind: proxy mit optionaler E-Mail. Rechte über
resolveDeliberationRole aus dem Vertragspaket; Moderations-Anhebung beim
Beitritt (W11). Branch claude/beteiligung-w1-d2-teilnahme.
```

**Session 4, Tisch-Laufzeit (D4):**
```
Aufgabe: D4 nach docs/plans/beteiligung/d04-tisch-laufzeit.plan.md. Baue
den Zustandsautomaten aus runtime.ts (alle Aktionen inkl. close_table,
mirror_source; next_item schließt nie implizit ein Fenster; open_window
trägt measurementId; 409 bei revision-Konflikt; Wiederholung eines
close_window ist Erfolg), die Routen tables/[id]/actions und
tables/[id]/state mit serverNow, sowie die Beamer-Seite ohne App-Rahmen.
Stille Runde als Server-Regel: bei offenem Fenster liefert state keine
Beitragstexte, nur wer abgegeben hat. Branch claude/beteiligung-w1-d4-laufzeit.
```

**Session 5, Messen (D7):**
```
Aufgabe: D7 nach docs/plans/beteiligung/d07-messen.plan.md. Baue
evaluate() als reine Funktion (vier Stufen, Passivlösung im Modell,
Gruppen unter minGroupSize zu „übrige“, Delta ab Runde 2, Abbruchhinweis,
O17: nach Runde 2 mit bleibendem Einwand muss die Moderation ausdrücklich
Runde 3, vertagen oder Dissens wählen), die Repos für measurements und
assessments über die Schnittstellen, und die Routen measurements/[id]/…
Kein Fenster schließen hier, das tut D4. Branch claude/beteiligung-w1-d7-messen.
```

**Session 6, Bestandseingriffe:**
```
Aufgabe: vier getrennte kleine PRs nach README „Eingriffe in den Bestand“,
jede mit Freeze-Test vorher (heutiges Verhalten bleibt ohne die neue
Option): (a) promoteSubmission mit {ingest:false}; (b)
enqueueSourceMarkdownJob mit {ingest:false}; (c) Bildweg und PDF-Weg der
Job-Start-Route auf resolveJobLibrary/resolveShadowTwinLibrary nach dem
Ergebnis von Spike 2; (d) Protokoll-Kanal 'app' und Library-Einstellung
chat.allowMemberRoles nach library-config-field.md. Contracts:
contracts-pipeline und contracts-ingestion-chat vorher lesen. Branches
claude/beteiligung-w1-eingriff-a … -d.
```

Modellempfehlung Welle 1: Session 1 und 6 mit dem stärksten Modell
(Rechte, Pipeline-Eingriffe). Session 2–5 mit dem mittleren Modell und
hohem Denk-Aufwand; die Verträge tragen die Last.

## 4. Welle 2: vier Sessions parallel

Start nach dem Merge von Welle 1, Session 6 (Eingriffe) und Session 4
(Laufzeit). Prompt-Kopf wie 3.1.

| # | Session | Konzept | Eigene Verzeichnisse | Braucht aus Welle 1 |
|---|---|---|---|---|
| 7 | Beitragen (Composer-Backend) | D3 | `src/lib/deliberation/contribution/**`, `src/app/api/deliberation/[libraryId]/windows/**`, Erweiterung `wizard-submissions-repo.ts` nur um `expectedVersion` | Eingriff (c), Laufzeit (Fenster offen/zu) |
| 8 | Ablage am Tisch-Abschluss (Beiträge werden Dateien) | D5 | `src/lib/deliberation/archive/**`, Job-Typ `table-close` in `src/lib/external-jobs/` (nur neue Dateien), `tests/unit/deliberation/archive/**` | Eingriff (a), Spike 1, O12, O15 |
| 9 | Verdichten | D6 | `src/lib/deliberation/synthesis/**`, Vorlage `shf-synthese-de` unter `template-samples/`, Route `syntheses` | Eingriff (b), Sammelreferenz |
| 10 | Ergebnis, Ingest, Beauskunften | D8, D9 | `src/lib/deliberation/result/**`, Route `results`, `DocReference.sourceLabel` in `packages/contracts`, Facetten-Prüfung vor dem ersten Ingest (Fehler, keine Warnung), Chat-Eingrenzung mit Umschalter (O18) | Feldkatalog, Eingriff (d) |

D10 (nächstes Treffen, Historie, Folgegruppen mit O19) kommt als
Session 11 nach Welle 2, weil es D7 und D8 im Lauf braucht.

**Session 7, Beitragen (D3):**
```
Aufgabe: D3 nach docs/plans/beteiligung/d03-beitragen.plan.md. Entwurf ab
dem ersten Wort (draft, Autosave mit expectedVersion, 409 bei Konflikt),
Abgabe nur bei offenem Fenster (Laufzeit-Zustand über die Schnittstelle),
Anlagen mit je einem Analyse-Job (attachmentId), Rückfluss nur in die
Anlage, attribution.kind und scope aus dem Vertrag, Widerruf bis
Tisch-Abschluss als Markierung. Ton wird nie hochgeladen. Branch
claude/beteiligung-w2-d3-beitragen.
```

**Session 8, Ablage (D5):**
```
Aufgabe: D5 nach der Fassung aus Welle 0 (Promotion am Tisch-Abschluss,
O12). Baue den Job table-close: je abgegebenem Beitrag eine Datei im
Organisationsordner nach Feldkatalog (Name mit Kurz-Id, Frontmatter ohne
Personenname bei V1, Anlagen daneben, ingest:false), vorläufige
Organisationsordner, Sammelreferenz je Tisch und Textstelle als letzte
Stufe, Wiederholung idempotent (Datei gleichen Namens: Inhalt vergleichen,
nie still überspringen), Zustand promotion.state am Tisch. Der Job läuft
mit dem Provider der Moderation über ihre Rolle, nie mit
Owner-Credentials (O15). Branch claude/beteiligung-w2-d5-ablage.
```

**Session 9, Verdichten (D6):**
```
Aufgabe: D6 nach docs/plans/beteiligung/d06-verdichten.plan.md. Hauptweg
ist der eingesprochene Vorschlag der Moderation (O13, Live-Diktat aus
live-transkription.md); Zweitweg die KI-Synthese über
enqueueSourceMarkdownJob({ingest:false}) auf die Sammelreferenz mit
Vorlage shf-synthese-de (Alle Stimmen / Fokus / Warum / Zur Messung).
Vorbedingung promotion.state = fertig, sonst 409. pruefeBelege als reine
Funktion, Fassungen in syntheses. Branch claude/beteiligung-w2-d6-verdichten.
```

**Session 10, Ergebnis und Beauskunften (D8, D9):**
```
Aufgabe: D8 und D9. Bestätigen (Entwurfsdatei, kein Index) und Freigeben
(neue Fassungsdatei, Ingest über upsertMarkdown), ergebnis_art
konsens/dissens, die geltenden Einstellungen des Treffens ins
Ergebnis-Frontmatter (A2), redigiert_von und Abweichungshinweis (O20).
Facetten aus dem Feldkatalog müssen vor dem ersten Ingest konfiguriert
sein, sonst Fehler. DocReference.sourceLabel und chat.referenceLabelKeys;
Chat am Tisch mit Handlungsfeld als Voreinstellung und sichtbarem
Umschalter (O18); ein ignorierter Filter ist 400. Branch
claude/beteiligung-w2-d8-d9-ergebnis.
```

## 5. Welle 3: Verdrahtung (eine Session)

Start nach dem Merge von Welle 2 und Session 11.

```
Aufgabe: Verdrahtung nach parallelisierung.plan.md §5. Verbinde die Module
über die Verträge: close_table startet den Job table-close; die Synthese
prüft promotion.state; das Ergebnis geht in den Ingest; die Historie (D10)
liest aus results und measurements. Ersetze die In-Memory-Doubles durch
Mongo-Repos, die dieselben Schnittstellen-Tests bestehen. Schreibe einen
Integrationstest, der das Probe-Treffen aus den Fixtures von Freigeben bis
zur freigegebenen Fassung durchläuft (ohne Secretary: Synthese über den
eingesprochenen Vorschlag). Jede Stelle, an der zwei Module den Vertrag
verschieden gelesen haben, wird als contracts:-PR vorgeschlagen, nicht
still angepasst. Branch claude/beteiligung-w3-verdrahtung.
```

Modell: das stärkste, hoher Denk-Aufwand. Danach die Generalprobe mit der
Redaktion an einem echten Probe-Treffen.

## 6. Regeln gegen Kollisionen

- **Pfadhoheit:** Die Tabellen in §3 und §4 sind bindend. Zwei Sessions
  schreiben nie in dasselbe Verzeichnis. Gemeinsame Helfer entstehen nur
  in Welle 0 oder als `contracts:`-PR.
- **Vertragsänderung:** eigene PR, Titel `contracts: …`, Diff nur im
  Vertragspaket, Begründung mit dem betroffenen Modul. Der Owner mergt sie
  bevorzugt; alle laufenden Sessions rebasen.
- **Basis:** jede Session startet von `origin/master`, nie von einem
  anderen Arbeitszweig. Ein Konflikt mit einem offenen Branch ist ein
  Stopp nach AGENTS.md.
- **Tests:** Unit-Tests je Modul gegen Doubles und Fixtures, dazu je
  Session eine Flow-Simulation nach §8 gegen die Test-Mongo und den
  Dateispeicher der Session; das Ergebnis (welche Dokumente und Dateien
  entstanden sind) steht im Hand-off. Die Cloud-Session kann `pnpm test`,
  `pnpm lint`, tsc und `pnpm dev` laufen lassen; Transformationen über den
  Secretary und die Generalprobe bleiben lokal.
- **Oberflächen** laufen als eigene Sessions gegen die Routen-Verträge;
  sie dürfen `src/components/deliberation/**` und `src/app/(deliberation)/**`
  anlegen, sonst nichts.

## 7. Aufwand und Risiko

| Welle | Sessions | Parallel | Schätzung (nach Welle 0 neu) |
|---|---|---|---|
| 0 | 1 | nein | 2–3 Tage (inkl. Spikes und Überarbeitung) |
| 1 | 6 | ja | je 0,5–2 Tage |
| 2 | 4 (+ Session 11) | ja | je 1–2 Tage |
| 3 | 1 | nein | 1–2 Tage |

Die Zahlen sind Größenordnungen; belastbar wird es mit dem Hand-off von
Welle 0. Das Hauptrisiko liegt in Welle 0: Ein falscher Vertrag ändert
sich in sechs Sessions gleichzeitig. Darum die Spikes in Welle 0, die
Abnahme durch den Owner und das Verbot, Verträge nebenbei zu ändern.

## 8. Cloud-Umgebung für Flow-Simulationen

Ziel: Eine Cloud-Session startet die App (`pnpm dev`) gegen eine
**Test-Mongo** und einen **echten Dateispeicher**, spielt einen Fluss durch
(Freigeben, Beitreten, Fenster öffnen, Beitragen, Schließen, Ablage) und
prüft die Wirkung direkt in Mongo und im Speicher. Das ist eine
Einstellung der Cloud-Umgebung (Titelleiste der Session → Cloud-Umgebung
→ Bearbeiten), keine Repo-Änderung. Werte gehören nie in den Chat.

### 8.1 Umgebungsvariablen (Namen, die die App liest)

| Variable | Wofür | Pflicht für |
|---|---|---|
| `MONGODB_URI` | Test-Cluster (eigene Datenbank, nie die Produktion) | alles |
| `MONGODB_DATABASE_NAME` | z. B. `ks-test-beteiligung` | alles |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk-Entwicklungsinstanz; die Middleware läuft sonst nicht | `pnpm dev` |
| `INTERNAL_TEST_TOKEN` | interne Routen (`/api/integration-tests/*`, Job-Callbacks) ohne Browser-Login; wird von `scripts/run-integration-tests.mjs` mitgeschickt | Flow-Simulation über Routen |
| `INTEGRATION_TEST_USER_EMAIL` | der Test-Owner, dem die Test-Library gehört | Flow-Simulation |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in der Session | Flow-Simulation |
| `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME` | Inbox-Blob für Anlagen (D3); Test-Container | D3, D5 |
| `SECRETARY_SERVICE_URL`, `SECRETARY_SERVICE_API_KEY` | nur, wenn Transformationen in der Cloud laufen sollen; sonst weglassen und die Synthese über den eingesprochenen Vorschlag simulieren | D6 optional |

### 8.2 Netzwerk

Die Netzwerkrichtlinie der Umgebung muss die Hosts erlauben: den
Mongo-Cluster (`*.mongodb.net`), Clerk (`*.clerk.accounts.dev`,
`api.clerk.com`), den Nextcloud-Host der Test-Library (WebDAV), bei Azure
Blob `*.blob.core.windows.net`, bei Secretary dessen Host. Ein verweigerter Host zeigt sich als
Verbindungsfehler in `pnpm dev`; dann diesen Host in den erlaubten
Domänen ergänzen.

### 8.3 Dateispeicher: drei Stufen

1. **Filesystem-Provider im Container** (Library-Typ `local`, Basisordner
   z. B. `/tmp/ks-storage/<library>`): schnellste Stufe, deterministisch,
   kein Netz. Die Session legt das Probe-Treffen aus den Fixtures dort ab
   und liest die Ergebnisse mit `ls` und `cat`. Reicht für Welle 1 und 2.
2. **Nextcloud über die App (Owner 24.09.)**: Die Test-Library ist in der
   Test-Mongo als Nextcloud-Library angelegt; WebDAV-URL, Benutzer und
   App-Passwort stehen in der Library-Konfiguration (`library.nextcloud`,
   `src/types/library.ts:89`) und werden vom Owner in den
   Library-Einstellungen gepflegt, nie in der Umgebung oder im Chat.
   Damit läuft in der Cloud der echte `NextcloudProvider`
   (`src/lib/storage/nextcloud-provider.ts`). Netzwerk: der
   Nextcloud-Host muss freigegeben sein. Stufe für Welle 3.
3. **Prüfen von außen**: Der Agent prüft den Nextcloud-Ordner nicht mit
   einem Konnektor, sondern über die KnowledgeScout-Brücke
   (`ordner_listen`, `datei_lesen`, `stat` gehen auch auf
   Nextcloud-Mounts) oder, wenn die Brücke die Test-Library nicht kennt,
   über die Storage-Routen der laufenden App mit dem Test-Owner. Beides
   nutzt dieselben Zugangsdaten wie die App. OneDrive und der
   Microsoft-365-Konnektor spielen für die Beteiligung keine Rolle.

### 8.4 Ablauf einer Flow-Simulation in der Session

1. `pnpm dev` im Hintergrund starten, warten auf „Ready“.
2. Test-Library und Probe-Treffen anlegen (Fixtures → Dateispeicher;
   Library-Dokument in der Test-Mongo per Skript unter `scripts/`, nie per
   Hand).
3. Den Fluss über die Routen der Verträge ausführen, mit
   `INTERNAL_TEST_TOKEN` bzw. dem Test-Owner.
4. Wirkung prüfen: Mongo read-only (Muster aus
   `docs/guides/verification-playbook.md`), Dateispeicher per `ls`/`cat`
   oder Brücke, Job-Verlauf in Mongo (Worker loggt nicht nach stdout).
5. Ergebnis als Tabelle „Aktion → erwartete Wirkung → beobachtet“ in den
   Hand-off. Abweichungen sind Befunde, keine Anpassungen am Vertrag.
6. Aufräumen: Test-Datenbank-Collections der Library und den
   Speicherordner löschen; nichts in der Test-Mongo liegen lassen, was
   die nächste Session verwirrt.

Welle 0 liefert dafür das Skript `scripts/beteiligung-probe-treffen.ts`
(Library anlegen, Fixtures ablegen, wieder entfernen), damit jede Session
dieselbe Ausgangslage hat.
