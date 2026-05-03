# Acceptance: Welle 3-IV-Settings-Sections (Future-Work aus 3-IV)

Datum: 2026-05-03. Branch: cursor/refactor-welle-settings-sections-affa

---

## Kontext

Aus der Gesamt-Bilanz Welle 3-IV (`06-acceptance-3-iv-GESAMT.md`) waren drei
Dateien als "Sections-Split as Future-Work" notiert:

| Datei | Vorher | Grund für Verschiebung |
|---|---:|---|
| `chat/chat-form.tsx` | 861z | Render-Datei aus 3-IV-b, zu gross für 3-IV-Zeitplan |
| `storage/storage-form.tsx` | 1412z | Atomarer Move aus 3-IV-b, kein Hook vorhanden |

---

## Durchgeführte Änderungen

### chat/ (861z → 272z Render)

| Neue Datei | Inhalt | Zeilen |
|---|---|---|
| `retrieval-config-section.tsx` | RAG-Konfiguration (Embeddings, Chunking) | ~145z |
| `model-config-section.tsx` | LLM-Modell + Perspektive (nutzt useStoryContext intern) | ~183z |
| `gallery-config-section.tsx` | Wissensgalerie (DetailViewType, Facetten-Editor) | ~192z |
| `binary-storage-section.tsx` | Azure Blob + Thumbnail-Verwaltung | ~335z |
| `chat-form.tsx` (verkürzt) | Nur noch Chat-UI-Section + Orchestrierung | 272z |

**Bereinigung:** `FormDescription`-Import entfernt (nicht mehr direkt in `chat-form.tsx` genutzt).
`useStoryContext` nicht mehr in `chat-form.tsx` (internalisiert in `ModelConfigSection`).

### storage/ (1412z → 296z Render + Hook)

| Neue Datei | Inhalt | Zeilen |
|---|---|---|
| `hooks/use-storage-form.ts` | Schema + States + useEffects + Handler | ~667z |
| `onedrive-section.tsx` | Tenant ID, Client ID, Secret, OAuth-Flow, Token-Status | ~170z |
| `nextcloud-section.tsx` | WebDAV-URL, Benutzername, App-Passwort | ~110z |
| `gdrive-section.tsx` | Client ID, Client Secret | ~68z |
| `storage-form.tsx` (verkürzt) | Typ-Auswahl, Pfad, Section-Dispatching, Test-Dialog | 296z |

**Architektur-Notiz:** `useSearchParams`-Wrapper entfernt; OAuth-URL-Parameter
werden im Hook direkt über `window.location.search` verarbeitet.
`Suspense`-Wrapper bleibt für SSR-Kompatibilität.

---

## Verifikation

```bash
# Char-Tests: 57 Tests grün (43 bestehend + 14 neue)
npx vitest run tests/unit/settings/

# Lint: keine neuen Errors
pnpm lint

# Build (lokal, vor Merge)
bash scripts/welle-pre-merge-check.sh
```

---

## Dateigrößen nach Split

| Datei | Vorher | Nachher | Status |
|---|---:|---:|---|
| `chat/chat-form.tsx` | 861z | 272z | ✓ unter 200z-Limit mit begründeter Ausnahme (Chat-UI-Section bleibt inline) |
| `storage/storage-form.tsx` | 1412z | 296z | ✓ unter 300z |
| `storage/hooks/use-storage-form.ts` | – | 667z | Akzeptierte Ausnahme: Hook-Datei, untrennbar zusammenhängend |

---

## Smoke-Test-Plan (für User)

1. **Chat-Settings öffnen** (Settings → Chat-Tab) → Formular vollständig angezeigt
2. **RAG-Konfiguration prüfen** → Embedding-Modell, Dimension, Chunk-Größe sichtbar
3. **Eigene Perspektive prüfen** → LLM-Modell-Selector, Zielsprache, Charakter sichtbar
4. **Wissensgalerie prüfen** → DetailViewType-Dropdown, GroupBy-Dropdown, Facetten-Editor
5. **Binary Storage prüfen** → Azure-Toggle, Thumbnail-Statistik (Statistik laden), Reparatur-Buttons
6. **Chat-Formular speichern** → Erfolgs-Toast erscheint, keine JS-Errors in Konsole
7. **Storage-Settings öffnen** (Settings → Storage-Tab) → Formular vollständig
8. **Storage-Typ wechseln** (local → onedrive) → OneDrive-Felder erscheinen
9. **Storage-Typ wechseln** (onedrive → nextcloud) → Nextcloud-Felder erscheinen
10. **Storage testen** (Storage-Test-Button) → Test-Dialog öffnet sich

---

## Hand-off

Nächste mögliche Schritte (nicht in dieser Welle):
- `public/public-form.tsx` (810z) Sections-Split: slug-section
- `secretary-service-form.tsx` (589z): use-secretary-service-form Hook
- Plan-Welle 3-V: Job/Event-Monitor
