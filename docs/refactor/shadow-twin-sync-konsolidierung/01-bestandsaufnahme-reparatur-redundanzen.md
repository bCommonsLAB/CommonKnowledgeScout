# Bestandsaufnahme: Redundante Reparatur-Logiken (Stand 2026-08-09)

Status: BEFUND aus Live-Session Umweltarchiv (Legacy-Migration 963 Dateien).
Ergänzt [00-design-vorschlag.md](00-design-vorschlag.md) — dessen Inventur (§1)
war unvollständig: `reconstruct` fehlte, `migrate` wurde bewusst ausgeklammert.

## 1. Ist-Zustand: DREI aktive Reparatur-Logiken für Artefakte

| # | Logik | Route | Arbeitsweise | UI-Aufrufer |
|---|---|---|---|---|
| A | **Sync-Engine** (Welle 4) | `/shadow-twins/reconcile` | Mongo-getrieben; EIN Plan, check/repair; Konflikt-Matrix | Settings „Mit Speicher abgleichen"; per Datei „Datei reparieren" |
| B | **Migration/Import** | `/shadow-twins/migrate` | Storage-getrieben, rekursiv; „Storage gewinnt bedingungslos"; Run-Historie/Cancel | Settings „Aus Dateisystem laden" (Sektion „Daten & Wartung") |
| C | **Rekonstruktion** | `/shadow-twins/reconstruct` + lazy via `artifacts/resolve` | Storage-getrieben, EINE Quelle; eigene Auswahl-/Writer-Logik | per Datei „Alle Artefakte aus Storage übernehmen"; automatisch beim Öffnen |

Dazu getrennte Domäne (bewusst, Design §2): **Dokument-Angaben prüfen/reparieren**
(Basis-Felder/Facetten, A0-Gates) — gleiche Settings-Seite, andere Datenwelt.

### Drei Schreibpfade nach Mongo (statt einem)

1. `persistShadowTwinToMongo` (kanonisch, mit Bild-Einfrieren) — von C
2. `upsertShadowTwinArtifact` (schlanker Fallback) — von C
3. `prepareSourceArtifacts`/`upsertArtifactFromPrepared` (migration-writer) — von B
4. Engine-Executor (`execute-source-plan` → ShadowTwinService/Repo) — von A

## 2. Warum wurde das in Welle 4 nicht konsolidiert?

- Die Welle-4-Inventur (§1) listete **fünf** Engines — `reconstruct/route.ts`
  und die Lazy-Rekonstruktion **fehlten in der Bestandsaufnahme komplett**.
- `migrate` wurde **bewusst** separat gelassen (§7: „Import ist eine andere
  Absicht") — mit der Folgearbeit „Bausteine teilen", die nie eingeplant wurde.
- Ergebnis: Welle 4 hat 3 von 6 Mechanismen vereinheitlicht; 2 blieben als
  eigenständige Logiken zurück, 1 war nie auf der Landkarte.

## 3. Konkrete Folgen (Live beobachtet, Umweltarchiv)

1. **A sieht Storage-only-Quellen nicht:** Library-Scope ist Mongo-getrieben;
   Ordner-Scope überspringt Quellen ohne Mongo-Doc
   (`run-library-sync.ts` resolveSources: `if (doc) pairs.push`).
   → Nach der Legacy-Migration von 963 Dateien fand „Speicher-Abgleich" nur
   6 Quellen.
2. **Transkript-Guard-Bug in B UND C** (kopierte Logik = kopierter Bug):
   `if (!parsed.kind || !parsed.targetLanguage) return/continue` verwirft das
   KANONISCHE sprach-neutrale Transkript `{base}.md` (targetLanguage = null).
   - C: `reconstruct-from-storage.ts:160`
   - B: `migrate/route.ts:154`
3. **C spiegelt Bilder nur bei Markdown-Erfolg** (`results.some(success)`,
   `reconstruct-from-storage.ts:233`) — Quelle ohne neue Artefakte bekommt
   ihre `preview_*`/`page_*` nie in den Cache.
4. **C lädt bestehende Storage-Dateien erneut hoch** → OneDrive „Name already
   exists"-Fehler im Log (upsertArtifact im Provider-Store).
5. **Namens-/Pfad-Analyse existiert nirgends:** Legacy-Namenskonventionen
   (`{base}.{lang}.md`, Kombi-Dateien) und OneDrive-Pfadlimit (400 Zeichen
   inkl. ~53 Site-Präfix) mussten manuell per Skript geprüft werden.

## 4. Ziel (User-Entscheid): EIN Button pro Library

„Cache analysieren, Filesystem analysieren, Dateinamen analysieren, Fehlendes
reparieren — einfach zu bedienen." (vgl. Memory „Storage sync"-Vision)

### Weg dorthin, in kleinen Wellen

**Welle 5a — Engine wird storage-vollständig (Kern-Fix):**
- Ordner-/Library-Scope: Quellen OHNE Mongo-Doc nicht überspringen, sondern
  adoptieren (Artefakt-Sammlung aus B wiederverwenden). Neue Operationsklasse
  `adopt-storage-only-source`.
- Transkript-Guard in Parser-Nutzung fixen: `kind === 'transcript'` erlaubt
  `targetLanguage: null` (betrifft A-Collect, B, C).

**Welle 5b — C auf Engine umstellen:**
- „Alle Artefakte aus Storage übernehmen" + Lazy-Resolve rufen die Engine mit
  `scope: {sourceIds}` (Preset `repair`). `reconstruct-from-storage.ts`
  schrumpft auf Engine-Bausteine (Bild-Registrierung bleibt als Baustein).

**Welle 5c — Namens-Migration in den Plan („Aus Alt mach Neu"):**
- Ausführbare Repair-Ops: `migrate-legacy-artifact-name` (Muster A: Rename)
  und `split-combined-artifact` (Muster B: Kombi-Datei → Transkript +
  Transformation). Template-Name aus Library-Config; nicht ableitbar ⇒ Report.
- Report-only: `legacy-transcript-name`, `path-too-long` (Budget:
  400 − Site-Präfix ≈ 347, konfigurierbar). Renames nur, wenn Ziel im Budget.
- User-Ziel: veraltete/nur-im-Filesystem-überlebte Library in beliebiger
  Instanz rekonstruieren, „als wäre sie gerade eben erstellt" — darf sich
  daher NIE auf vorhandene Mongo-Docs oder alte sourceIds verlassen.
  Details: [Hand-off 2026-08-09](../../handover/2026-08-09-welle-5-reparatur-konsolidierung.md).

**Welle 5d — UI:**
- Library-Settings: EIN Primär-Flow „Prüfen → Report → Reparieren" der die
  Engine (jetzt storage-vollständig) fährt. „Aus Dateisystem laden" wird
  Engine-Preset (`import`, Storage gewinnt) in der Disclosure; eigener
  Migrations-Writer entfällt. Dokument-Angaben-Prüfung bleibt zweite Karte
  (andere Domäne), aber gleicher Report-Stil.

### Was danach gelöscht/geteilt ist

| Baustein | Schicksal |
|---|---|
| `reconstruct-from-storage.ts` (Entscheidungslogik) | entfällt → Engine |
| `shadow-twin-migration-writer` | entfällt → Engine-Executor |
| `migrate/route.ts` | dünner Wrapper: Engine mit Preset `import` + Job-Infra |
| `reconstruct/route.ts` | dünner Wrapper oder entfällt (Aufrufer → reconcile) |
| Schreibpfade nach Mongo | genau EINER (Engine-Executor) |

## 5. Offene Reparatur-Reste dieser Session (Umweltarchiv)

- 963 migrierte Transformationen sind im Storage korrekt benannt und
  cloud-synchron, aber noch NICHT in Mongo (Engine sieht sie nicht, s. §3.1).
  Interim-Weg: „Aus Dateisystem laden" (B) → danach Engine-Repair für
  Transkripte. Oder direkt Welle 5a umsetzen und Engine-Repair fährt alles.
- 3 fehlgeschlagene `register-image-fragments` aus dem Engine-Repair der 6
  bekannten Quellen — Ursache offen (kein Log-Detail).
