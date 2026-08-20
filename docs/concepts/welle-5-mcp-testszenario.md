# Welle 5 — MCP-Brücke: Testszenario „Räum diesen Ordner auf"

Stand: 2026-08-19 · Szenario VOR der Implementierung dokumentiert (Entscheid
Peter). Grundlage: [`projektauftrag-agentensicht.md`](projektauftrag-agentensicht.md)
(Welle 5), [`twin-datei-contract.md`](twin-datei-contract.md) (§5 Rollen),
[`erschliessungszyklus.md`](erschliessungszyklus.md).

**Ein Satz:** Peter fragt in Cowork „Was liegt in diesem Ordner — können wir
das aufräumen?", der Agent holt sich Befunde und Werkzeuge selbst über die
MCP-Brücke, und bei jedem Schritt, der schreibt oder Urteil braucht, wird
Peter gefragt.

---

## 1. Was die MCP-Brücke ist

KnowledgeScout wird MCP-Server: ein HTTP-Endpunkt (`/api/mcp/mcp`), an dem
sich Claude (Cowork, Claude Code, Claude Desktop) anmeldet und Werkzeuge bekommt.
Die Werkzeuge sind eine **dünne Schicht über den bestehenden Services**
(Coverage-Scan, Sync-Engine-Presets) — kein neues Prüfsystem, keine neuen
Schreibpfade. Damit ersetzt Welle 5 den Copy-Paste-Transport des
Auftrags-Generators (F3): Der Agent liest die Coverage selbst, statt dass
Peter Auftragstexte kopiert.

Die Doppelrolle des Agenten bleibt wie im Contract: **Contract-Dateien
(`BERICHT.md`, `_INDEX.md`) schreibt Cowork weiterhin direkt im lokalen
Archiv-Mount** — die MCP-Brücke liefert die KS-Sicht (was ist erschlossen,
was fehlt, was divergiert) und die Engine-Knöpfe, nicht einen Datei-Editor.

## 2. Werkzeuge v1 (bewusst klein)

| Werkzeug | Was es tut | Liest/Schreibt | Bestätigung |
|---|---|---|---|
| `bibliotheken_auflisten` | Libraries des Users (Id, Name) | liest | einmalig erlauben |
| `abdeckung_lesen` | Jüngsten Coverage-Report lesen, optional auf einen Pfad gefiltert (Befunde, Familien, Zähler) | liest Cache | einmalig erlauben |
| `abdeckung_scannen` | Expliziter Neu-Scan (optional Teilbaum), speichert den wegwerfbaren Report | rechnet; schreibt NUR den Report-Cache | je Aufruf |
| `twins_pruefen` | Sync-Engine im check-Modus (Konflikte, Alt-Namen, fehlende Spiegel) — kompakte Zusammenfassung | liest | einmalig erlauben |
| `twins_synchronisieren` | Sync-Engine im repair-Modus mit Preset `repair` \| `import` \| `export` | **schreibt** (Mongo + Spiegel) | **je Aufruf einzeln** |
| `familie_umziehen` | Quelldatei umbenennen/verschieben MIT Twin-Familie (Welle-0e-Service: Import → Siblings → Quelle → Mongo → Spiegel neu); Dateien ohne Twin werden einfach bewegt | **schreibt** (Storage + Mongo) | **je Aufruf einzeln** |
| `ordner_umbenennen` | Ordner umbenennen (Storage-only, Mongo-transparent — Ids stabil, `_`-Ordner wandern mit) | **schreibt** (Storage) | **je Aufruf einzeln** |

Umbenennen/Verschieben läuft IMMER über diese Werkzeuge, nie über direkte
Dateisystem-Zugriffe des Agenten — sonst zeigen die Mongo-Dokumente ins
Leere und aus 2 Befunden werden 20.

**Bewusst NICHT in v1:**

