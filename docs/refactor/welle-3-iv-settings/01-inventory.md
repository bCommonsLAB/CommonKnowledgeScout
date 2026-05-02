# Inventur: Welle 3-IV — Settings

Stand: 2026-05-02 (Cloud-Agent, Vorbereitungs-PR, Schritt 1).
Methode: `wc -l`, `grep`-Counts (Hooks, leere Catches, `any`, `'use client'`).

## Scope

- `src/components/settings/` — 18 Dateien, **9.657 Zeilen gesamt**
- `src/app/settings/` — 14 Dateien, **~756 Zeilen gesamt** (App-Router-Routen)
- Keine Backend-Dateien im Scope (Settings-API-Routen sind separat; tangieren
  aber `storage-contracts.mdc`, `shadow-twin-contracts.mdc` etc.)

---

## A. Komponenten — `src/components/settings/`

| Datei | Zeilen | Hooks | Leere Catches | `any` | `'use client'` | Test? | DoD |
|---|---:|---:|---:|---:|---:|---:|---|
| `library-form.tsx` | **2.233** | **52** | 3 | 0 | nein | nein | ❌ >200z, Catches |
| `chat-form.tsx` | **1.518** | **36** | 2 | 0 | nein | nein | ❌ >200z, Catches |
| `storage-form.tsx` | **1.411** | **27** | 0 | 0 | nein | nein | ❌ >200z |
| `public-form.tsx` | **810** | 17 | 3 | 0 | nein | nein | ❌ >200z, Catches |
| `secretary-service-form.tsx` | **589** | 13 | 1 | 0 | nein | nein | ❌ >200z, Catches |
| `search-index-dialog.tsx` | **556** | 9 | 0 | 0 | ja | nein | ❌ >200z |
| `FacetDefsEditor.tsx` | **471** | 10 | 0 | 0 | nein | nein | ❌ >200z |
| `members-list.tsx` | **419** | 14 | 0 | 0 | nein | nein | ❌ >200z |
| `access-requests-list.tsx` | **393** | 9 | 0 | 0 | nein | nein | ❌ >200z |
| `translations-form.tsx` | **228** | 11 | 0 | 0 | ja | nein | ❌ >200z |
| `invite-user-dialog.tsx` | 181 | 7 | 0 | 0 | nein | nein | ✅ |
| `index-definition-dialog.tsx` | 147 | 4 | 0 | 0 | ja | nein | ✅ |
| `teams-stream-relay-panel.tsx` | 143 | 13 | 0 | 0 | ja | nein | ✅ |
| `owner-form.tsx` | 143 | 3 | 0 | 0 | nein | nein | ✅ |
| `notifications-form.tsx` | 139 | 2 | 0 | 0 | nein | nein | ✅ |
| `display-form.tsx` | 116 | 2 | 0 | 0 | nein | nein | ✅ |
| `appearance-form.tsx` | 116 | 2 | 0 | 0 | nein | nein | ✅ |
| `sidebar-nav.tsx` | 44 | 1 | 0 | 0 | nein | nein | ✅ |
| **Gesamt** | **9.657** | **222** | **9** | **0** | **4** | **0** | **9 von 18 ❌** |

**Legende**: DoD = Definition of Done (alle Files <200z, 0 leere Catches, 0 `any`)

---

## B. App-Router-Routen — `src/app/settings/`

| Datei | Zeilen | `'use client'` | Test? |
|---|---:|---:|---|
| `settings-client.tsx` | 136 | nein | nein |
| `layout.tsx` | 98 | nein | nein |
| `public/members/page.tsx` | 138 | nein | nein |
| `public/access-requests/page.tsx` | 128 | nein | nein |
| `public/page.tsx` | 52 | nein | nein |
| `page.tsx` | 41 | nein | nein |
| `chat/page.tsx` | 32 | nein | nein |
| `secretary-service/page.tsx` | 28 | nein | nein |
| `storage/page.tsx` | 23 | nein | nein |
| `appearance/page.tsx` | 16 | nein | nein |
| `display/page.tsx` | 16 | nein | nein |
| `library/page.tsx` | 16 | nein | nein |
| `notifications/page.tsx` | 16 | nein | nein |
| `owner/page.tsx` | 16 | nein | nein |
| **Gesamt** | **~756** | **0** | **0** |

Die App-Routen sind durchgehend dünne Server-Komponenten (<200z, kein
`'use client'`). Sie delegieren die Render-Logik an die Komponenten in
`src/components/settings/`. Kein direkter Handlungsbedarf im Altlast-Pass.

---

## C. Drift-Zusammenfassung (8 Kategorien)

| Kategorie | Befund | Dateien | Aktion |
|---|---|---|---|
| (1) Fehlende Tests | 0 Unit-Tests für 18 Komponenten | alle | Char-Tests für Helper in Schritt 3 |
| (2) Silent Fallbacks | 9 leere `catch {}` in 5 Dateien | library-form, chat-form, public-form, secretary-service-form | Fix in Schritt 4 |
| (3) UI/Storage-Branches | `library.type`-Branches in `storage-form.tsx` — **ERLAUBT** laut Rule | storage-form | kein Handlungsbedarf |
| (4) `any`-Drift | 0 `any` gefunden | — | ✅ sauber |
| (5) Duplikate | `useSafeUser`-Wrapper in `library-form.tsx:1-20` und `public-form.tsx:35-45` identisch | library-form, public-form | Extract in `src/hooks/use-safe-user.ts` in Schritt 4 |
| (6) Toter Code | Nicht geprüft (knip-Lauf nötig) | — | in Schritt 6 |
| (7) Datei >200z | 9 Dateien | siehe Tabelle A | Modul-Split in Sub-Wellen 3-IV-a, 3-IV-b |
| (8) Unnötiges `'use client'` | 4 Dateien haben `'use client'` — alle sachlich begründet (Event-Handler) | search-index-dialog, translations-form, index-definition-dialog, teams-stream-relay-panel | kein Handlungsbedarf |

---

## D. Sub-Wellen-Vorschlag

Basierend auf Zeilenzahl und Fachlichkeit:

| Sub-Welle | Scope | Hauptdateien | Erwarteter Diff |
|---|---|---|---|
| **3-IV-a** | Große Forms (Modul-Split) | `library-form.tsx`, `chat-form.tsx`, `storage-form.tsx` | ~−3.500z + neue Sub-Module |
| **3-IV-b** | Mittlere Forms + Dialogs | `public-form.tsx`, `secretary-service-form.tsx`, `FacetDefsEditor.tsx`, `search-index-dialog.tsx` | ~−1.500z + neue Sub-Module |
| **3-IV-c** | Kleines Cleanup | `members-list.tsx`, `access-requests-list.tsx`, `translations-form.tsx` | ~−400z + Extraktion |

Altlast-Pass (Catches, `useSafeUser`-Duplikat) gehört in die jeweilige
Sub-Welle, nicht als eigene PR.

---

## E. Abhängigkeiten (andere Wellen)

- `library-form.tsx` nutzt Shadow-Twin-API → tangiert `shadow-twin-contracts.mdc`
- `chat-form.tsx` nutzt Chat-Konfig-API → tangiert `chat-contracts.mdc`
- `storage-form.tsx` nutzt Storage-Provider-Konfig → tangiert `storage-contracts.mdc`
- `secretary-service-form.tsx` → tangiert `secretary-contracts.mdc`

Alle Backend-APIs bleiben stabil; Settings-Modul-Split ist rein UI-seitig.
