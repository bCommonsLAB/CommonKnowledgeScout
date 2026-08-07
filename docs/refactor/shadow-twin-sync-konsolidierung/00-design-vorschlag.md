# Welle 4 — Design-Vorschlag: EINE Sync-Engine (Prüfen / Reparieren)

Status: ENTWURF zur Abstimmung (2026-08-07, keine Code-Änderungen)
Basis: Hand-off 2026-08-07 §4.2, Zielmodell `shadow-twin-deterministic/04-zielmodell.md` §9,
UI-Kartierung aller Aufrufstellen (diese Session).

---

## 1. Bestandsaufnahme: fünf Engines, drei Wahrheiten

| Engine | Semantik | Löscht? | Aufrufer (UI) |
|---|---|---|---|
| `reconcile-library.ts` (+ `/reconcile`-Route, CLI) | **Vollständigste Fassung gewinnt** (Inhalt: Seiten-Marker, dann Länge); nur Transkripte + Bild-Registrierung | Ja: unterlegene Varianten + tote `page_NNN.md` | Settings „Mit Speicher abgleichen" (Vorschau + Apply); per Datei „Transkript reparieren" (Dialog mit Vorschau) |
| `sync-all/route.ts` | **Timestamp gewinnt** (±5 s); Transkript + Transformationen + Bilder-Export | Nein (nur Overwrite) | Explorer-Toolbar (⚠ schreibt OHNE Trockenlauf, Richtung `both`); Settings „Analysieren" (dry-run); Settings „Exportieren" (`to-storage`) |
| `migrate/route.ts` | **Storage gewinnt bedingungslos** (Import) | Optional: ganze Twin-Ordner (`cleanupFilesystem`) | Settings „Aus Dateisystem laden" (Run-Historie, Polling, Cancel) |
| `sync-to-storage/route.ts` (per Datei) | Nur fehlende Dateien schreiben, nie überschreiben | Nein | NUR stiller Auto-Sync in `file-preview.tsx` (kein Button) |
| `sync-from-storage/route.ts` (per Datei) | Transkript: vollständigste Storage-Variante; Transformation: Timestamp | Nein | NUR stiller Auto-Sync in `file-preview.tsx` (kein Button) |

Konkrete Probleme daraus:

1. **Zwei Wahrheiten nebeneinander:** Settings-„Analysieren" (Timestamp) und
   Reconcile-„Vorschau" (Inhalt) können sich widersprechen — derselbe Bestand,
   zwei verschiedene Reports.
2. **Schreiben ohne Vorschau:** Der Explorer-Button „Änderungen abgleichen"
   führt einen vollen bidirektionalen Schreiblauf aus, ohne Trockenlauf, ohne
   Bestätigung.
3. **Toter Code:** `direction: 'to-cache'` hat keinen UI-Aufrufer;
   `migrate` mit `dryRun: true` wird nie gesendet (State-Namen `dryRun*` sind
   Altlast); Fehler des Auto-Syncs werden still verschluckt (`.catch(() => {})`).
4. **Speicherrisiko:** `reconcileLibrary` lädt ohne `sourceIds` ALLE Twins der
   Library in den Speicher, Route hat kein `maxDuration`.

## 2. Ziel-UX (aus dem Hand-off)

- **EIN „Prüfen"** (Trockenlauf): erzeugt EINEN Report für die ganze Library
  (oder einen Ordner oder eine Datei).
- **EIN „Reparieren"**: führt exakt das aus, was der Prüfen-Report angezeigt hat.
- Erweiterte Aktionen (Export ins Dateisystem, Import aus Dateisystem) als
  Disclosure darunter — kein gleichwertiges Button-Grab mehr.
- Verifikation (Metadaten-Domäne) bleibt separat.

## 3. Kern-Idee: EIN Plan, zwei Modi

Eine Engine `src/lib/shadow-twin/sync-engine/` mit strikter Trennung
**Planen (reine Funktion, ohne I/O-Schreiben) → Ausführen**:

```
planLibrarySync(scope, candidates) → SyncPlan   // deterministisch, unit-testbar
executeSyncPlan(plan, allowedOps)  → SyncReport // schreibt/löscht nur Geplantes
```

