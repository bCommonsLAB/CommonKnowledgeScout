# Hot-Spot-Liste (Altlast-Pass): Welle 3-IV — Settings

Stand: 2026-05-02 (Cloud-Agent, Vorbereitungs-PR, Schritt 4 vorbereitet).

Diese Datei listet alle bekannten Altlasten in `src/components/settings/` auf,
kategorisiert nach den 8 Drift-Kategorien aus dem Refactor-Playbook. Die Fixes
werden in den Sub-Wellen 3-IV-a/b/c umgesetzt — **nicht** in der Vorbereitungs-PR.

---

## Kategorie 2 — Silent Fallbacks (9 leere `catch {}`)

### H1 — `library-form.tsx:17` — `useSafeUser`-Catch (stilles Fallback)

```tsx
function useSafeUser() {
  try {
    return useUser();
  } catch {
    return { user: null, isLoaded: true };  // ← stilles Fallback
  }
}
```

**Problem**: Der Catch fängt `useUser()`-Fehler (z.B. Clerk-Hook außerhalb
Provider) lautlos ab. Build-Zeit-Kommentar deutet auf einen Workaround hin.

**Fix-Vorschlag**:
1. `useSafeUser` in `src/hooks/use-safe-user.ts` extrahieren (Duplikat
   aus `public-form.tsx` lösen).
2. Im Catch mindestens `console.warn('Clerk useUser unavailable, using fallback')` loggen.
3. Oder prüfen, ob Clerk-Provider garantiert vorhanden — dann Catch weglassen.

**Sub-Welle**: 3-IV-a (im Zuge des `library-form`-Modul-Splits)

---

### H2 — `library-form.tsx:601` — Migration-Runs-Load-Fehler (stilles Reset)

```tsx
} catch {
  if (cancelled) return;
  setMigrationRuns([]);   // ← stilles Fallback: leere Liste
  setSelectedRunId(null);
}
```

**Problem**: API-Fehler beim Laden der Migration-Runs wird nicht geloggt und
nicht dem User angezeigt. Der User sieht eine leere Liste und weiß nicht warum.

**Fix-Vorschlag**: Fehlerzustand in State speichern + Toast/Alert anzeigen:
```tsx
} catch (err) {
  if (cancelled) return;
  console.error('[LibraryForm] Migration-Runs konnten nicht geladen werden:', err);
  setMigrationRuns([]);
  setSelectedRunId(null);
  // Optional: setMigrationRunsError('Laden fehlgeschlagen');
}
```

**Sub-Welle**: 3-IV-a

---

### H3 — `library-form.tsx:1530` — Base64-Dekodierungs-Catch (mit Kommentar)

```tsx
try {
  const decoded = atob(sourceId)
  if (decoded && decoded.includes('/') && !decoded.includes('..')) {
    return decoded.replace(/\\/g, '/')
  }
} catch {
  // Ignoriere Dekodierungsfehler    ← semantisch stilles Fallback
}
return ''
```

**Problem**: `atob`-Fehler bei ungültigem Base64 wird ignoriert. Das ist
defensiv gedacht, aber der Kommentar legt keine explizite Begründung fest.

**Fix-Vorschlag**: Logging hinzufügen (debug-Level) + Quelle benennen:
```tsx
} catch (err) {
  // atob kann bei ungültigem Base64 werfen — defensives Fallback, kein User-Impact
  console.debug('[LibraryForm] Base64-Dekodierung fehlgeschlagen für sourceId:', sourceId, err);
}
```

**Sub-Welle**: 3-IV-a

---

### H4 — `public-form.tsx:42` — `useSafeUser`-Catch (Duplikat aus H1)

Identisch mit H1 — selber Code, selbe Problematik.

**Fix-Vorschlag**: In `src/hooks/use-safe-user.ts` extrahieren (ein Commit
im `library-form`-Split erledigt dies für beide Dateien gleichzeitig).

**Sub-Welle**: 3-IV-a (zusammen mit H1)

---

### H5 — `public-form.tsx:192` — Slug-Check-Fehler (stilles Fallback)

```tsx
} catch {
  setSlugAvailable(null);   // ← stilles Reset des Slug-Check-Status
} finally {
  setIsCheckingSlug(false);
}
```

**Problem**: Wenn der Slug-Verfügbarkeits-Check fehlschlägt (Netzwerk, API),
wird `slugAvailable` auf `null` gesetzt — kein Error-State, kein Log.

**Fix-Vorschlag**:
```tsx
} catch (err) {
  console.error('[PublicForm] Slug-Check fehlgeschlagen:', err);
  setSlugAvailable(null);  // null = Unbekannt (kein grüner/roter Hinweis)
} finally {
  setIsCheckingSlug(false);
}
```

**Sub-Welle**: 3-IV-b (im `public-form`-Split)

---

### H6 — `public-form.tsx:363` — Clipboard-Copy-Catch (Browser-API-Fehler)

