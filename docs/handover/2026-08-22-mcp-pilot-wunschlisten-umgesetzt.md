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

**17 MCP-Werkzeuge**, Werkzeugsatz `TOOLSET_VERSION 2.2.1` (2.2.0 → 2.2.1 am Abend des 22.08., Befund B1)
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

## Abend 22.08. — Begleitung der Abendschleife (Claude Code, Branch `claude/mcp-pilot-wunschlisten-abend-92a232`)

**Geprüft:** Server 3000 aus Worktree `app-testing-84f570` (Commit `04becb19` =
Ausgangspunkt dieses Branches), Handshake `knowledgescout 2.2.0`, `bruecke_info`
17 Werkzeuge, `tools/list` 17 ✔. **Achtung:** die `.env` des Server-Worktrees
zeigt auf `common-knowledge-scout-prod` — jede Schreibaktion über die Brücke
trifft Prod-Daten.

**Lage im Pilot-Ordner (nur Lese-Werkzeuge):** `aenderungen_seit(2026-08-21)`
59 Einträge in 5 s, alle 28 Quellen erschlossen, 0 `kein_twin`; `job_liste` 0
Jobs. `abdeckung_lesen` (Report 09:20): 30 Befunde — 28× `twin_unverified`
(Mensch), 1× `bericht_veraltet` (BERICHT.md um 09:44 erneuert, Report älter →
Re-Scan schließt das), 1× `core_fields_missing` `date` an `Email Rudi
Rienzner.m4a`. `twins_pruefen` (32 s): 0 Konflikte, 7 PDF-Familien mit 92
`delete-dead-page-md` + 6 `register-image-fragments` (Preset `repair`), 17
`mirror-image-to-storage` (nur `export`). Block-Vorschau `_INDEX.md` identisch
mit dem Bestand (No-op). AKTUELL/PROJEKTE wurden um 10:38 bereits von KS
erzeugt — der Punkt „Erster echter Export" ist damit erledigt.

**Befunde und Fixes:**

- **B1 (gefixt, `bf5fc77c`)** `twins_pruefen` listete 92 gleichartige
  Operationen einzeln → Verdichtung je Quelle ab 4 gleichartigen stummen
  Operationen (`verdichtet: true`, `anzahl`, Beispiel-Dateien); Werkzeugsatz
  **2.2.1**.
- **B2 (gefixt, `aac2819e`)** AKTUELL.md führte vergangene Termine (17.08.,
  20.08.) kommentarlos unter „Die nächsten Termine" → Marke *überfällig* +
  Hinweis, den BERICHT.md nachzuziehen.
- **B3 (Diagnose, Datenänderung nötig)** Das Template `standard-meeting`
  beschreibt `date` als *„ISO wenn klar erkennbar, sonst \"\""* — es weist das
  LLM an, leer zu lassen, und kollidiert mit dem A0-Contract (`date` Pflicht;
  Reparatur erfindet bewusst keine Werte). Die Pipeline gibt `filePath`
  (mit Ordnerdatum) und `fileModifiedAt` bereits als CONTEXT mit. Abhilfe:
  Template-Text auf „…sonst aus Ordner-/Dateiname (JJJJ-MM-TT) bzw.
  fileModifiedAt ableiten — nie leer" ändern, dann `transformation_starten`.
- **B4 (Diagnose, Folgearbeit)** `participants` (und `pathHints`) kommen vom
  Secretary Service als JSON-String — in allen 28 Transformationen; KS übernimmt
  Werte 1:1 und normalisiert nur Facetten. Vorschlag: deterministische
  Normalisierung `string[]`-typisierter Template-Felder vor dem Meta-Merge
  (`phase-template.ts`, `toStringArrayFromUnknown`).
- **B5 (kein KS-Bug)** Windows-`curl.exe` verstümmelt Umlaute in Argumenten
  (ANSI-Codepage) → Brücke aus Git-Bash nur mit `--data-binary @datei`
  aufrufen; der Cowork-Proxy (Node `fetch`) ist nicht betroffen. Das Werkzeug
  hat den kaputten Pfad korrekt als „traf NICHTS — keine Entwarnung" gemeldet.

**Freigaben (Stand 11:30, offen):** F1 `abdeckung_scannen` Teilbaum ·
F2 `twins_synchronisieren preset=repair` Teilbaum (löscht 92 tote
Seiten-Dateien) · F3 Template-Text `date` · F5 Server-Worktree auf diesen
Branch, sonst sind B1/B2 für Cowork erst nach dem Merge sichtbar.

## Start-Prompt für die neue Session (kopierbar)

```
Lies zuerst docs/handover/2026-08-22-mcp-pilot-wunschlisten-umgesetzt.md und
docs/concepts/welle-5-mcp-testszenario.md. Pruefe, dass der Dev-Server auf
Port 3000 laeuft und der MCP-Endpunkt antwortet (bruecke_info muss
Werkzeugsatz 2.2.1 mit 17 Werkzeugen melden). Dann begleite die Abendschleife
mit Cowork am Ordner "4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol"
in der Library "Onedrive Test": Befunde ueber abdeckung_lesen, Schreibaktionen
nur nach meiner Freigabe, Langlaeufer ueber job_liste/job_status. Befunde an
Werkzeugen oder Plattform-Bugs: diagnostizieren, fixen, committen.
```
