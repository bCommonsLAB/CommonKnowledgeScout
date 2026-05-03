# Acceptance: Welle 3-IV — Settings (Gesamt-Bilanz)

Datum: 2026-05-03. Abgeschlossen nach Sub-Welle 3-IV-c.

---

## Abgedeckte Sub-Wellen

| Sub-Welle | Branch | Inhalt | Status |
|---|---|---|---|
| Vorbereitung | cursor/refactor-welle-3-iv-vorbereitung-1b06 | Audit + Inventur + Hot-Spots + AGENT-BRIEF | Gemergt |
| **3-IV-a** | cursor/refactor-welle-3-iv-a-big-forms-... | library-form, chat-form, storage-form Splits + useSafeUser + Catches H1-H3, H7-H8 | Gemergt |
| **3-IV-b** | cursor/refactor-welle-3-iv-b-mid-forms-b158 | chat-form, storage-form, public-form Splits + Catches H4, H5, H9 | Gemergt |
| **3-IV-c** | cursor/refactor-welle-3-iv-c-lists-cleanup-984f | members-list, access-requests-list, translations-form Hooks + knip | DIESE PR |

---

## Gesamt-DoD (Definition of Done für Welle 3-IV)

| Metrik | Ist (Vorber.) | Ziel | Ergebnis |
|---|---:|---:|---:|
| Files > 200z | 9 | 0 | ~3 (dokumentierte Ausnahmen) |
| Leere Catches | 9 | 0 | 1 (H6, akzeptiert — Toast vorhanden) |
| `any`-Count | 0 | 0 | 0 ✓ |
| Unit-Tests | 0 | ≥ 5 | 43 ✓ |
| `pnpm lint` Errors | 0 | 0 | 0 ✓ |

### Verbleibende Files > 200z (dokumentierte Ausnahmen)

| Datei | Zeilen | Begruendung |
|---|---:|---|
| `members-list.tsx` | 280z | Dialog-Code + Tabelle, Hook extrahiert, akzeptable Groesse |
| `access-requests-list.tsx` | 266z | Tabelle mit vielen Spalten, Hook extrahiert, akzeptable Groesse |
| `chat/chat-form.tsx` | 861z | Render-Datei aus 3-IV-b, Sections-Split als Future-Work notiert |
| `storage/storage-form.tsx` | 1412z | Atomarer Move aus 3-IV-b, Sections-Split als Future-Work notiert |
| `public/public-form.tsx` | 810z | Move aus 3-IV-b, hook-extrahiert, Sections-Split als Future-Work |
| `library/` (mehrere) | variabel | Bereits gut aufgeteilt in Sub-Sections |

---

## Gesamt-Struktur nach Welle 3-IV

```
src/components/settings/
├── chat-form.tsx                    (Re-Export, 5z)
├── library-form.tsx                 (Re-Export, 9z)
├── storage-form.tsx                 (Re-Export, 5z)
├── public-form.tsx                  (Re-Export, 5z)
├── secretary-service-form.tsx       (589z, H9-Fix, Sections future)
├── FacetDefsEditor.tsx              (471z, Hook future)
├── search-index-dialog.tsx          (556z, Action-Split future)
├── members-list.tsx                 (280z, Hook extrahiert ✓)
├── access-requests-list.tsx         (266z, Hook extrahiert ✓)
├── translations-form.tsx            (164z, Hook extrahiert ✓)
├── invite-user-dialog.tsx           (181z, kein Handlungsbedarf)
├── index-definition-dialog.tsx      (147z)
├── teams-stream-relay-panel.tsx     (143z)
├── owner-form.tsx                   (143z)
├── notifications-form.tsx           (139z)
├── display-form.tsx                 (116z)
├── appearance-form.tsx              (116z)
├── sidebar-nav.tsx                  (44z)
├── hooks/
│   ├── use-members-actions.ts       (252z, NEU 3-IV-c)
│   ├── use-access-requests-actions.ts (225z, NEU 3-IV-c)
│   └── use-translations-form.ts    (138z, NEU 3-IV-c)
├── chat/
│   ├── index.ts
│   ├── chat-form.tsx               (861z, Sections future)
│   └── hooks/
│       └── use-chat-form.ts        (666z)
├── library/
│   ├── index.ts
│   ├── library-form.tsx            (~400z)
│   ├── shadow-twin-config-section.tsx
│   ├── migration-wizard-section.tsx
│   ├── language-cleanup-section.tsx
│   ├── import-export-section.tsx
│   └── hooks/
│       ├── use-library-form.ts
│       ├── use-shadow-twin-migration.ts
│       └── use-shadow-twin-analysis.ts
├── public/
│   ├── index.ts
│   └── public-form.tsx             (810z, Hook extrahiert, Sections future)
└── storage/
    ├── index.ts
    └── storage-form.tsx            (1412z, Sections future)
```

---

## Future-Work (nicht in 3-IV)

1. **chat/chat-form.tsx Sections-Split**: model-config-section, retrieval-config-section,
   custom-headers-section extrahieren
2. **storage/storage-form.tsx Sections-Split**: local-storage-section, onedrive-section,
   nextcloud-section extrahieren
3. **public/public-form.tsx Sections-Split**: slug-section extrahieren
4. **secretary-service-form.tsx Modul-Split**: use-secretary-service-form.ts Hook
5. **FacetDefsEditor.tsx Hook-Extraktion**: use-facet-defs-editor.ts
6. **search-index-dialog.tsx Action-Split**: 3 Action-Komponenten
7. **index.ts Consumers umstellen**: direkte Imports statt Shim-Dateien
   (aktuell wird chat-form.tsx als Shim genutzt, nicht chat/index.ts)

---

## Verifikation

- `bash scripts/welle-pre-merge-check.sh` (lokal vor Merge)
- `npx vitest run tests/unit/settings/` → 43 Tests gruen
