# Handover 2026-08-21: MCP-Brücke testen — Fortsetzung in neuer Session

Für eine **neue lokale Session** auf Peters Rechner. Fasst den Stand der
MCP-Brücke (Welle 5) und den laufenden Pilot zusammen. Pflichtlektüre dazu:
[`welle-5-mcp-testszenario.md`](../concepts/welle-5-mcp-testszenario.md)
(Szenario, Werkzeuge, Checkpoints) und `AGENTS.md`.

## Das Vorhaben in einem Satz

**Cowork (Claude Desktop) soll als Orchestrator einen Archiv-Ordner
aufräumen** — über die KnowledgeScout-MCP-Brücke, mit Peter als Checkpoint
bei jeder Schreibaktion. „Aufgeräumt" heißt: null offene Befunde im Teilbaum
UND erklärter Stand `abgenommen` (Grün-Definition, Akzeptanzkriterium 7).

## Stand des Codes

Alles liegt auf **einem** Branch/PR:

- Branch: `claude/agentensicht-welle-5-mcp-bruecke` (Worktree
  `.claude/worktrees/competent-cerf-734f60`), PR **#174** gegen `master`,
  letzter Commit `5d29bb15`. Enthält die komplette Kette: Welle 4
  (Kurations-Route + Inline-Verifikation), Coverage-Nachzüge aus Peters
  Live-Test, MCP-Brücke inkl. aller Pilot-Fixes.
- `pnpm test` grün (2800+), `pnpm lint` exit 0.

**Die Brücke: 11 Werkzeuge** unter `http://localhost:3001/api/mcp/mcp`
(Streamable HTTP, mcp-handler 1.x, Code in `src/lib/mcp/`):

| Werkzeug | Kurz |
|---|---|
| `bibliotheken_auflisten` | Libraries (Id + Name), read-only |
| `abdeckung_lesen` | Gespeicherter Coverage-Report + **Ordnerliste mit folderIds** (Teilbaum-Schlüssel), Pfad-Filter wird bei Teilbaum-Reports automatisch auf den Scope gekürzt |
| `abdeckung_scannen` | Expliziter Scan; Teilbaum per `folderId` ODER `pfad` (Resolver braucht keinen Report) |
| `twins_pruefen` | Engine-Check (Plan-Vorschau), Live-Lauf → Teilbaum! |
| `twins_synchronisieren` | Engine-Repair mit Preset `repair`/`import`/`export` |
| `familie_umziehen` | Quelle + Twin-Familie umbenennen/verschieben (Welle-0e-Service) |
| `ordner_erstellen` / `ordner_umbenennen` | Struktur, Storage-only |
| `quelle_erschliessen` | Pipeline für Audio/Video (mit Template = voll erschließen), sofortige `jobId` |
| `transformation_starten` | Standard-Template auf Familie MIT Transkript (Text aus Mongo, Job an der Quelle) |
| `job_status` | Status eines gestarteten Jobs |

**Schutzregeln (alle server-seitig, heute eingebaut):** nie ein Twin-Ordner
im Twin-Ordner (Writer-Invariante nach dem Verschachtelungs-Befund); Umzug
verweigert Twin-Ordner-Inhalte als Quelle und Twin-Ordner als Ziel;
Ordner-Werkzeuge fassen `_`-Ordner nie an. Löschen ist bewusst KEIN
Werkzeug (in Klär-Ordner verschieben); PDF/Office-Erschließung über die
Brücke ist Ausbaustufe (im KS-UI erschließen).

## Betrieb — die Stolpersteine, die uns mehrfach erwischt haben

1. **Server aus dem Worktree, Port 3001, RICHTIGER BRANCH.** Der MCP-Code
   existiert nur auf `claude/agentensicht-welle-5-mcp-bruecke`. Achtung:
   PR-Ansichten in der Desktop-App können den Worktree-Branch WECHSELN —
   dann antwortet alles mit 404. Erster Check bei „geht nicht":
   `git branch --show-current` im Worktree.