```tsx
} catch {
  toast({
    title: "Kopieren fehlgeschlagen",
    description: "Bitte kopieren Sie den Link manuell.",
  });
}
```

**Bewertung**: Dieser Catch ist **akzeptabel** — der User wird über den
Fehler informiert (Toast), und Clipboard-API-Fehler sind erwartbar
(z.B. fehlende Berechtigungen). **Kein Handlungsbedarf.**

---

### H7 — `chat-form.tsx:474` — JSON-Parse-Catch (Konfig-Feld)

```tsx
} catch {
  // JSON-Parse-Fehler ignorieren
}
```

**Problem**: Wenn ein Konfig-Feld (z.B. `customHeadersJson`) ungültiges JSON
enthält, wird dies still ignoriert. Der User sieht keine Fehlermeldung.

**Fix-Vorschlag**: Validierungsfehler in React-Hook-Form-State setzen:
```tsx
} catch (err) {
  // JSON ungültig — Validierungsfehler setzen
  console.debug('[ChatForm] JSON-Parse-Fehler:', err);
  form.setError('customHeaders', { message: 'Ungültiges JSON-Format' });
}
```

**Sub-Welle**: 3-IV-a (im `chat-form`-Split)

---

### H8 — `chat-form.tsx:539` — JSON-Parse-Catch (zweites Konfig-Feld)

Analog zu H7 — zweiter JSON-Parse-Catch für anderes Konfig-Feld.

**Fix**: Wie H7. **Sub-Welle**: 3-IV-a.

---

### H9 — `secretary-service-form.tsx:155` — Template-Load-Fehler (stilles Reset)

```tsx
} catch {
  if (!cancelled) setAvailableTemplateNames([])
} finally {
  if (!cancelled) setIsLoadingTemplates(false)
}
```

**Problem**: API-Fehler beim Laden der Template-Namen wird ignoriert.
Der User sieht eine leere Dropdown-Liste.

**Fix-Vorschlag**:
```tsx
} catch (err) {
  if (!cancelled) {
    console.error('[SecretaryServiceForm] Template-Namen konnten nicht geladen werden:', err);
    setAvailableTemplateNames([]);
  }
} finally {
  if (!cancelled) setIsLoadingTemplates(false);
}
```

**Sub-Welle**: 3-IV-b

---

## Kategorie 5 — Duplikate

### D1 — `useSafeUser` in `library-form.tsx` und `public-form.tsx`

**Befund**: Identische `useSafeUser`-Funktion (8 Zeilen) ist in beiden
Dateien kopiert. Verstößt gegen DRY-Prinzip.

**Fix**: Extrahieren in `src/hooks/use-safe-user.ts`:
```ts
// src/hooks/use-safe-user.ts
import { useUser } from "@clerk/nextjs";

/**
 * Build-Zeit-sicherer Wrapper für useUser.
 * Gibt { user: null, isLoaded: true } zurück, wenn Clerk-Provider nicht verfügbar.
 */
export function useSafeUser() {
  try {
    return useUser();
  } catch {
    // Clerk-Hook kann außerhalb des Providers werfen (z.B. Build-Zeit-Rendering)
    console.warn('[useSafeUser] Clerk useUser nicht verfügbar — Fallback aktiv');
    return { user: null, isLoaded: true };
  }
}
```

**Sub-Welle**: 3-IV-a (erster Commit, da beide großen Forms davon abhängen)

---

## Kategorie 7 — Dateien > 200 Zeilen (Modul-Split-Plan)

### M1 — `library-form.tsx` (2.233 Zeilen, 52 Hooks)

**Empfohlener Split** (nach fachlichen Verantwortlichkeiten):

```
src/components/settings/library/
├── index.ts                         (Re-Export)
├── library-form.tsx                 (Haupt-Render, ~400z)
├── shadow-twin-config-section.tsx   (Shadow-Twin-Flags + Primär-Store)
├── migration-wizard-section.tsx     (Dry-Run-Dialog + Migration-Runs-Liste)
├── language-cleanup-section.tsx     (Lang-Cleanup-Dialog)
├── import-export-section.tsx        (Import/Export-Dialog + Quellen-Tabelle)
└── hooks/
    ├── use-library-form.ts          (Form-State + defaultValues + dirty-Check)
    ├── use-shadow-twin-migration.ts (runShadowTwinMigration, runDirectionalSync)
    └── use-shadow-twin-analysis.ts  (runAnalysis, analysisReport)
```

Vorbild: Welle 3-II-a (`file-preview.tsx` → 9 View-Komponenten + Hooks)

**Sub-Welle**: 3-IV-a

---

### M2 — `chat-form.tsx` (1.518 Zeilen, 36 Hooks)

**Empfohlener Split**:

```
src/components/settings/chat/
├── index.ts
├── chat-form.tsx                    (Haupt-Render + Basis-Felder, ~350z)
├── model-config-section.tsx         (Modell-Wahl, Temperature, Max-Tokens)
├── retrieval-config-section.tsx     (RAG-Konfig, Chunk-Size, Overlap)
├── custom-headers-section.tsx       (JSON-Header-Editor + Validierung)
└── hooks/
    └── use-chat-form.ts             (Form-State, Watch-Values, Submit-Handler)
```

