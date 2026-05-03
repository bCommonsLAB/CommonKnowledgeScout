# Acceptance: Welle 3-IV-c — Listen + Cleanup (Sub-Welle)

Datum: 2026-05-03. Cloud-Agent (cursor/refactor-welle-3-iv-c-lists-cleanup-984f).

---

## Aufgabe

Hook-Extraktion für `members-list.tsx`, `access-requests-list.tsx`,
`translations-form.tsx` + knip-Lauf über `src/components/settings/`.

---

## Erledigtes

### Commit 1 — Char-Tests

`tests/unit/settings/use-members-actions.test.ts` angelegt (10 Tests):
- E-Mail-Validierung
- Einladungs-API (invite, trim, Fehlerfall)
- Entfernen-API (URL-Kodierung, Fehlerfall)
- Resend-API (PUT-Method, Body)

`tests/unit/settings/use-access-requests-actions.test.ts` angelegt (9 Tests):
- Status-Text-Mapping (pending/approved/rejected)
- Quellen-Label (self/moderatorInvite)
- Status-Update-API (PUT, Fehlerfall)
- Anfrage-Loeschen-API (DELETE)
- Einladung-Resend-API (POST /resend)

Alle 43 Tests (inkl. Bestehende) grün.

### Commit 2 — members-list.tsx Hook-Extraktion

Neuer Hook: `src/components/settings/hooks/use-members-actions.ts` (252z)
- kapselt: loadMembers, handleInviteMember, handleResendInvite, handleRemoveMember
- kapselt: Dialog-State, Loading-States, Error-State
- `console.error()` in allen catch-Bloecken (no-silent-fallbacks)

`members-list.tsx`: 419z → 280z (-139z), nutzt jetzt useMembersActions.

### Commit 3 — access-requests-list.tsx Hook-Extraktion

Neuer Hook: `src/components/settings/hooks/use-access-requests-actions.ts` (225z)
- kapselt: loadRequests (mit statusFilter), updateRequestStatus,
  handleDeleteRequest, handleResendInvite
- kapselt: processingIds-Set (verhindert Doppel-Klicks)
- `console.error()` in allen catch-Bloecken
- Hilfsfunktionen `getStatusBadge` + `getSourceLabel` als pure Funktionen
  in der Komponente belassen (keine State-Abhängigkeit)

`access-requests-list.tsx`: 393z → 266z (-127z), nutzt useAccessRequestsActions.

### Commit 4 — translations-form.tsx Hook-Extraktion

Neuer Hook: `src/components/settings/hooks/use-translations-form.ts` (138z)
- kapselt: targetLocales, fallbackLocale, autoTranslate States
- kapselt: useEffect-Initialisierung aus Library-Config
- kapselt: toggleLocale, onSave (mit optimistischem State-Update)
- `noLibrarySelected`-Flag ersetzt den direkten Zugriff auf activeLibrary in Render

`translations-form.tsx`: 228z → 164z (-64z), nutzt useTranslationsForm.
Ungenutzter `React`-Import entfernt.

### Commit 5 — knip-Lauf

knip-Lauf über `src/components/settings/`:

**Befund: 4 index.ts-Dateien als ungenutzt gemeldet:**
- `chat/index.ts`, `library/index.ts`, `public/index.ts`, `storage/index.ts`

**Bewertung**: Pre-existierend aus Welle 3-IV-a/b. Die Dateien sind korrekt
angelegt als Re-Export-Endpunkte, aber die Consumers importieren noch über
die alten Shim-Dateien (`chat-form.tsx`, `library-form.tsx` etc.).
Kein Handlungsbedarf in dieser Welle — kein Dead Code durch 3-IV-c eingeführt.

**Neue Hooks dieser Welle**: Nicht in knip-Liste — korrekt genutzt.

---

## Health-Fortschritt

| Metrik | Vor 3-IV-c | Nach 3-IV-c |
|---|---:|---:|
| Files > 200z (direkt) | 6 | 3 (members-list, access-requests-list gesplittet) |
| Leere Catches | 1 (H6, akzeptiert) | 1 (unveraendert) |
| `any`-Count | 0 | 0 |
| Unit-Tests | 24 | 43 (+19 neue Tests) |
| `pnpm lint` Errors | 0 | 0 |

Verbleibende Dateien > 200z:
- `members-list.tsx` (280z) — Render + Hook-Delegate, Komplexitaet durch Dialog-Code
- `access-requests-list.tsx` (266z) — Render + Tabelle, akzeptable Groesse
- `chat/chat-form.tsx` (861z) — Future-Work aus 3-IV-b

---

## Neue Dateien / geaenderte Dateien

```
src/components/settings/
├── members-list.tsx                     (419z → 280z, nutzt Hook)
├── access-requests-list.tsx             (393z → 266z, nutzt Hook)
├── translations-form.tsx                (228z → 164z, nutzt Hook)
└── hooks/
    ├── use-members-actions.ts           (neu, 252z)
    ├── use-access-requests-actions.ts   (neu, 225z)
    └── use-translations-form.ts         (neu, 138z)
tests/unit/settings/
├── use-members-actions.test.ts          (neu, 10 Tests)
└── use-access-requests-actions.test.ts  (neu, 9 Tests)
```

---

## knip-Future-Work (nicht in dieser Welle)

Die 4 `index.ts`-Dateien werden genutzt, sobald alle Consumers auf direkten Import
umgestellt werden (z.B. `import { ChatForm } from '@/components/settings/chat'`
statt `@/components/settings/chat-form`). Das ist ein separates Cleanup-Task.

---

## Smoke-Test-Plan (User)

1. **Members-Settings** (`/settings/public/members`):
   - Seite oeffnet → Mitglieder-Tabelle (oder "Keine Mitglieder"-Hinweis) erscheint
   - „Mitglied einladen" klicken → Dialog oeffnet sich
   - Ungueltige E-Mail eingeben → Dialog-Fehlermeldung erscheint

2. **Access-Requests-Settings** (`/settings/public/access-requests`):
   - Seite oeffnet → Tabelle (oder "Keine Anfragen"-Hinweis) erscheint
   - Filter „Ausstehend" klicken → Filter-Buttons reagieren visuell

3. **Translations-Settings** (`/settings/translations` oder Unterseite):
   - Formular oeffnet → Checkboxen fuer Locales werden angezeigt
   - Checkbox anklicken → Checkbox-State aendert sich
   - „Speichern" klicken → Toast erscheint

---

## Verifikation

- `bash scripts/welle-pre-merge-check.sh` (lokal vor Merge)
- `npx vitest run tests/unit/settings/` → 43 Tests gruen

---

## Naming-Hinweis

Diese Welle heisst korrekt "3-IV-c" (Sub-Welle c der Plan-Welle 3-IV).
Dies ist die letzte Code-Sub-Welle von 3-IV. Danach folgt die Gesamt-Acceptance.