- `scope`: ganze Library | `folderId` (rekursiv) | `sourceIds` (Teilmenge, auch
  genau EINE Datei). Alles läuft über dieselbe Quellen-Liste — der Scope
  bestimmt nur, welche Quellen geplant werden.
- **Modus `check`** = Plan bauen und als Report zurückgeben (heutige Dry-Runs).
- **Modus `repair`** = denselben Plan ausführen. Damit ist garantiert:
  Vorschau und Reparatur können sich nie widersprechen (Problem 1 gelöst).

Statt `direction: to-storage|to-cache|both` plant die Engine **benannte
Operationsklassen** pro Quelle:

| Operationsklasse | Bedeutung | im Standard-„Reparieren"? |
|---|---|---|
| `write-canonical-transcript` | Gewinner als `{base}.md` in Storage schreiben | Ja (nur wenn `persistToFilesystem`) |
| `update-mongo-transcript` | Gewinner in `artifacts.transcript` schreiben | Ja |
| `update-mongo-transformation` | externe Änderung einer Transformations-Datei übernehmen | Ja |
| `mirror-artifact-to-storage` | fehlende `.md` aus Mongo in Storage spiegeln | Ja (nur wenn `persistToFilesystem`) |
| `mirror-image-to-storage` | `binaryFragments` (Azure) in Storage spiegeln | Nein — nur im Export |
| `register-image-fragments` | `page_*/preview_*` aus Storage in Mongo/Azure registrieren (B1) | Ja |
| `delete-inferior-variant` | strikt unterlegene Transkript-Variante löschen | Ja (siehe §5) |
| `delete-dead-page-md` | tote `page_NNN.md` löschen | Ja (siehe §5) |
| `needs-pipeline` | Quelldatei neuer als Artefakte → nur melden | Nie (Report-only) |
| `conflict` | nicht entscheidbar → nur melden | Nie (Report-only) |