**Sub-Welle**: 3-IV-a

---

### M3 — `storage-form.tsx` (1.411 Zeilen, 27 Hooks)

**Empfohlener Split** (nach Storage-Typ):

```
src/components/settings/storage/
├── index.ts
├── storage-form.tsx                 (Haupt-Render + Typ-Auswahl, ~300z)
├── local-storage-section.tsx        (Pfad-Konfig für local)
├── onedrive-section.tsx             (OAuth + Drive-Auswahl für onedrive/gdrive)
├── nextcloud-section.tsx            (WebDAV-URL + Credentials für nextcloud)
└── hooks/
    └── use-storage-form.ts          (Form-State, Validierung, Submit-Handler)
```

**Hinweis**: `library.type`-Branches in `storage-form.tsx` sind laut
`storage-abstraction.mdc` **explizit erlaubt** für Settings-Formulare.
Der Split darf diese Branches behalten — sie werden nur in die jeweiligen
Section-Komponenten verschoben.

**Sub-Welle**: 3-IV-a

---

### M4 — `public-form.tsx` (810 Zeilen, 17 Hooks)

**Empfohlener Split**:

```
src/components/settings/public/
├── index.ts
├── public-form.tsx                  (Haupt-Render, ~200z)
├── slug-section.tsx                 (Slug-Editor + Verfügbarkeits-Check)
└── hooks/
    └── use-public-form.ts           (Form-State, Slug-Check, Submit)
```

**Sub-Welle**: 3-IV-b

---

### M5 — `secretary-service-form.tsx` (589 Zeilen, 13 Hooks)

**Empfohlener Split**:

```
src/components/settings/secretary-service/
├── index.ts
├── secretary-service-form.tsx       (Haupt-Render, ~200z)
└── hooks/
    └── use-secretary-service-form.ts (Template-Load, Form-State)
```

**Sub-Welle**: 3-IV-b

---

### M6 — `search-index-dialog.tsx` (556 Zeilen, `'use client'`)

**Empfohlener Split**: Einzelner Dialog mit 3 sichtbaren Aktionen
(Erstellen, Löschen, Rebuild). Kann in 3 kleinere Action-Komponenten + 1
Dialog-Shell aufgeteilt werden.

**Sub-Welle**: 3-IV-b

---

### M7 — `FacetDefsEditor.tsx` (471 Zeilen)

**Empfohlener Split**: JSON-Import/-Export-Logik in separaten Hook
`use-facet-defs-editor.ts` extrahieren. Rest ist Render-Logik.

**Sub-Welle**: 3-IV-b

---

### M8 — `members-list.tsx` (419 Zeilen) + M9 — `access-requests-list.tsx` (393 Zeilen)

**Empfohlener Split**: Beide haben ähnliche Struktur (Tabelle + Aktions-
Buttons + Dialogs). Helper `use-members-actions.ts` / `use-access-requests-actions.ts`
für die API-Call-Logik extrahieren.

**Sub-Welle**: 3-IV-c

---

### M10 — `translations-form.tsx` (228 Zeilen, `'use client'`)

Knapp über der 200-Zeilen-Grenze. Enthält komplexen State-Management
für ein Key-Value-Editor-Muster. Hook-Extraktion als `use-translations-form.ts`
reicht.

**Sub-Welle**: 3-IV-c

---

## Nicht-Hot-Spots (kein Handlungsbedarf)

| Datei | Begründung |
|---|---|
| `invite-user-dialog.tsx` (181z) | Unter DoD-Grenze, kein Catch, kein any |
| `index-definition-dialog.tsx` (147z) | Unter DoD-Grenze |
| `teams-stream-relay-panel.tsx` (143z) | Unter DoD-Grenze |
| `owner-form.tsx` (143z) | Unter DoD-Grenze |
| `notifications-form.tsx` (139z) | Unter DoD-Grenze |
| `display-form.tsx` (116z) | Unter DoD-Grenze |
| `appearance-form.tsx` (116z) | Unter DoD-Grenze |
| `sidebar-nav.tsx` (44z) | Unter DoD-Grenze |
| `public-form.tsx:363` (Clipboard-Catch) | Toast vorhanden — User informiert |
| `storage-form.tsx` (library.type-Branches) | Explizit erlaubt per Rule |

---

## Priorisierung für Sub-Welle 3-IV-a

1. **D1** — `useSafeUser` extrahieren (kleiner erster Commit, löst H1+H4)
2. **M1** — `library-form.tsx` Modul-Split + H2 + H3 fixen
3. **M2** — `chat-form.tsx` Modul-Split + H7 + H8 fixen
4. **M3** — `storage-form.tsx` Modul-Split

Commits jeweils unter 1.000z diff (hartes Limit aus `refactor-batch-strategy.mdc`).
