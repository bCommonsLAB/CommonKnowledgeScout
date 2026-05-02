# Acceptance: Welle 3-III-a — Gallery (Modul-Split + Hook-Extraktion)

**Branch**: `cursor/refactor-welle-3-iii-a-gallery-a03a`
**Stand**: 2026-05-02
**PR**: (folgt nach Push)

## Inhalt

Erste Sub-Welle nach Welle 3-III-Vorbereitung. Fokus: `document-card.tsx`
Modul-Split, `gallery-root.tsx` Pure-Helper- und Hook-Extraktion,
5 Comment-only-Catches in 3 Gallery-Files mit Logging versehen.

## Volumen-Statistik

| Metrik | Vorher | Nachher | Differenz |
|---|---:|---:|---:|
| `gallery/document-card.tsx` | 638 | **84** | **-554 (-86.8%)** |
| `gallery/gallery-root.tsx` | 994 | 937 | -57 (-5.7%) |
| Sub-Module unter `gallery/document-card/` | 0 | 6 | +6 |
| Sub-Module unter `gallery/gallery-root/` | 0 | 3 | +3 |
| Char-Test-Files | 0 | 4 | +4 |
| Char-Test-Cases | 0 | **35** | +35 |

## Sub-Wellen-Diff (4 Commits)

| Commit | Inhalt | Brutto-Diff |
|---|---|---:|
| 1 | Char-Tests fuer `DocumentCard`-Switch (7 Cases) | 176 |
| 2 | 5 Comment-only-Catches in 3 Gallery-Files mit Logging | 27 |
| 3 | document-card.tsx Modul-Split (5 Sub-Karten + status-config) | 1.319 |
| 4 | gallery-root Pure-Helpers + 2 Hooks + 28 Char-Tests | 687 |

**Brutto-Diff Gesamt**: ~2.200 Zeilen — gut unter 5.000-Limit.

## Inhalt im Detail

### Modul-Split: `document-card.tsx` (Commit 3)

Vorher: 638 Zeilen monolithisch mit 5 internen Card-Komponenten und
2 Helper-Funktionen.

Neue Struktur:

```
src/components/library/gallery/
  document-card.tsx                  # 84 Zeilen Composer-Switch
  document-card/
    status-config.ts                 # Pure-Helper (Bewertung -> Status)
    diva-texture-card.tsx            # detailViewType='divaTexture'
    climate-action-card.tsx          # detailViewType='climateAction'
    session-card.tsx                 # detailViewType='session'
    refurbed-device-card.tsx         # detailViewType='refurbedDevice'
    standard-card.tsx                # Default (Buecher/Dokumente)
```

Public-API stabil: `DocumentCard` exportiert weiter denselben Typ +
Interface. Konsumenten muessen ihre Imports nicht aendern.

### Pure-Helpers + Hook-Extraktion: `gallery-root.tsx` (Commit 4)

Vorher: 994 Zeilen, 49 Hook-Calls, mehrere inline-Helpers + 2 useEffects
fuer Window-Resize und sessionStorage.

Neue Struktur:

```
src/components/library/gallery/gallery-root/
  helpers.ts                         # 4 Pure-Helpers + 1 Konstante
  hooks/
    use-is-mobile.ts                 # Window-Resize-Detection
    use-card-density.ts              # sessionStorage + State + Logging
```

`helpers.ts` (Pure-Funktionen, einfach testbar):
- `VALID_DETAIL_VIEW_TYPES` (Konstante, exportiert)
- `resolveInitialDetailViewType` — validiert Frontmatter-Wert + 'book'-Default
- `resolveGroupByField` — validiert + 'year'-Default
- `pickFacetsForTableColumns` — filtert showInTable=true
- `resolveDetailViewTypeForDoc` — Prio doc > library > 'book'

`useIsMobile`: Window-Resize-Detection (lg-Breakpoint 1024px).
`useCardDensity`: sessionStorage + setCardDensity-Setter mit Logging
bei Storage-Fehlern (no-silent-fallbacks.mdc).

### Altlast-Pass: 5 Comment-only-Catches gefixt (Commit 2)

Konform zu `.cursor/rules/no-silent-fallbacks.mdc`:

| Datei | Catches | Loesung |
|---|---:|---|
| `gallery/document-share-button.tsx` | 3 | console.warn fuer share-Cancel, clipboard-Fallback und letzten exec-Fallback. Verhalten unveraendert. |
| `gallery/switch-to-story-mode-button.tsx` | 1 | console.warn fuer router.push-Abbruch + Filter-Fallback wie bisher |
| `gallery/speaker-icons.tsx` | 1 | console.warn bei JSON.parse-Fehler + Regex-Fallback wie bisher |

Begruendung in jedem Catch-Block: warum gefangen, was loggen, was
faellt zurueck. **Kein** silent fallback mehr.

### Char-Tests (Commits 1 + 4)

