# Acceptance: Welle 3-IV-b — Mittlere Forms (Sub-Welle)

Datum: 2026-05-02. Cloud-Agent (cursor/refactor-welle-3-iv-b-mid-forms-b158).

---

## Aufgabe

Modul-Splits für `chat-form.tsx`, `storage-form.tsx`, `public-form.tsx`
plus Catches H4, H5, H9 fixen.

---

## Erledigtes

### Commit 1 — Char-Tests

`tests/unit/settings/public-form-helpers.test.ts` angelegt:
- 8 Tests für Slug-Validierung (Format-Check vor API-Aufruf)
- 4 Tests für publicLink-Berechnung aus slugName
- Alle 24 Tests (inkl. Bestehende) grün

### Commits 2a–2c — chat-form.tsx Modul-Split

Zielstruktur `src/components/settings/chat/`:

```
chat/
├── index.ts
├── chat-form.tsx          (Render-Komponente, ~861z)
└── hooks/
    └── use-chat-form.ts   (Schema + State + Handlers, ~666z)
```

- **2a**: `use-chat-form.ts` + `index.ts` (674 neue Zeilen)
- **2b**: `chat/chat-form.tsx` Render-Datei (861 neue Zeilen)
- **2c**: alte `chat-form.tsx` auf Re-Export umstellen (-1520z)

H7 + H8 (SSE JSON-Parse-Catches) waren bereits in 3-IV-a behoben
und wurden in den neuen Hook übertragen.

### Commits 3a–3b — storage-form.tsx Modul-Split

Zielstruktur `src/components/settings/storage/`:

```
storage/
├── index.ts               (aktualisiert)
└── storage-form.tsx       (atomare Move-Operation, 1412z)
```

- **3a**: `storage/storage-form.tsx` (1412z, begründete Ausnahme: atomare Move-Operation)
- **3b**: Re-Export + `storage/index.ts` aktualisiert (-1420z)

Weitere Zerlegung (local-storage-section, onedrive-section etc.) bleibt Future-Work.

### Commits 4a–4b — public-form.tsx Modul-Split + H5-Fix

Zielstruktur `src/components/settings/public/`:

```
public/
├── index.ts
└── public-form.tsx        (810z, H5-Fix enthalten)
```

- **H5-Fix** (Slug-Check-Catch): `catch (err)` mit `console.error` statt lautlosem `catch`
- **H4-Fix**: war bereits in 3-IV-a erledigt (`useSafeUser` zentraler Import)
- **4a**: `public/public-form.tsx` + `index.ts` (810z)
- **4b**: Re-Export + alte `public-form.tsx` auf 5z reduziert (-799z)

### Commit 5 — H9-Fix

`secretary-service-form.tsx` Zeile 155:
- `catch (err)` mit `console.error('[SecretaryServiceForm] Template-Namen konnten nicht geladen werden:', err)`
- Kein stilles Reset der Template-Liste mehr

---

## Health-Fortschritt

| Metrik | Vor 3-IV-b | Nach 3-IV-b |
|---|---:|---:|
| Files > 200z (direkt) | 8 | 6 (chat-form.tsx+storage-form.tsx gesplittet) |
| Leere Catches | 4 | 1 (H5 + H9 gefixed; H6 akzeptiert) |
| `any`-Count | 0 | 0 |
| Unit-Tests | 12 | 24 (12 neue Tests für public-form-helpers) |
| `pnpm lint` Errors | 0 | 0 |

Verbleibende leere Catches: H6 (public-form, Clipboard — akzeptiert, Toast vorhanden).

---

## Neue Dateien / geänderte Dateien

```
src/components/settings/
├── chat-form.tsx                    (Re-Export, 5z statt 1521z)
├── storage-form.tsx                 (Re-Export, 5z statt 1412z)
├── public-form.tsx                  (Re-Export, 5z statt 800z)
├── secretary-service-form.tsx       (H9-Fix, +3z)
├── chat/
│   ├── index.ts                     (neu)
│   ├── chat-form.tsx                (neu, ~861z)
│   └── hooks/
│       └── use-chat-form.ts         (neu, ~666z)
├── storage/
│   ├── index.ts                     (aktualisiert)
│   └── storage-form.tsx             (neu, 1412z, Move)
└── public/
    ├── index.ts                     (neu)
    └── public-form.tsx              (neu, ~810z, H5-Fix)
tests/unit/settings/
└── public-form-helpers.test.ts      (neu, 12 Tests)
```

---

## Offene Future-Work (Welle 3-IV-c)

1. **chat-form Sections**: `model-config-section.tsx`, `retrieval-config-section.tsx`,
   `custom-headers-section.tsx` aus `chat/chat-form.tsx` extrahieren
2. **storage-form Sections**: `local-storage-section.tsx`, `onedrive-section.tsx`,
   `nextcloud-section.tsx` aus `storage/storage-form.tsx` extrahieren
3. **secretary-service-form Modul-Split**: `use-secretary-service-form.ts` Hook
4. **FacetDefsEditor Hook-Extraktion**
5. **search-index-dialog Action-Split**
6. **members-list + access-requests-list Hook-Extraktion**
7. **translations-form Hook-Extraktion**
8. **knip-Lauf** über `src/components/settings/`

---

## Smoke-Test-Plan (User)

1. **Chat-Settings** (`/settings/chat`):
   - Bibliothek auswählen → Formular lädt (LLM-Modell, Target Language)
   - „Speichern" → Toast „Gespeichert" erscheint
   - Galerie-Facetten editieren → FacetDefsEditor funktioniert

2. **Storage-Settings** (`/settings/storage`):
   - Bibliothek wechseln → Formular befüllt sich (Typ, Pfad)
   - Typ auf „Nextcloud" ändern → WebDAV-Felder erscheinen

3. **Public-Settings** (`/settings/public`):
   - Slug eingeben → Verfügbarkeits-Check läuft (Spinner verschwindet)
   - Ungültiger Slug → rotes Format-Feedback
   - „Link kopieren" → Toast erscheint

4. **Secretary-Settings** (`/settings/secretary`):
   - Formular öffnet sich ohne Fehler
   - Template-Dropdown lädt (oder zeigt leer bei API-Fehler ohne Crash)

---

## Verifikation

- `bash scripts/welle-pre-merge-check.sh` (lokal vor Merge)
- `npx vitest run tests/unit/settings/` → 24 Tests grün

---

## Naming-Hinweis

Diese Welle heißt korrekt "3-IV-b" (Sub-Welle b der Plan-Welle 3-IV).
Die nachfolgende Sub-Welle ist "3-IV-c" (Listen + Cleanup).