Die UI-Presets („Reparieren", „Exportieren", „Auto-Sync") sind nur
verschiedene `allowedOps`-Mengen über demselben Plan. Der `to-cache`-Zweig
und die `direction`-Semantik entfallen ersatzlos.

## 4. Konflikt-Semantik: Wer gewinnt?

Entscheidungsvorschlag, pro Artefakt-Slot (Kandidaten = Mongo-Record +
Storage-Varianten):

1. **Transkripte: Inhalt gewinnt, nicht die Uhr.**
   „Vollständigste Fassung gewinnt" (Seiten-Marker, dann Länge) — die bewährte
   Reconcile-/`selectBestArtifactVariant`-Regel bleibt DIE Wahrheit
   (Zielmodell §9.2). Begründung: Transkript-Varianten entstehen durch
   Alt-Läufe/Kopien; Timestamps sind auf WebDAV/OneDrive notorisch
   unzuverlässig, Inhalt ist es nicht.
2. **Transformationen: erst Inhalt, dann Uhr, sonst Konflikt.**
   Pro (Template × Sprache) gibt es genau EINEN kanonischen Dateinamen, also
   keine „Varianten" — nur Mongo-Record vs. genau eine Storage-Datei:
   - Inhalt (normalisiert) identisch → `synced`, nichts tun. Das entschärft
     die heutige ±5-s-Timestamp-Zappelei bei identischen Inhalten.
   - Inhalt verschieden → **neuere Seite gewinnt** (±5 s Toleranz wie heute).
     Externe Edits in OneDrive sind hier ein legitimer Workflow; eine
     „Vollständigkeits"-Ordnung ergibt bei redaktionellen Edits keinen Sinn
     (Kürzen ist erlaubt).
   - Timestamps fehlen oder liegen innerhalb der Toleranz, Inhalt aber
     verschieden → **`conflict`: melden, nichts anfassen.** Kein stilles
     „Mongo gewinnt weil primär" — das wäre ein Silent Fallback.
3. **`source-newer` (Quelldatei neuer als Artefakte):** niemals automatisch
   reparieren — Report-Eintrag „Pipeline nötig" (wie heute).
4. **`needs-reextract`** (alle Fassungen 1 Seite trotz `pages > 1`): melden,
   nichts löschen (bestehende Regel, bleibt).
5. **Leeres Markdown** wird weiterhin auf keiner Seite als Gewinner akzeptiert
   (laute Verweigerung, kein Überschreiben mit Leerem).

## 5. Lösch-Operationen: eng begrenzt, immer sichtbar

Es gibt in der ganzen Engine genau **zwei** Lösch-Kategorien — beide aus der
heutigen Reconcile, beide bleiben unverändert konservativ:

1. `delete-inferior-variant`: Storage-Transkript, das strikt unterlegen ist
   UND dessen Name ≠ kanonisch — erst NACHDEM der Gewinner als `{base}.md` +
   Mongo persistiert wurde. Die vollständigste/einzige Kopie wird nie gelöscht.
2. `delete-dead-page-md`: tote `page_NNN.md` (mit dem bestehenden Schutz für
   Quellen, die selbst `page_NNN.*` heißen).

Harte Regeln:

- **Löschen nur im Modus `repair`**, und der Report (check UND repair) listet
  jede Datei namentlich („würde gelöscht" / „gelöscht").
- **Bei `conflict`/`needs-reextract` wird an Transkripten nichts gelöscht**
  (tote `page_NNN.md` ausgenommen — die sind statusunabhängig tot).
- **UI-Fluss: Reparieren nur nach Prüfen.** Settings-Panel und der
  per-Datei-Dialog machen das heute schon richtig (Vorschau → Bestätigen).
  Der Explorer-Button bekommt denselben Fluss (siehe §6) — der heutige
  Direkt-Schreiblauf ohne Vorschau entfällt.
- **Ordner-Cleanup gehört NICHT zu „Reparieren".** Das Löschen ganzer
  Twin-Ordner (`cleanupFilesystem` beim Import) bleibt ausschließlich ein
  expliziter Schalter der Disclosure-Aktion „Aus Dateisystem laden", mit
  eigener destruktiver Bestätigung (wie heute).
- Transformationen werden **nie gelöscht** — es gibt dort keine Varianten,
  nur Übernehmen/Spiegeln/Konflikt-Melden.

## 6. Per-Datei-Versorgung (Archiv-UI)

Alle per-Datei-Fälle laufen über denselben Endpoint mit
`scope: { sourceIds: [id] }` — keine eigenen Routen mehr:

| Heutiger Aufrufer | Nachher |
|---|---|
| „Transkript reparieren" (Artifact-Info-Panel, Vorschau→Apply-Dialog) | unverändert im Fluss, ruft `check`/`repair` mit `sourceIds` — heute schon fast das Zielbild |
| Stiller Auto-Sync `storage-missing` → sync-to-storage | `repair` mit `allowedOps: [mirror-artifact-to-storage]` — gefahrlos (schreibt nur Fehlendes, löscht nie) |
| Stiller Auto-Sync `storage-newer` → sync-from-storage | `repair` mit `allowedOps: [update-mongo-transcript, update-mongo-transformation]` — Konflikt/`needs-reextract` wird NICHT still übernommen, sondern als Banner sichtbar |
| Explorer-Button „Änderungen abgleichen" (Ordner) | wird zweistufig: Klick → `check` auf `folderId` → kompakter Ergebnis-Dialog → „Reparieren"-Bestätigung führt denselben Plan aus. Kein ungefragtes Schreiben mehr |
| Freshness-Banner (`handleRequestUpdate`) | unverändert: `source-newer`/`no-twin` → Pipeline-Dialog (nicht Teil dieser Engine) |

Auto-Sync-Fehler werden nicht mehr verschluckt: mindestens `FileLogger.warn` +
dezenter Toast bei wiederholtem Fehlschlag (genaue UX beim Umbau entscheiden).

## 7. API und Infrastruktur

- **Ein Endpoint:** `POST /api/library/[libraryId]/shadow-twins/reconcile`
  wird erweitert (Name bleibt — er hat schon die richtige Semantik und zwei
  passende UI-Aufrufer):
  ```jsonc
  {
    "mode": "check" | "repair",          // ersetzt apply; apply bleibt übergangsweise als Alias
    "scope": { "folderId"?: string, "recursive"?: boolean, "sourceIds"?: string[] },
    "preset": "repair" | "export" | "auto-sync"  // → allowedOps serverseitig
  }
  ```
- **Job-Infrastruktur von `migrate` übernehmen** (das Beste der fünf):
  Run-Historie in Mongo, `runId` vom Client, 2,5-s-Polling, kooperativer
  Abbruch, `visibilitychange`-Resume. Gilt künftig für Library-weite
  `check`- UND `repair`-Läufe (löst auch „kein maxDuration" + Speicherrisiko:
  `maxDuration = 600`, Quellen batch-weise statt alles im Speicher —
  `FolderCache` + `getShadowTwinsBySourceIds`-Batches aus sync-all/migrate).
  Per-Datei-Aufrufe (`sourceIds`, 1–n klein) antworten weiterhin synchron
  ohne Run-Historie.
- **„Aus Dateisystem laden" (migrate) bleibt eine eigene Route/Aktion** —
  Import ist eine andere Absicht („Storage gewinnt bedingungslos") und passt
  nicht unter Prüfen/Reparieren. Intern soll sie mittelfristig die
  Engine-Bausteine (FolderCache, Artefakt-Sammlung, Writer) teilen; das ist
  Folgearbeit, nicht Welle-4-Kern.

## 8. Was mit den alten Routen passiert

| Route | Schicksal |
|---|---|
| `/shadow-twins/reconcile` | bleibt, wird DIE Engine-Route (erweitertes Body-Schema) |
| `/shadow-twins/sync-all` | entfällt; Aufrufer (Explorer-Button, Analysieren, Exportieren) wandern auf reconcile-`check`/`repair`/`preset: export` |
| `/shadow-twins/sync-to-storage` | entfällt; Auto-Sync ruft reconcile mit `preset: auto-sync` |
| `/shadow-twins/sync-from-storage` | entfällt; dito |
| `/shadow-twins/migrate` (+ `migrations/*`) | bleibt (Import-Aktion); Run-Historie-Infra wird geteilt |
| `/shadow-twins/freshness` | bleibt (reiner Read für Banner/Debug); mittelfristig auf die Plan-Funktion der Engine umstellen, damit Banner-Status und Report identisch urteilen |

Settings-UX danach: Sektion „Prüfen & Reparieren" hat genau zwei
Primär-Buttons (**Prüfen**, **Reparieren**) + EINEN Report; „Analysieren",
„Exportieren", „Sync starten"-Reste verschwinden bzw. wandern in die
Disclosure „Erweitert" (Exportieren, Aus Dateisystem laden).

## 9. Umsetzungs-Schritte (PR-Schnitte, je ≤ 5.000z brutto)

1. **PR A — Plan-Kern:** Transformations- und Mirror-Planung in die reine
   Plan-Schicht ziehen (`buildTranscriptReconcilePlan` → `planSourceSync` mit
   Operationsklassen), Unit-Tests für die Konflikt-Matrix aus §4. Keine
   Routen-/UI-Änderung.
2. **PR B — Engine + Route:** `executeSyncPlan` mit `allowedOps`;
   reconcile-Route um `mode/scope/preset` erweitern (abwärtskompatibel zu
   `apply/sourceIds`); Batch-Verarbeitung + `maxDuration`; Run-Historie für
   Library-Läufe.
3. **PR C — Settings-UX:** Prüfen/Reparieren-Panel auf den einen Report;
   Analysieren/Exportieren-Buttons ersetzen (Export als Disclosure-Preset);
   toten `to-cache`/`dryRun*`-Code im Hook entfernen.
4. **PR D — Archiv-UI:** Explorer-Button zweistufig; Auto-Sync auf Presets;
   per-Datei-Dialog auf neues Body-Schema; `sync-all`/`sync-to-storage`/
   `sync-from-storage`-Routen löschen.

Jede PR mit Trockenlauf-Verifikation gegen Prod-Bestand (lesend) gemäß
Hand-off-Arbeitsregeln; destruktive Läufe nur nach Review des Reports.

## 10. Offene Entscheidungen (User)

1. **Transformations-Regel** (§4.2: Inhalt → Uhr → Konflikt) so ok?
   Alternative wäre „Mongo gewinnt immer" — verwirft dann aber stillschweigend
   externe Edits in OneDrive.
2. **Auto-Sync-Verhalten:** weiterhin still beim Datei-Öffnen (nur mit
   sichtbaren Fehlern), oder ganz auf sichtbares Banner-Angebot umstellen?
   Vorschlag: still lassen, aber nur mit den gefahrlosen Presets aus §6.
3. **Explorer-Button:** zweistufig (Prüfen → Dialog → Reparieren) ok, auch
   wenn das einen Klick mehr kostet als heute?
