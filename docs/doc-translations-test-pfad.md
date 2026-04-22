# Doc Translations Refactor – Test- und E2E-Pfad

Dieses Dokument beschreibt, wie das ueberarbeitete Doc-Translations-System
(globaler Sprach-Switch, dokument-zentrierte Publikation, asynchrone
Translation-Worker) verifiziert wird – sowohl automatisiert (Unit-Tests)
als auch manuell (E2E im laufenden System).

## 1. Architektur-Ueberblick (Kurz)

| Schicht | Datei | Aufgabe |
|---|---|---|
| Datenmodell | `src/types/library.ts`, `src/types/doc-meta.ts` | `config.translations`, `docMetaJson.publication`, `docMetaJson.translations`, `docMetaJson.translationStatus` |
| Registry | `src/lib/detail-view-types/registry.ts` | Single Source of Truth, welche Felder pro `DetailViewType` uebersetzt werden (`translatable`-Block, `getTranslatableFieldsForScope`) |
| Repo | `src/lib/repositories/vector-repo.ts` | `setDocPublication`, `setDocTranslationForLocale`, dynamische Galerie-Projection |
| Helper | `src/lib/i18n/get-localized.ts` | `getLocalized`, `localizeDocMetaJson` (Fallback-Kette) |
| Publish-API | `src/app/api/chat/[libraryId]/docs/publish/route.ts` | Setzt Status, enqueued Translation-Jobs |
| Worker-Phase | `src/lib/external-jobs/phase-translations.ts` | LLM-Translation pro Locale, atomares Write-Back |
| UI | `gallery/virtualized-items-view.tsx`, `publish-document-button.tsx`, `publish-status-chips.tsx`, `settings/translations-form.tsx` | Status-/Sprachen-Spalten, Publish-Button, Settings-Form |

## 2. Automatisierte Tests

### 2.1 Unit-Tests (laufen mit `npx vitest run`)

| Test | Was wird abgedeckt? |
|---|---|
| `tests/unit/i18n/get-localized.test.ts` | Hierarchischer Lookup (active locale → fallback → original); Topics/Labels; `localizeDocMetaJson` Overlay |
| `tests/unit/external-jobs/phase-translations.test.ts` | `splitByScope` verteilt Felder gemaess Scope-Definition; ignoriert nicht spezifizierte Felder; defensive bei Nicht-Arrays |
| `tests/unit/external-jobs/enqueue-translations.test.ts` | Vertrag mit Worker-Dispatcher: `job_type`, `operation`, `correlation.options.phase`, `targetLocale`; `force`-Flag; Bulk-Mapping locale → jobId |

Ausfuehren:
```bash
npx vitest run tests/unit/i18n/get-localized.test.ts \
               tests/unit/external-jobs/phase-translations.test.ts \
               tests/unit/external-jobs/enqueue-translations.test.ts
```

### 2.2 Was bewusst NICHT als Unit-Test abgebildet wird

- **Publish-API** (`route.ts`): Authentifizierung, Library-Loader und Mongo-
  Updates erfordern so viel Mocking, dass ein Test mehr Mock- als Produktiv-
  Verhalten pruefen wuerde. Wird stattdessen im manuellen E2E unten
  abgedeckt.
- **`setDocPublication` / `setDocTranslationForLocale`**: schmale Mongo-
  Wrapper – wird im manuellen E2E inklusive Round-Trip in Mongo verifiziert.
- **`runPhaseTranslations`** als Ganzes: ruft `translateBookData` /
  `translateSessionData` (LLM) auf – nicht ohne Live-Service sinnvoll
  testbar. Die kritische pure Logik (`splitByScope`) ist isoliert getestet.

## 3. Manueller E2E-Testpfad

Voraussetzung: lokaler Stack mit Mongo, Secretary-Service erreichbar,
mindestens eine Library, fuer die der eingeloggte User Owner/Moderator ist.

### Schritt A — Library-Settings konfigurieren

1. Settings → "Sprache & Uebersetzungen" oeffnen (`/settings/chat`).
2. `targetLocales` setzen, z.B. `en`, `it`.
3. `fallbackLocale` setzen (z.B. `en`).
4. `autoTranslateOnPublish` aktivieren.
5. Speichern; in Mongo pruefen, dass
   `libraries.<id>.config.translations` exakt diese Werte enthaelt.

### Schritt B — Dokument als Draft erkennen

1. Galerie der Library oeffnen.
2. In der Tabellenansicht muessen die Spalten **Status** und **Sprachen**
   sichtbar sein (nur fuer Owner/Moderatoren).
3. Ein neu ingestiertes Dokument zeigt Status `Draft` und keine Sprach-Chips.

### Schritt C — Publish ausloesen

1. Auf den Publish-Button in der Aktionsspalte klicken.
2. Erwartung im UI:
   - Status-Chip wechselt auf `Published`.
   - Sprach-Chips erscheinen pro `targetLocale` mit Status `pending` (gelb).
