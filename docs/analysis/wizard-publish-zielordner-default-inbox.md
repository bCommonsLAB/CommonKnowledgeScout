# Wizard-Publikation: Zielordner statt Root-Spam (Default `root/inbox`)

- **Status**: Analyse + Entscheidung (Richtung vom Owner bestätigt 2026-06-17)
- **Kontext**: Creation-Wizard / ADR-0004 (Inbox-/Submission-Modell), Welle 3-VI
- **Verwandt**: ADR-0004 (Capture-Publish-Entkopplung), ADR-0005 (ID-Stabilität),
  `storage-abstraction.mdc`, `no-silent-fallbacks.mdc`

## Problem (vom Owner beobachtet)

Beim Erfassen über den Wizard (Start aus der Galerie) landet die publizierte
`.md` im **Wurzelverzeichnis** der Ziel-Library. Es wurde nie ein Ziel gewählt →
der Root wird zugespammt.

## Befund (am Code verifiziert)

- Die Publikation schreibt nach `submission.target.folderId`
  (`src/lib/submissions/promotion.ts:85`); fehlt es, bricht sie hart ab
  (`PromotionTargetMissingError`).
- Der Wizard setzt `target.folderId = currentFolderId`
  (`src/components/creation-wizard/creation-wizard.tsx:2522–2524`, `:2541`).
  `currentFolderId = targetFolderIdProp || currentFolderIdAtom`
  (`:94`) — aus der Galerie ist das **`"root"`**.
- **Konsequenz:** Ohne explizite Ordnerwahl = Ablage im Root. Default-Bug, kein
  Feature.

### `fileId`-Stabilität pro Provider (entscheidend für die Lösung)

| Provider | ID-Ableitung | Move/Rename ändert ID? |
|---|---|---|
| Filesystem | `base64(relativer Pfad)` | **Ja** |
| Nextcloud (WebDAV) | `base64(relativer Pfad)` (`nextcloud-provider.ts:44–48`, `moveItem:318`) | **Ja** |
| OneDrive | Graph-Item-ID (`item.id`) | Nein (stabil) |

An `fileId` hängen RAG-Vektoren (`upsertMarkdown(..., savedItemId, ...)`,
Löschung je `fileId`) und Shadow-Twins/Item-Properties (stabiler `itemKey`,
ADR-0005). **Nachträgliches Verschieben** einer publizierten Datei bricht diese
Verknüpfungen bei Filesystem **und** Nextcloud → Waisen-Daten.

## Bewertete Varianten

### V1 — Serverseitiger Default-Ordner ohne Auswahl (Sofort-Linderung)
Fehlt `target.folderId`, legt die Promotion einen Default-Ordner `root/inbox`
**find-or-create** an (storage-agnostisch via `listItemsById` + `createFolder`)
und schreibt dort hinein.
- ➕ Minimal, behebt den Root-Spam sofort, keine UI nötig, keine `fileId`-Risiken.
- ➖ Owner kann das Ziel (noch) nicht selbst wählen.

### V2 — Zielordner-Auswahl vor dem Schreiben (gewählte Richtung)
Der Ablageort wird **bevor** die Datei ins Ziel geschrieben wird festgelegt:
- **Owner-Upload:** Ordner-Auswahl im Wizard (fliegender Picker, spiegelt die
  Library-Struktur via `provider.listItemsById`). Default: `root/inbox`.
- **Nicht-Owner:** läuft wie gehabt in die Quarantäne-Inbox (Azure Blob) →
  **Wartekorb**. Beim **Übernehmen durch den Owner** (Promotion aus dem
  Wartekorb) wählt der Owner den Zielordner. Default: `root/inbox`.
- **Settings:** Default-Ordner pro Library konfigurierbar (Fallback `root/inbox`).
- ➕ Kein nachträgliches Verschieben → **`fileId` bleibt stabil** (löst zugleich
  das Nextcloud-/Filesystem-ID-Problem, weil es gar nicht erst entsteht).
- ➖ Mehr Aufwand (Picker-Dialog, zwei Einstiegspunkte, Settings-Feld).

### V3 — In Root publizieren, später im Archiv verschieben — **VERWORFEN**
- ➖ `moveItem` ändert die `fileId` bei Filesystem/Nextcloud → bricht RAG +
  Shadow-Twins. Genau die Sorge des Owners; bestätigt. Nicht tragfähig.

## Entscheidung

**V2 ist das Ziel** (Auswahl vor dem Schreiben, Default `root/inbox`, in Settings
konfigurierbar). **V1 wird als erste Scheibe** umgesetzt, damit der Root-Spam
sofort aufhört, und ist zugleich der Default-Pfad von V2 (greift, wenn der Owner
keinen abweichenden Ordner wählt).

> Hinweis Begriffe: Die **Quarantäne-Inbox** (ADR-0004) ist der Off-Target-Blob-
> Wartekorb *vor* der Publikation. Der hier gemeinte **`inbox`-Ordner** ist ein
> ganz normaler Ablage-Ordner *in* der Ziel-Library *nach* der Publikation.
> Gleicher Name, verschiedene Ebenen — im Code klar trennen
> (`defaultPublishFolder`, Default-Wert `"inbox"`).

## Umsetzung in Scheiben (jede: `pnpm test` + `pnpm lint` grün, dann Owner testet)

1. **S1 — Default-Ordner serverseitig (V1).**
   - `creation-wizard.tsx`: aus der Galerie **kein** `root` mehr als
     `target.folderId` senden (leer lassen → explizit „kein Ordner gewählt“).
   - `promotion.ts`: bei fehlendem `folderId` → `root/inbox` find-or-create,
     dorthin schreiben. Provider-Slice um `createFolder` erweitern.
   - Unit-Tests: Promotion legt `inbox` an / nutzt vorhandenen / schreibt explizit
     gewähltes `folderId` unverändert.
2. **S2 — Settings: Default-Publish-Ordner pro Library** (Fallback `inbox`).
3. **S3 — Owner-Upload: Zielordner-Picker im Wizard** (fliegender Dialog,
   Default aus Settings). Reuse Library-File-Tree.
4. **S4 — Wartekorb-Übernahme: Zielordner-Picker bei der Promotion** (Owner wählt
   beim Publizieren einer Contributor-Submission).

## Offen / vor S3 klären
- Picker-Dialog: bestehende File-Tree-Komponente wiederverwendbar?
  (`components/library/file-tree.tsx` prüfen.)
- Ordner-Erzeugung über mehrere Ebenen (`root/inbox/…`) — vorerst nur eine Ebene.