- `erschliessen` (Pipeline-Jobs starten): Der Job-Start bleibt in v1 ein
  **Mensch-Checkpoint im KS-UI** — das passt zur Rollenverteilung („Buttons
  drückt Peter", Contract §5) und vermeidet, den Job-Erzeugungs-Contract im
  ersten Wurf nachzubauen. Ausbaustufe, sobald das Szenario einmal rund lief.
- `loeschen`: bewusst kein Werkzeug (destruktivster Fall, Papierkorb-Semantik
  providerabhängig). Solange: per `familie_umziehen` in einen Klär-Ordner
  (z. B. „zu klären") verschieben statt löschen — reversibel und sichtbar.
- `kuratieren`/`verifizieren`: Verifikation bleibt **Mensch** (F4 in der
  Agentensicht). Ein Agent verifiziert nie sich selbst (Contract §3.2/§5);
  deshalb bekommt er dieses Werkzeug gar nicht erst.

## 3. Vorbedingungen (Checkliste vor dem ersten Lauf)

1. **KS läuft** (lokal `pnpm dev` genügt) mit zwei neuen Env-Variablen:
   `MCP_API_KEY` (frei gewähltes Secret) und `MCP_USER_EMAIL`
   (Peters KS-Login-Email — der Key handelt als dieser User).
   Pilot-Entscheidung: EIN Key, env-basiert; per-User-Keys mit Verwaltung
   sind eine Ausbaustufe.
   **Stolperstein (Live-Befund):** Läuft der Server auf einem anderen Port
   als 3000, müssen `NEXT_PUBLIC_APP_URL` **und** `INTERNAL_SELF_BASE_URL`
   in der `.env` auf diesen Port zeigen — sonst laufen interne
   Selbst-Aufrufe (OneDrive-Token-Refresh) ins Leere und genau die
   Provider-Werkzeuge (`abdeckung_scannen`, `twins_pruefen`) scheitern mit
   „fetch failed", während die Mongo-Werkzeuge funktionieren.
2. **Library konfiguriert** (Befund aus dem Live-Test der Wellen 1–3):
   Standard-Template gesetzt (sonst bleibt `transformation_missing` blind und
   das führende Artefakt ist immer das Transkript) und `scanExcludeGlobs`
   gefüllt (`.obsidian`, `.trash`, `.ck-meta`, `.wizard-sources`, `temp`).
3. **MCP-Verbindung einrichten** (Endpunkt: `http://localhost:3000/api/mcp/mcp`
   — Streamable HTTP; das doppelte `mcp` kommt vom Transport-Segment der Route):
   - Claude Code: `claude mcp add knowledgescout --transport http http://localhost:3000/api/mcp/mcp --header "Authorization: Bearer <MCP_API_KEY>"`
   - **Cowork/Claude Desktop: als Erweiterung installieren** — die Desktop-App
     lädt lokale MCP-Server als Extension (MCPB), nicht über die
     `claude_desktop_config.json` (die überschreibt die App laufend mit ihren
     Preferences; Handbearbeitung geht verloren). Das Bundle liegt im Repo
     unter [`extensions/knowledgescout/`](../../extensions/knowledgescout/)
     und ist **abhängigkeitsfrei** (eigener stdio-Proxy `server/proxy.js`,
     kein npm install): Einstellungen → Erweiterungen → „Erweiterte
     Einstellungen" → **„Entpackte Erweiterung installieren"** → den Ordner
     wählen → im Konfigurieren-Dialog MCP-URL (Default passt) und API-Key
     eintragen. Die Werkzeuge erscheinen in Cowork über die
     remote-devices-Brücke. Diagnose bei Problemen:
     `%APPDATA%\Claude\logs\mcp-server-KnowledgeScout.log` — der Proxy
     meldet Verbindungs-/Key-Fehler dort im Klartext.
4. **Pilot-Ordner** mit bekannten Lücken, z. B.
   `6. bCommonsLab prototyping/25.01 Common Secretary` (Projektauftrag §6).
5. **Cowork hat den lokalen Archiv-Mount** (OneDrive) für `BERICHT.md`/
   `_INDEX.md` — die MCP-Brücke ersetzt diesen Zugriff nicht.

## 4. Das Drehbuch — mit allen Peter-Checkpoints

> Schreibweise: 🤖 = Agent (Cowork), 🧑 = **Checkpoint Peter** (hier wird
> gefragt, nichts passiert ohne Antwort).

1. **Peter:** „Was liegt in `25.01 Common Secretary`? Können wir das
   aufräumen?"
2. 🤖 `bibliotheken_auflisten` → Library-Id. `abdeckung_lesen` mit dem
   Ordner-Pfad. Ist der Report veraltet oder fehlt er, sagt das Werkzeug das
   ausdrücklich („noch nie gescannt") — kein Raten.
   🧑 **Checkpoint 1:** Freigabe für `abdeckung_scannen` (Teilbaum genügt;
   Library-weite Scans dauern Minuten).
3. 🤖 Fasst die Befunde **nach Akteur** zusammen (dieselben Todo-Listen wie
   im Tab „Todos & Auftrag") und schlägt einen Aufräum-Plan vor, z. B.:
   „2 Konflikte (erst importieren), 4 Quellen ohne Twin (Pipeline), BERICHT
   veraltet (mache ich), 1 Artefakt unverifiziert (machst du)."
   🧑 **Checkpoint 2:** Peter bestätigt oder kürzt den Plan.
4. 🤖 KS-Schritte in fester Reihenfolge, jede Schreibaktion einzeln:
   `twins_pruefen` → bei Konflikten ZUERST `twins_synchronisieren
   preset=import` (Handkorrekturen retten — nie überschreiben), dann
   `preset=repair` bzw. `preset=export` je Befundlage.
   🧑 **Checkpoint 3:** Jeder `twins_synchronisieren`-Aufruf erscheint als
   einzelne Werkzeug-Bestätigung im MCP-Client (Preset + Scope sichtbar).
5. 🤖 Listet die unerschlossenen Quellen (`source_without_twin`) mit Pfaden.
   🧑 **Checkpoint 4:** Peter startet die Pipeline für diese Dateien im
   KS-UI und meldet „fertig" (v1: bewusst Handgriff, siehe §2). Der Agent
   wartet und prüft danach per Re-Scan, ob die Twins da sind.
6. 🤖 Cowork-Schritte im lokalen Mount: `BERICHT.md` auf Twin-Basis
   aktualisieren (Transformation zitieren, nicht Rohmedien), tote/veraltete
   Verweise fixen, offene Punkte ins `_INDEX.md`.
7. 🧑 **Checkpoint 5 — Verifikation:** Der Agent bittet Peter, die führenden
   Artefakte in der **Agentensicht** zu verifizieren (Welle 4: Dropdown +
   Verifizieren). Der Agent tut das nie selbst.
8. 🤖 Abschluss-Scan (`abdeckung_scannen`) und Abgleich gegen das
   Abschlusskriterium: **„Danach verschwinden die Gaps X, Y im nächsten
   Scan."** Dazu die Konsistenz-Rückmeldung (F3): „Wo widerspricht meine
   Datei-Sicht dieser Coverage?" — jeder Widerspruch wird gemeldet, nicht
   still übergangen.
9. 🧑 **Checkpoint 6 — Abnahme:** Peter datiert den `bearbeitungsstand`
   (`_INDEX.md`) neu bzw. setzt `abgenommen`. Letzter Re-Scan: Das Vorhaben
   ist grün (Akzeptanzkriterium 7 der Agentensicht).

## 5. Erfolgskriterien (messbar)

1. Der Dialog aus §4 läuft einmal vollständig durch — ohne dass Peter
   Auftragstexte kopiert (F3-Transport ersetzt).
2. Jede Schreibaktion (Sync-Presets) war eine sichtbare, einzeln bestätigte
   Werkzeug-Ausführung; ohne Bestätigung passiert nichts.
3. Konflikte wurden importiert, nie überschrieben (Handkorrektur überlebt —
   Contract §4.3/§4.5).
4. Die adressierten Gaps sind im Abschluss-Scan verschwunden; die
   Verifikation aus Checkpoint 5 ist in der Sicht UND in Obsidian sichtbar.
5. Falscher/fehlender API-Key → **404** (die Clerk-Middleware maskiert den
   Endpunkt ohne validen Key; erst MIT Key übernimmt die Routen-Auth —
   Defense in depth). Kein Werkzeug ausführbar (Auth-Test).

## 6. Leitplanken der Implementierung

- **Transport:** Streamable HTTP unter `/api/mcp/mcp` (offizielles
  TypeScript-SDK via `mcp-handler`), Auth als Bearer-Key-Vergleich VOR dem
  Handler — dasselbe Env-Token-Muster wie `x-internal-token` der
  External-Jobs. Zusätzlich lässt die Clerk-Middleware `/api/mcp/*` nur mit
  validem Key passieren (Muster der Integration-Tests-Ausnahme): ohne Key
  bleibt der Endpunkt eine maskierte 404.
- **Dünn bleiben:** Werkzeuge rufen `scanLibraryCoverage`,
  `getCoverageReport`, `runLibrarySync` — dieselben Funktionen wie die
  Routen. Keine eigene Logik außer der **kompakten Ausgabe** (Agenten
  brauchen Zähler + Top-Befunde, nicht 5.000 Gap-Objekte): Kappung ist
  explizit ausgewiesen, nie still.
- **Kein Werkzeug für Dinge, die es nicht gibt** (Stop-Bedingung): kein
  `erschliessen`-Job-Start, kein `familie_umziehen`, kein Verifizieren.
- **~60-Sekunden-Grenze (Live-Befund):** Der MCP-Client bricht Aufrufe nach
  ca. 60 s ab (Client-Standard, serverseitig nicht beeinflussbar). Deshalb:
  `abdeckung_lesen` zuerst (Cache, sofort); `abdeckung_scannen`/`twins_pruefen`
  IMMER auf Teilbäume begrenzen — per `folderId` (aus der Ordnerliste von
  `abdeckung_lesen`) oder per `pfad` (Pfad→folderId-Resolver direkt gegen den
  Storage, braucht keinen Report — löst das Henne-Ei frischer Libraries).
  Der eine große Erst-Scan gehört in die KS-Oberfläche („Neu scannen").
- Storage-Abstraktion unberührt: Die Werkzeuge kennen Provider nur über die
  bestehenden Services.

## 7. Ausbaustufen (nach dem ersten erfolgreichen Lauf)

1. `erschliessen` als echtes Werkzeug (Job-Erzeugung + Status) — ersetzt
   Checkpoint 4 durch eine bestätigte Werkzeug-Ausführung.
2. `familie_umziehen`, sobald Welle 0e gebaut ist.
3. Per-User-API-Keys mit Verwaltung statt Env-Key (Mehrbenutzer).
4. Auftrags-Vorlagen als MCP-Prompt (der Generator wird maschinenlesbar).