3. Erwartung in Mongo (`<libraryKey>.<fileId>-meta`):
   - `docMetaJson.publication.status === 'published'`.
   - `docMetaJson.publication.publishedBy === <user-email>`.
   - `docMetaJson.translationStatus.<locale> === 'pending'` fuer jede
     Ziel-Locale (ausser `sourceLocale`).
4. Erwartung in `external_jobs` Collection:
   - Pro Ziel-Locale ein Eintrag mit `job_type: 'translation'`,
     `operation: 'translate'`, `correlation.source.itemId === fileId`,
     `correlation.options.phase === 'phase-translations'`.

### Schritt D — Worker-Verarbeitung

1. Worker laeuft (z.B. `npm run worker`).
2. Pro Job sollte `runPhaseTranslations` ausgefuehrt werden:
   - Step `phase-translations` durchlaeuft `pending → running → completed`.
   - Bei Erfolg: `docMetaJson.translations.gallery.<locale>` und
     `.detail.<locale>` enthalten die uebersetzten Felder; Status-Chip wird
     gruen.
   - Bei Fehler: `docMetaJson.translationStatus.<locale> === 'failed'`,
     `docMetaJson.translationErrors.<locale>` enthaelt die Fehlermeldung;
     Status-Chip wird rot.

### Schritt E — Galerie-Lookup mit globaler Locale

1. Globaler Sprach-Switch (Header) auf eine Ziel-Locale stellen.
2. In der Galerie muessen erscheinen:
   - Titel, Kurz-Titel, Track, Tags und Kategorien in der gewaehlten Sprache
     (sofern `gallery`-Scope-Translation existiert).
   - Facetten-Filter zeigen lokalisierte Display-Labels an, **die
     Filterwerte selbst bleiben kanonisch** (Test: Filter setzen, neu
     laden – die ausgewaehlten Filter bleiben aktiv).
3. Detail-Overlay oeffnen: alle textuellen Felder (Title, Description,
   Topics, etc.) werden in der globalen Locale gezeigt – ohne lokalen
   Sprach-Tab.

### Schritt F — Re-Translate / Force

1. Re-Translate-Button im Aktionsmenue klicken.
2. Erwartung: neuer Job pro Locale mit `correlation.options.force === true`
   wird enqueued; Worker ueberschreibt bestehende
   `translations.gallery.<locale>` / `.detail.<locale>`.

### Schritt G — Unpublish

1. Unpublish-Button klicken.
2. Erwartung: `docMetaJson.publication.status === 'draft'`,
   `publishedAt === null`. Translations bleiben erhalten (sind Cache),
   werden aber im Frontend ausserhalb der Galerie nicht mehr genutzt.

### Schritt H — Fallback-Locale

1. Globalen Switch auf eine Locale stellen, die NICHT in `targetLocales`
   ist und auch nicht der Originalsprache entspricht.
2. Erwartung: UI zeigt Inhalte in der `fallbackLocale`. Wenn auch diese
   keine Translation hat, fallen die Felder auf das Original
   (`docMetaJson.<feldname>` bzw. Top-Level `doc.<feldname>`) zurueck.

## 4. Re-Ingest-Verhalten (offen / TODO)

Aktuell ueberschreibt `upsertVectorMeta` (Re-Ingest) den gesamten
`docMetaJson`-Block, sodass bestehende `translations.*` und
`translationStatus` verloren gehen. Das ist *implizit* eine Cache-
Invalidation, aber nicht explizit dokumentiert oder getestet.

Empfohlener Folgeschritt (nicht Teil dieses Refactors):

1. In `upsertVectorMeta` `docMetaJson.translations` und
   `docMetaJson.translationStatus` **bewusst** mergen oder explizit
   loeschen + neu auf `pending` setzen, je nach Wunsch.
2. Manuellen Test ergaenzen: "Re-Ingest eines bereits publizierten
   Dokuments → Status wechselt automatisch auf `pending` und Worker
   uebersetzt erneut."

## 5. Migrations-Validierung

Das Skript `scripts/migrate-translations-into-docmeta.ts` migriert die
alte `translations`-Collection in `docMetaJson.translations`.

Validierung nach Lauf:

```bash
# Dry-Run zur Vorab-Pruefung
npx tsx scripts/migrate-translations-into-docmeta.ts --dryRun

# Echter Lauf
npx tsx scripts/migrate-translations-into-docmeta.ts

# Optional: alte Collection nach erfolgreicher Migration entfernen
npx tsx scripts/migrate-translations-into-docmeta.ts --drop
```

Stichprobe in Mongo:

- Anzahl Dokumente in `translations` (alt) === Anzahl Dokumente mit
  `docMetaJson.translations` (neu, pro Library).
- Fuer ein Beispiel-`fileId`: alle ehemaligen `targetLanguage`-Eintraege
  sind als `docMetaJson.translations.gallery.<locale>` und
  `.detail.<locale>` vorhanden.
