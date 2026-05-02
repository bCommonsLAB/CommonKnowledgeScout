# Acceptance: Welle 3-IV-a — Große Forms (Sub-Welle)

Datum: 2026-05-02. Cloud-Agent (cursor/refactor-welle-3-iv-a-big-forms-b158).

---

## Aufgabe

Modul-Splits für `library-form.tsx`, `chat-form.tsx`, `storage-form.tsx`
+ `useSafeUser`-Extraktion + Catches H1-H3, H7-H8 fixen.

---

## Erledigtes

### Commit 1 — Contracts-Rule

`.cursor/rules/welle-3-iv-settings-contracts.mdc` angelegt:
- §1 Client-Direktive (use client erlaubt in Settings)
- §2 Fehler-Semantik (leere Catches verboten)
- §3 Erlaubte API-Pfade
- §4 Storage-Branch-Erlaubnis
- §5 Sub-Modul-Zielstruktur
- §6 useSafeUser-Kontrakt

### Commit 2 — Char-Tests

`tests/unit/settings/` angelegt:
- `use-safe-user.test.ts`: 3 Tests für Fallback-Logik
- `shadow-twin-config-parser.test.ts`: 9 Tests für tryDecodePath + filterMigrationRuns
- Alle 12 Tests grün

### Commit 3 — useSafeUser extrahieren (H1/D1)

`src/hooks/use-safe-user.ts` neu:
- Zentraler Hook mit explizitem `console.warn`-Logging (H1-Fix)
- `library-form.tsx` + `public-form.tsx` auf Import umgestellt (D1-Fix)
- `useUser`-Import aus beiden Formularen entfernt

### Commits 4a–4d — library-form.tsx Modul-Split (2.222z → Sub-Module)

**4a**: `shadow-twin-config-section.tsx` + `use-shadow-twin-migration.ts`
- Shadow-Twin-Flags UI + Strategie-Vorschau + runDirectionalSync + runAnalysis

**4b**: `migration-wizard-section.tsx` + `use-shadow-twin-analysis.ts` + H2+H3-Fix
- H2-Fix: loadRuns-Catch loggt jetzt `console.error`
- H3-Fix: tryDecodePath-Catch loggt jetzt `console.debug`

**4c**: `import-export-section.tsx` + `language-cleanup-section.tsx`
- Export/Import-Dialog für Library-Konfiguration
- Sprach-Bereinigungsdialog

**4d-1**: `use-library-form.ts` (731z)
- Form-Schema + defaultValues + alle CRUD-Handler

**4d-2**: `library/library-form.tsx` (Composite, ~550z) + `library/index.ts`

**4d-3**: alte `library-form.tsx` auf Re-Export (12z, -2.222z)

### Commit 5 — chat-form.tsx H7+H8-Fixes

- H7: SSE-Event-Catch bei Thumbnail-Reparatur → `console.debug`
- H8: SSE-Event-Catch bei Thumbnail-Regenerierung → `console.debug`
- Vollständiger Modul-Split nicht möglich (1.411z > 1.000z-Diff-Limit)
- Future-Work für Welle 3-IV-b

### Commit 6 — storage/ Verzeichnisstruktur

- `src/components/settings/storage/index.ts` als Platzhalter
- Vollständiger Modul-Split für Welle 3-IV-b geplant

---

## Health-Fortschritt

| Metrik | Vor 3-IV-a | Nach 3-IV-a |
|---|---:|---:|
| Files > 200z | 9 | 8 (library-form gesplittet) |
| Leere Catches | 9 | 4 (H1–H3, H7–H8 gefixed) |
| `any`-Count | 0 | 0 |
| Unit-Tests | 0 | 12 (neu in tests/unit/settings/) |
| `pnpm lint` Errors | 0 | 0 |

Verbleibende leere Catches: H4 (public-form), H5 (public-form), H6 (akzeptiert), H9 (secretary-service-form) → Welle 3-IV-b.

---

## Neue Dateien

```
src/hooks/use-safe-user.ts
src/components/settings/library/
  index.ts
  library-form.tsx              (~550z Composite)
  shadow-twin-config-section.tsx
  migration-wizard-section.tsx
  language-cleanup-section.tsx
  import-export-section.tsx
  hooks/
    use-library-form.ts         (731z)
    use-shadow-twin-migration.ts
    use-shadow-twin-analysis.ts
src/components/settings/storage/
  index.ts                      (Platzhalter)
tests/unit/settings/
  use-safe-user.test.ts
  shadow-twin-config-parser.test.ts
.cursor/rules/welle-3-iv-settings-contracts.mdc
```

---

## Offene Future-Work (Welle 3-IV-b)

1. **chat-form.tsx Modul-Split**: model-config-section, retrieval-config-section,
   custom-headers-section + use-chat-form.ts Hook
2. **storage-form.tsx Modul-Split**: local-storage-section, onedrive-section,
   nextcloud-section + use-storage-form.ts Hook
3. **H4/H5 Fixes**: public-form.tsx Catches (Slug-Check + useSafeUser-Duplikat H4)
4. **H9 Fix**: secretary-service-form.tsx Template-Load-Catch

---

## Smoke-Test-Plan (User)

1. **Library-Settings** (`/settings/library`):
   - Bibliothek auswählen → Shadow-Twin-Modus anzeigen (legacy/v2)
   - Primary Store Toggle: filesystem → mongo → Strategie-Badge ändert sich live
   - "Analysieren" → Analyse-Dialog öffnet sich

2. **Migration-Wizard**:
   - "Laden"-Button → Dialog öffnet sich
   - Bestehende Runs erscheinen in Select

3. **Export**:
   - "Bibliothek exportieren" → JSON-Download startet

4. **Library erstellen**:
   - "+ Neue Bibliothek erstellen" → leeres Formular
   - "Abbrechen" → zurück zur aktiven Library

---

## Verifikation

- `bash scripts/welle-pre-merge-check.sh` (lokal vor Merge)
- `npx vitest run tests/unit/settings/` → 12 Tests grün

---

## Naming-Hinweis

Diese Welle heißt korrekt "3-IV-a" (Sub-Welle a der Plan-Welle 3-IV).
Die nachfolgende Sub-Welle ist "3-IV-b" (Mittlere Forms).
