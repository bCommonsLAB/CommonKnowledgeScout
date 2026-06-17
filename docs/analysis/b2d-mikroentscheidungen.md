# B2d (V2) — Mikro-Entscheidungen vor der Umsetzung

Status: entschieden — Datum 2026-06-17
Bezug: `docs/wizards/b2d-assets-mirror-handover.md` §4,
`docs/analysis/wizard-transcript-only-assets-mirror.md` §6

Kurzklaerung der vier offenen Punkte vor dem Coden. Befunde aus dem Code,
nicht geraten.

## 1. Fragment-API des `ShadowTwinService`

Verwendet wird `ShadowTwinService.uploadBinaryFragment({ buffer, fileName,
mimeType, kind })` (`src/lib/shadow-twin/store/shadow-twin-service.ts`).

- Bytes werden als `Buffer` uebergeben.
- Der Service entscheidet FS vs. Mongo an EINER Stelle: Mongo-Ziel → Azure-Upload
  + Mongo-Fragment (hash-dedupliziert), FS-Ziel → Upload in den Ziel-Dot-Folder.
- `kind` wird aus dem Mimetype abgeleitet (`image`/`audio`/`video`).
- `variant` bleibt bewusst leer: die Assets sind Seiten-/Embedded-Bilder, die das
  Transkript ueber relative Namen referenziert — keine Galerie-Cover. (Cover-
  Logik nutzt `variant`/Thumbnails separat.)

## 2. Asset-Enumeration — Variante (a), ordner-basiert

Quelle der Liste ist der **Inbox-Shadow-Twin-Ordner** der Quell-PDF, gefunden via
`findShadowTwinFolder(source.parentId, sourceName, inboxProvider)`
(`src/lib/storage/shadow-twin.ts`). Gefiltert wird auf Medien-Dateien
(Mimetype `image|audio|video`, Extension-Fallback fuer Bilder); das Transkript-
Markdown und sonstige Nicht-Medien werden uebersprungen.

Begruendung: job-unabhaengig, konsistent mit der Shadow-Twin-Logik, KEINE neue
Repo-Query („Job per submissionId") noetig. Fehlt der Ordner (PDF ohne Bilder),
ist das ein legitimer Leerzustand → leere Liste, kein Fehler (kein stiller
Fallback: es wurde schlicht nichts extrahiert).

## 3. Bildlink-Normalisierung — NICHT noetig (B2d-3 entfaellt)

Der Extract referenziert Bilder ueber relative Datei-Namen (z.B. `img-0.jpeg`,
`page_NNN.png`). Beim Spiegeln bleiben die Namen identisch. Der Renderer loest
relative Namen ueber `resolveBinaryFragmentUrl` / `findShadowTwinImage`
(Match per Name bzw. Hash, `matchBinaryFragmentByLookupName`) gegen den Ziel-
Shadow-Twin auf. Da die Namen erhalten bleiben, loesen die Links im Ziel auf —
eine Umschreibung im Transkript ist nicht erforderlich.

## 4. Idempotenz

Re-Promote darf keine Fragmente duplizieren. Vor dem Upload werden bereits im
Ziel vorhandene Asset-Namen gesammelt und uebersprungen — aus ZWEI Quellen:

- `targetService.getBinaryFragments()` (Mongo-Ziel: zentrale Fragment-Liste).
- Datei-Liste des Ziel-Shadow-Twin-Ordners ueber `findShadowTwinFolder` am
  Ziel-Provider — noetig, weil `ProviderShadowTwinStore.getBinaryFragments`
  fuer FS-Ziele `null` liefert (keine zentrale Liste).

Zusaetzlich dedupliziert der Mongo-Pfad bereits per Bild-Hash
(`getImageUrlByHashWithScope`) und `upsertShadowTwinBinaryFragment` ist ein
Upsert — doppelte Absicherung.

## Schnitt (unveraendert)

- B2d-1: Asset-Enumeration im Inbox-Shadow-Twin (ordner-basiert) + Tests.
- B2d-2: Spiegeln ueber `ShadowTwinService` (Ziel) inkl. FS/Mongo + Idempotenz;
  injizierte `mirrorAssets`-Funktion, `promotion.ts` bleibt storage-agnostisch.
- B2d-3: entfaellt (siehe Punkt 3).
</content>
</invoke>
