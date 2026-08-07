# Hand-off: Shadow-Twin Wellen 1–3 (Legacy-Ausbau) & Settings-Vereinfachung

**Datum:** 2026-08-07
**Worktree:** `.claude/worktrees/bold-goodall-1263ea`
**Offene PRs (gestapelt, in dieser Reihenfolge mergen):**
[#143](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/143) Cleanup →
[#144](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/144) Welle 1 →
[#145](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/145) Welle 2 →
[#146](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/146) Welle 3

---

## 1. Kontext (Absicht)

Fortsetzung des Hand-offs vom 2026-08-04. User-Entscheid: **Der Betrieb ohne
MongoDB wird ausgebaut** — Mongo ist immer primärer Store, das Dateisystem nur
Backup-Spiegel (`persistToFilesystem`) + Lese-Fallback (`allowFilesystemFallback`).
Der Settings-Bereich „Erweitert" war unverständlich und voller Duplikate; er
wurde entwirrt. Alles in drei Wellen, jede als eigene PR.

## 2. Was fertig ist

### Welle 1 (#144) — Eine Wahrheit herstellen
- `getShadowTwinConfig`: Default `mongo`; **Inbox-Kontrakt** (ADR-0004 II,
  `library=null`) ist ein expliziter Zweig — NICHT den Default flippen ohne ihn!
- Strategie-Vorschau (Settings) rechnet mit echter Library-Config statt
  hartkodiertem `mongo` (Hand-off-§3.5-Bug).
- `POST /api/libraries` setzt bei neuen Libraries die volle Shadow-Twin-Config.
- Backfill `scripts/normalize-library-shadow-twin-config.ts` — **auf Prod
  angewendet:** 10 Libraries explizit gesetzt, 0 nutzten `filesystem`.

### Welle 2 (#145) — Legacy-Ausbau (+74/−523 Zeilen)
- Config-Feld `primaryStore` wird **nirgends mehr gelesen** (Typ bleibt
  `@deprecated`, wird weiter mit `mongo` geschrieben — Rollback-Sicherheit).
- 5×„Mongo ist nicht aktiv"-Gates weg; alle `filesystem||persist`-ORs →
  `persistToFilesystem`; tote Provider-Scan-Pfade in batch-resolve (−255) und
  folder-discovery (−85) entfernt; Client-Reads bereinigt.
- `'filesystem'` existiert nur noch als Inbox-Kontrakt an ZWEI Stellen:
  `shadow-twin-service.ts` (Store-Fork) + `phase-shadow-twin-loader.ts` (Prio 3).

### Welle 3 (#146) — Thumbnail-Bugs + Settings-UX
- Engines nutzen Library-Azure-Config (`resolveAzureStorageConfig`) statt ENV.
- „Neu berechnen"-Abschluss kommt an (Route sendet `progress`+`status=completed`,
  kein `complete`-Event); Fehler als Toast.
- EIN Kriterium (`ORIGINAL_ELEM`/`THUMBNAIL_ELEM` in
  `src/lib/image/thumbnail-repair-service.ts`): echte Mengen-Differenz,
  Ein-Pass-Aggregation (vorher 2×`$unwind` = „Lade Statistik…"-Hänger),
  Nicht-Bild-MIME zählt nicht als Cover. `maxDuration=600`.
- UI: 3 Thumbnail-Buttons → EINE Aktion „Vorschaubilder erneuern" + Checkbox;
  Such-Index-Button zur Suche; Seite gegliedert (KI/Suche/Bilder ·
  Prüfen & Reparieren · Daten & Wartung) mit Klartext-Erklärungen.

### Daten (Prod, `common-knowledge-scout-prod`)
- **Twin-Ordner-Normalisierung KOMPLETT** (alle erreichbaren Libraries):
  Umweltarchiv 956, Commoning 9, Dialograum 22 umbenannt; SFSCON/CAST 0.
  Kontroll-Trockenläufe: 0 verbleibend.
- **OneDrive-Login-Blocker gelöst:** SFSCON + Commoning hatten wörtlich
  `********` als `clientSecret` in der DB (Alt-Korruption vor dem
  D5-Fix/preserveMaskedSecrets). Symptom: Login leitet kommentarlos auf
  `/settings/storage?authError=…` um. Fix per
  `scripts/restore-onedrive-client-secret.ts` (kopiert Secret aus intakter
  Library derselben Azure-App; alle 12 OneDrive-Libraries teilen EINE App).
- Getestet (lesend + Schreib-Stichproben): Statistik an 653-Doc-Bestand,
  Reconcile-Vorschau, Migrate-Dry-Run und -Echt-Lauf (leeres Markdown wird
  korrekt laut verweigert), Thumbnail-Repair-Lauf.

## 3. Git-Besonderheiten

- #142 wurde **squash-gemergt** → die Kette wurde per
  `git rebase --onto origin/master claude/doctor-command-7a19de` neu aufgebaut
  und force-gepusht. Backup-Tags `backup/{cleanup,simplify,w2,w3}-pre-rebase`
  liegen lokal im Worktree bold-goodall.
- Alter Worktree `vigilant-heisenberg-f6ab76` hält den lokalen (veralteten)
  `claude/shadow-twin-legacy-cleanup` fest — origin ist aktuell; der lokale
  Branch dort darf ignoriert/aufgeräumt werden.
- Beim Mergen jeweils „delete branch" wählen → GitHub retargetet die nächste
  PR automatisch auf master.

## 4. Was als Nächstes ansteht

1. **User:** `bash scripts/welle-pre-merge-check.sh` lokal, dann PRs 143→146
   in Reihenfolge mergen.
2. **Welle 4** (NEUE Session, frisch von master, hohes Thinking — Löschlogik!):
   Die 5 Sync-Engines auf eine reduzieren. Karte (Settings-Audit 2026-08-05):
   - `reconcile-library.ts` (Vorschau/Sync-Panel; „vollständigste Fassung
     gewinnt", löscht unterlegene Varianten; KEIN maxDuration, lädt alle Twins
     in den Speicher)
   - `sync-all/route.ts` (Analyse/Exportieren; Timestamp-Diff, `to-cache`-Zweig
     hat keinen UI-Button)
   - `migrate/route.ts` (Aus Dateisystem laden; Run-Historie, Cancel)
   - `sync-to-storage`/`sync-from-storage` (per-Datei-Varianten, Archiv-UI)
   Ziel-UX: ein „Prüfen" (dry-run) + ein „Reparieren", erweiterte Aktionen
   als Disclosure. Verifikation (Metadaten-Domäne) bleibt separat.
3. **Massenlauf Umweltarchiv** (908 Docs, neues Template `pdfanalyse.md`) —
   NUR auf ausdrückliche Freigabe (echte LLM-Kosten). Danach Prüflauf;
   erwartet: `category`/`targetLanguage`/`date`-Befunde verschwinden.
4. Offene Kleinigkeiten: Task-Chip „Doppelte React-Keys auf Settings-Seite";
   vorbestehende Typfehler in `tests/` (eigener Chip); bcoop-WebDAV-404;
   fremde Owner (Paul/Simon/Testarchive) nicht normalisiert.

## 5. Arbeitsregeln, die sich bewährt haben

- **Trockenlauf zuerst**, `--apply` nur nach Review; MongoDB für Diagnosen
  nur lesend; Schreib-Stichproben einzeln freigeben lassen.
- Worktree-.env zeigt auf **PROD** (`common-knowledge-scout-prod`) — der lokale
  Dev-Server arbeitet direkt auf Prod!
- Skripte: `NODE_PATH="$PWD/node_modules" node --import tsx scripts/…` aus dem
  Worktree; User-Terminal ist **PowerShell 5.1** (kein `&&`, kein `VAR=x cmd`).
- Der Berechtigungs-Wächter blockiert manche `--apply`/destruktive Kommandos —
  dann dem User ein kopierbares Kommando geben (PowerShell-Syntax!).
- `getShadowTwinConfig(null)` = Inbox-Kontrakt. Wer ihn anfasst, bricht die
  Erfassungs-Jobs (`external-jobs/provider.ts` erklärt das Muster).