2. **`.env` im Worktree** (gitignored) braucht: `MCP_API_KEY`
   (aktuell `w5-smoke-test-key-8483`), `MCP_USER_EMAIL`
   (peter.aichner@crystal-design.com), und **beide** Port-Variablen auf
   3001: `NEXT_PUBLIC_APP_URL` und `INTERNAL_SELF_BASE_URL` (letztere hat
   Vorrang; falsch → OneDrive-Token-Refresh läuft ins Leere → genau die
   Provider-Werkzeuge scheitern mit „fetch failed").
   **Die .env zeigt auf die PROD-DB** — Schreibaktionen treffen Peters
   echte Daten; genau deshalb bestätigt Peter jede einzeln.
3. **`.env` wird nur beim Serverstart gelesen** — nach Änderung neu starten.
4. **Empfohlener Dauerbetrieb:** eigenes Terminal, `pnpm dev -p 3001` im
   Worktree (Session-gestartete Server verwaisen bei App-Neustarts und
   blockieren dann Port 3001 → PID via `netstat -ano | findstr :3001`
   prüfen und beenden).
5. **Cowork-Anbindung = Desktop-Erweiterung** (`extensions/knowledgescout/`,
   eigener abhängigkeitsfreier stdio-Proxy, kein npm install). Konfiguration
   (URL + API-Key) im Konfigurieren-Dialog der Erweiterung. Zwei
   Cache-Fallen: (a) War der Server beim App-Start down, klebt der
   Fehlstart — Erweiterung aus/ein schalten. (b) Nach Schema-/
   Beschreibungs-Änderungen der Werkzeuge ebenfalls togglen, sonst sieht
   Cowork die alte Toolliste. Diagnose:
   `%APPDATA%\Claude\logs\mcp-server-KnowledgeScout.log` (der Proxy meldet
   Klartext).
6. **~60-Sekunden-Limit des MCP-Clients:** schwere Läufe IMMER auf
   Teilbäume begrenzen; der eine große Erst-Scan gehört in die
   KS-Oberfläche (Agentensicht → „Neu scannen"). Langläufer
   (`quelle_erschliessen`, `transformation_starten`) sind deshalb
   Anstoßen-und-Nachsehen (`job_status`); der External-Jobs-Worker läuft im
   Dev-Server mit (`JOBS_WORKER_AUTOSTART=true`).

## Pilot-Stand: `4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol` („Onedrive Test")

Gelaufen: Teilbaum-Report (Start: 38 echte Befunde nach dem
Mongo-Scope-Fix); Cowork hat Bericht/Index nachgezogen, Dateien
umbenannt/verschoben, Spiegel exportiert; `transformation_starten` für
`Treffen Thomas Egger.m4a` erfolgreich (Transformation + Galerie-Eintrag;
der dabei entstandene verschachtelte Spiegel war ein ALTER Worker-Bug —
gefixt per Writer-Invariante, Duplikat von Peter gelöscht).

Offen im Ordner:
- `Climaclub.m4a` (135 MB!) + `Email Rudi Rienzner.m4a` →
  `quelle_erschliessen` (langer, kostenpflichtiger Secretary-Job — einzeln
  bestätigen; Worker/Secretary unter 127.0.0.1:5001 muss laufen)
- weitere Transformationen fehlender Familien → `transformation_starten`
- PDFs/DOCX/Programme → im KS-UI erschließen (Brücken-Ausbaustufe)
- Verifikation der führenden Artefakte → Peter in der Agentensicht (F4)
- Stand `abgenommen` datieren → Re-Scan → grün

## Offene Punkte / Ausbaustufen (nicht begonnen)

- `quelle_erschliessen` für PDF/Office (anderer Upload-Contract)
- Verschachtelte `_`-Ordner als eigener Scan-Befund (der Archiv-Scan sieht
  Twin-Ordner-Unterordner heute nicht — der gefixte Bug wäre im Report
  unsichtbar geblieben)
- Echtes `loeschen`-Werkzeug (mit Papierkorb-Semantik), per-User-API-Keys
- Nach Merge von #174: Betrieb aus dem Hauptrepo (Port 3000, MCP-Zeilen in
  die Haupt-`.env`, URL im Erweiterungs-Dialog auf
  `http://localhost:3000/api/mcp/mcp` umstellen) — dann entfallen
  Worktree- und Branch-Fallen komplett.

## Start-Prompt für die neue Session (kopierbar)

```
Lies zuerst docs/handover/2026-08-21-mcp-pilot-fortsetzung.md und
docs/concepts/welle-5-mcp-testszenario.md. Wir setzen den MCP-Pilot fort:
Cowork raeumt "4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol"
in der Library "Onedrive Test" auf. Pruefe zuerst, dass der Dev-Server im
Worktree competent-cerf-734f60 auf Branch
claude/agentensicht-welle-5-mcp-bruecke auf Port 3001 laeuft und der
MCP-Endpunkt antwortet. Dann begleite den Pilot: Befunde ueber
abdeckung_lesen, Schreibaktionen nur nach meiner Freigabe, Langlaeufer
ueber job_status verfolgen. Befunde an Werkzeugen oder Plattform-Bugs:
diagnostizieren, fixen, auf den PR-#174-Branch committen.
```