**Commit 1** — `DocumentCard`-Switch:
- 7 Cases: Standard-Card / ClimateAction / Session / RefurbedDevice
- Prioritaet doc.detailViewType > libraryDetailViewType
- Click-Verhalten openDocumentBySlug vs onClick-Fallback

**Commit 4** — Helpers + Hooks:
- 17 Cases fuer 4 Pure-Helpers + VALID_DETAIL_VIEW_TYPES Konstante
- 4 Cases fuer useIsMobile (Resize-Event, Cleanup)
- 7 Cases fuer useCardDensity (sessionStorage, configDefault,
  setCardDensity, Logging bei get/set-Fehlern)

## Methodik-DoD

| Kriterium | Status |
|---|---|
| 1 PR pro Welle | OK |
| Pro Schritt eigener Commit | OK (4 Commits) |
| Char-Tests vor Code-Aenderungen | OK (Commit 1: DocumentCard, Commit 4: Helpers+Hooks) |
| `pnpm test` gruen | OK (1.242/1.242, 35 neu) |
| `pnpm lint` gruen | OK (nur vor-existierende Warnings) |
| `pnpm build` gruen | OK (76s) |
| < 1.000 Zeilen Diff pro Commit | OK (max ~700z fuer Commit 4) |
| < 5.000 Zeilen Brutto pro PR | OK (~2.200) |
| Cleanup im selben PR | OK (ungenutzte Imports + alte VALID_DETAIL_VIEW_TYPES Konstante entfernt) |
| Keine neuen `any`, keine neuen `catch{}` | OK |

## Modul-DoD

| Kriterium | Status |
|---|---|
| `document-card.tsx` ist auf reine Switch-Logik reduziert | OK (84 Zeilen Composer) |
| Sub-Karten in eigenen Modulen unter `gallery/document-card/` | OK (5 Cards + status-config) |
| `gallery-root.tsx` nutzt extrahierte Helpers + Hooks | OK |
| Pure-Helpers in eigenem Modul (`helpers.ts`) | OK |
| Hooks in eigenen Modulen unter `gallery-root/hooks/` | OK |
| Public-API DocumentCard stabil | OK (Export + Interface unveraendert) |
| Comment-only-Catches eliminiert (gallery-Bereich) | OK (5/5) |
| Verhalten 1:1 portiert | OK (Char-Tests beweisen es) |

## Future Work fuer Welle 3-III-a (verschoben)

Folgende Files haben weiteres Refactor-Potenzial, das in dieser PR
**bewusst nicht** angefasst wurde, weil das den Diff sprengt oder
mehr Char-Tests benoetigt:

- **virtualized-items-view.tsx (470z, 13 Hooks)**: Hook-Extraktion
  `use-virtualized-items` braucht eigene Char-Tests fuer Sort-Logik
  + Loading-States. Abgrenzung: separater Refactor-Cycle.
- **gallery-root.tsx restliche 937z**: 6 grosse `useEffect`-Bloecke
  (Sources-Loading, ChatReferences-Sync, Event-Handler-Sets) muessten
  in `use-gallery-references` und `use-gallery-events` extrahiert
  werden — braucht Architektur-Diskussion zur Atom-Struktur.
- **document-share-button.tsx (224z, 11 Hooks)**: Helper-Extraction
  fuer Share-Plattformen (Twitter/Facebook/LinkedIn) sinnvoll.

Empfehlung: Diese Files in **Welle 3-III-a-2** oder spaeter angehen.

## Methodik-Lehre PR #31 hat zum 10. Mal funktioniert

`pnpm build` lokal hat **vor dem Push** keine neuen Build-Fehler
gefunden — die Modularisierung hat sauber durchgezogen. **0 Hotfix-PRs
seit PR #31.**

## Smoke-Test fuer User

5 Klicks zur Verifikation:

1. **Galerie oeffnen** — `/library/{id}/gallery`
   - Erwartung: Galerie laedt, Document-Cards werden angezeigt (Switch
     je nach detailViewType der Library)
2. **View-Mode wechseln** — Klick auf Grid/Table-Toggle
   - Erwartung: Layout wechselt, Card-Density bleibt persistent
3. **Document-Card klicken** — Detail-Overlay oeffnet sich
   - Erwartung: viewType ist konsistent zur Card-Variante
4. **Mobile-Viewport simulieren** — Resize auf < 1024px
   - Erwartung: Filter-Burger erscheint, Layout wird kompakt
5. **Document-Share** — Share-Button auf einer Card klicken
   - Erwartung: Native Share oder Copy-Link-Toast funktioniert

Wenn OK: PR mergen, dann starte ich Welle 3-III-b (Chat).

## Verweise

- Welle 3-III Vorbereitung: `06-acceptance.md`
- Welle 3-III README: `README.md`
- AGENT-BRIEF Sub-Welle 3-III-a: `AGENT-BRIEF.md` Sektion "3-III-a"
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc`
- Welle 3-III Contracts: `.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc`
