# Handover 2026-08-22: MCP-Pilot — beide Wunschlisten umgesetzt, Betrieb auf Port 3000

Für eine **neue Session** (lokal oder Cloud). Löst das Handover vom 21.08. ab.
Pflichtlektüre dazu: [`welle-5-mcp-testszenario.md`](../concepts/welle-5-mcp-testszenario.md)
und `AGENTS.md`.

## In einem Satz

Cowork (Claude Desktop) räumt Archiv-Ordner über die KnowledgeScout-MCP-Brücke
auf; **KnowledgeScout ist der einzige Ausführungsort** (Entscheid Peter
2026-08-22), Cowork orchestriert und schreibt Berichte. Der Pilot-Ordner
`4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol` steht auf
„bereit zur Abnahme" (28 Quellen, 28 erschlossen); beide Wunschlisten aus dem
Pilot (21.08. und 22.08.) sind umgesetzt.

## Stand des Codes (PR gegen `master`, 24 Commits)

**17 MCP-Werkzeuge**, Werkzeugsatz `TOOLSET_VERSION 2.2.0`
(`src/lib/mcp/tools-info.ts`), Erweiterungs-Manifest 1.4.0:

| Gruppe | Werkzeuge |
|---|---|
| Lesen | `bibliotheken_auflisten`, `abdeckung_lesen` (Filter `akteur`/`zyklusSchritt`/`nurZaehler`, Befunde mit `targetId`/`folderId`), `twins_pruefen`, `job_status`, `job_liste`, `aenderungen_seit`, `bruecke_info` |
| Schreiben (je Aufruf bestätigen) | `abdeckung_scannen`, `twins_synchronisieren`, `familie_umziehen`, `quelle_verwerfen` (→ „zu klären" im Elternordner), `ordner_erstellen`, `ordner_umbenennen`, `quelle_erschliessen` (Audio/Video/PDF/Office, Stapel `sourceIds`), `transformation_starten` (Stapel), `sichten_regenerieren` (AKTUELL.md + PROJEKTE.md → `Organisation/`), `erschliessung_block_schreiben` (Marker-Block in `_INDEX.md`) |

Weitere Ergebnisse des Branches: Agentensicht als **Opt-in pro Library**
(`config.agentView.enabled`, Default aus); **Account-Keys** (`ksm_…~…~…`,
signiert, Hash in `mcp_account_keys`) mit Settings-Seite **„Mein Zugang"**
(`/settings/account`: fertiges `.mcpb` laden, Schlüssel widerrufen); Scan-Delta
+ Akteur-Hauptanzeige in der Agentensicht; Plattform-Default für
`scanExcludeGlobs`; `extractionKnownNames` je Library (E1); `authors: []` gilt
als beantwortet (B3); Live-Parent statt Mongo-Verweis beim Export (B1).

`pnpm test` 2863 grün, `pnpm lint` exit 0 (Stand 22.08., 10:40).

## Betrieb — so läuft es gerade

1. **Server auf Port 3000** aus Worktree `.claude/worktrees/app-testing-84f570`
   (Launch-Config `next-dev`). `.env` dort: beide Port-Variablen
   (`NEXT_PUBLIC_APP_URL`, `INTERNAL_SELF_BASE_URL`) auf 3000 — **Server-Port
   und beide Zeilen müssen immer zusammen umziehen**, sonst landet der
   Worker-Dispatch auf einem toten Port (`worker_start_giveup`, ECONNREFUSED).
   `MCP_API_KEY` ist zugleich Signatur-Secret der Account-Keys.
2. **Nach dem Merge** kann der Betrieb ins Hauptrepo (Port 3000 ist dort
   Standard): die zwei MCP-Zeilen (`MCP_API_KEY`, `MCP_USER_EMAIL`) in die
   Haupt-`.env` übernehmen, `pnpm install` (mcp-handler), dann `pnpm dev`.
   Worktree-Server vorher stoppen (ein Server je Port).
3. **Cowork-Erweiterung**: installiert ist `local.mcpb.bcommonslab.knowledgescout`
   (Bundle aus „Mein Zugang", zeigt auf `http://localhost:3000/api/mcp/mcp`,
   Account-Key eingebacken). Nach Schema-Änderungen: Erweiterung aus-/einschalten;
   Drift erkennt der Agent per `bruecke_info`. Jeder neue Download **rotiert**
   den Key (altes Bundle wird ungültig).
4. **60-s-Limit des MCP-Clients**: schwere Läufe auf Teilbäume; Langläufer sind
   Jobs (`job_status`/`job_liste`). `sichten_regenerieren` braucht ~34 s
   (Berichte-Lauf Tiefe ≤ 3, 249 Listings) — Physik: der OneDrive-Provider
   erlaubt 4 parallele Graph-Requests à ~0,5 s. Weniger Listings nur per
   Konfiguration (Vorhaben-Muster `^\d{2}\.\d{2}` ist für „Onedrive Test"
   gesetzt; weitere Ausschlüsse wie `0. Inbox`, `9. Wissen` wären möglich).

## Die Abendschleife (Tagesabschluss) — alles über die Brücke

```
aenderungen_seit(gestern, pfad?)           → Arbeitsliste (Dateien + Artefakte, Erschließungszustand)
quelle_erschliessen(sourceIds=[…])         → Jobs, parallel; job_liste/job_status
Cowork schreibt BERICHT.md/_INDEX.md       → Urteils- und Sprachaufgabe, bleibt bei Cowork
abdeckung_scannen(pfad)                    → Ist-Stand (Delta „x erledigt · y neu")
erschliessung_block_schreiben(pfad)        → Block im _INDEX.md
sichten_regenerieren                       → AKTUELL.md + PROJEKTE.md frisch
```

## Offen (nicht begonnen)

- **Erster echter Export**: `sichten_regenerieren` ohne `nurVorschau` — ersetzt
  `Organisation/AKTUELL.md` und `PROJEKTE.md` (Schreibvorgang, Peter bestätigt).
- **W4 Tagesabschluss-Job**: ein KS-interner Job-Typ im External-Jobs-Worker,
  der Schritte 1/2/4/5 bündelt und nur die Berichtsarbeit zurückgibt.
- **Provider-Delta** (OneDrive `/delta`): `aenderungen_seit` erkennt Gelöschtes
  und Umbenanntes bisher nicht (ausgewiesen).
- **Library-weiter Coverage-Scan** nach dem gesetzten Vorhaben-Muster: die
  Vorhaben-Regeln gelten jetzt für alle 101 Projektordner — die Befundzahl
  wird groß, das ist gewollt (Zielbild: jedes Projekt hat einen Bericht).
- `updateFileContent` im Storage-Provider (id-stabiles Überschreiben statt
  Löschen + Hochladen), `verworfen`-Flag am Mongo-Dokument (C4-Ausbaustufe).
- Plattform-Bug außerhalb unseres Codes: Clerk wirft 500 bei Bearer-Tokens der
  Form `a.b.c` (JWT-Form) — eigene Token-Formate nie so bauen.

## Start-Prompt für die neue Session (kopierbar)

```
Lies zuerst docs/handover/2026-08-22-mcp-pilot-wunschlisten-umgesetzt.md und
docs/concepts/welle-5-mcp-testszenario.md. Pruefe, dass der Dev-Server auf
Port 3000 laeuft und der MCP-Endpunkt antwortet (bruecke_info muss
Werkzeugsatz 2.2.0 mit 17 Werkzeugen melden). Dann begleite die Abendschleife
mit Cowork am Ordner "4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol"
in der Library "Onedrive Test": Befunde ueber abdeckung_lesen, Schreibaktionen
nur nach meiner Freigabe, Langlaeufer ueber job_liste/job_status. Befunde an
Werkzeugen oder Plattform-Bugs: diagnostizieren, fixen, committen.
```
