# Verifikations-Playbook (lokale Live-Prüfung)

## Was ist das?

Eine kurze Anleitung, **wie man eine Code-Änderung lokal verifiziert**, ohne dabei
Zeit zu verlieren. Gilt für „wirkt der Fix?", „ist es schneller / weniger Calls?",
„wurde wirklich (nichts) geschrieben?".

## Warum?

In der Praxis geht die meiste Verifikations-Zeit im **Dev-Server-Log** verloren:
der Log-Buffer akkumuliert über alle Klicks, die Zugriffs-Zeilen (`POST … in Xms`)
haben **keine Zeitstempel**, und ein „reused" Dev-Server lässt sich nicht frisch
starten. Wer das ignoriert, misst Stunden statt Minuten. Die Regeln unten sind die
Lehren aus genau diesen Verlusten.

## Goldene Regeln

### 1. MongoDB read-only ist der Goldstandard

Geht es um **Daten/Artefakte** (wurde korrekt geschrieben? doppelt maskiert? ersetzt?),
ist der **gespeicherte Datensatz** der definitive Beweis — nicht das Log.

- `mongosh.exe` (`C:\Program Files\mongosh-2.8.3-win32-x64\bin\mongosh.exe`), URI aus
  `.env` (`MONGODB_URI`), DB = `MONGODB_DATABASE_NAME` (dev: `common-knowledge-scout`).
- Collection-Namen sind library-spezifisch (z.B. `shadow_twins__<libraryId>`).
- Ein kleines read-only Skript (`JSON.stringify` zeigt Escapes/Steuerzeichen explizit)
  beantwortet die Frage in **einem** Lauf. Skript nach Gebrauch wieder löschen (`tmp/`).

### 2. Dev-Log nur mit Disziplin

Das Log ist gut für **Existenz/Reihenfolge/Fehler**, schlecht für **Zählen**.

- **Frischer Server + EINE kontrollierte Aktion + sofort messen.** Wenn der Server
  „reused" ist, ist der Buffer NICHT leer → Aussage über „neue" Calls unsicher.
- **Eindeutiger Probe-Marker** statt zählen: temporär `console.log('[XPROBE] …')` in den
  Endpoint, Aktion ausführen, exakt nach `[XPROBE]` suchen, Probe danach entfernen.
- **Große Logs per Subagent** auswerten (überschreitet sonst das Token-Limit; wird in
  Datei gespeichert → Subagent liest + fasst zusammen). Nicht selbst zeilenweise lesen.

### 3. Wer loggt wohin

- **Next-Dev-Server** (Pages/API-Routes) → stdout → `preview_logs`.
- **External-Jobs / Worker** (Transform, Ingest) → `bufferLog` → **MongoDB**, NICHT stdout.
  Ein laufender Job erscheint daher **nicht** in `preview_logs` — dort vergeblich zu warten
  ist ein klassischer Zeitverlust. Job-Verlauf in MongoDB bzw. der Job-UI prüfen.

### 4. Reload-Semantik (welche Änderung braucht was)

- **Server-Routes** (`src/app/api/**`): kompilieren beim nächsten Aufruf automatisch —
  kein Reload nötig.
- **Reine Hook-/Component-Änderungen**: kommen i.d.R. per Fast Refresh.
- **Provider-/Layout-Änderungen** (z.B. neuer Context-Provider in `app/layout.tsx`):
  Fast Refresh kann den Provider-Baum **nicht** heiß tauschen → **harter Reload**
  (Strg+Shift+R) nötig. Symptom „alter Code läuft trotz Speichern" = Bundle veraltet.

### 5. Datenverändernde Pfade (apply/write)

- **Dry-Run zuerst** (zeigt, was passieren würde), dann erst apply.
- **Vor jedem echten `--apply`/Write: `mongodump`** der betroffenen Collection (Backup
  in `tmp/`, gitignored). Storage-Löschungen sind irreversibel.

## Konkrete Rezepte

**„Wurde nichts geschrieben (0 Writes)?"** → Log nach Schreib-Verben filtern
(`PUT`/`PATCH`/`DELETE`, `action=upload`, `upsert`) UND den Code-Pfad prüfen, ob er rein
lesend ist. Beides zusammen ist der Beweis.

**„Ist die Request-Anzahl gesunken?"** → frischer Server, EINE Aktion, Probe-Marker im
Endpoint, exakt zählen. Akkumulierter Buffer ⇒ keine belastbare Zahl.

**„Wurde das Artefakt korrekt geschrieben?"** → MongoDB read-only inspizieren (Regel 1),
nicht aus dem Log schließen.

## Bekannte Tooling-Grenzen (Verbesserungs-Backlog)

- Zugriffs-Log-Zeilen haben keine Zeitstempel, der Buffer akkumuliert. → künftig
  **Request-/Trace-IDs** oder ein kleiner **Metrik-/Count-Endpoint** würden die
  Log-Archäologie überflüssig machen.
- „1 bekannt-roter Test" gewöhnt man sich an und maskiert echte Regressionen. Roten
  Test fixen oder als `skip`/`xfail` mit Begründung markieren.
