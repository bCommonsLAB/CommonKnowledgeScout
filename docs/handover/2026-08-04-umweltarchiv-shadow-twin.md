# Hand-off: Umweltarchiv-Sanierung & Shadow-Twin-Cleanup

**Datum:** 2026-08-04
**Worktree:** `.claude/worktrees/vigilant-heisenberg-f6ab76`
**Branches:** `claude/doctor-command-7a19de` (PR #142, gepusht) ·
`claude/shadow-twin-legacy-cleanup` (10 Commits, **nicht gepusht**)

---

## 1. Wie die Session verlief (Absicht)

Start war ein `/doctor`-Lauf (Aufräumen des immer geladenen Kontexts). Daraus
wurde eine Arbeit am **öffentlichen Auftritt** von Libraries und schliesslich
eine **Sanierung des Umweltarchivs**. Roter Faden: Alles, was pro Library
unterschiedlich sein muss, gehört in die Library-Config — nicht in globale
Übersetzungs-Strings oder hart kodierte Annahmen.

Reihenfolge der Themen:

1. Doctor-Aufräumen (Regel-Dateien gekürzt, Spiegel-Skript generisch, Skill)
2. Website-Logo + Hintergrundbild für Oldiesforfuture (Blob-Upload)
3. Galerie-Texte pro Library — dabei **echten Bug gefunden** (siehe §3)
4. Benennung pro Library (`menuLabel`, `moreLinkLabel`)
5. Bild-Upload direkt im Config-Bereich (statt Skript + URL kopieren)
6. UX: Library-Wechsel öffnet Erkunden statt Archiv
7. Diagnose Umweltarchiv (908 Dokumente „reparaturbedürftig")
8. Neues Analyse-Template + Shadow-Twin-Ordner-Normalisierung

---

## 2. Was fertig ist

### Code (beide Branches, alles committet)

| Bereich | Zustand |
|---|---|
| PR #142 (`claude/doctor-command-7a19de`) | offen, 5 Commits, gepusht |
| `claude/shadow-twin-legacy-cleanup` | 10 Commits (enthält die 5 aus #142), **lokal** |

### Daten (Prod, `common-knowledge-scout-prod`)

- **Umweltarchiv** (`a5341586-3124-4b80-a4da-6022f2902910`):
  - 956 Twin-Ordner von `.` auf `_` umbenannt (0 Fehler)
  - 206 veraltete Duplikat-Artefakte gelöscht, 5 in den Twin-Ordner verschoben
  - 1 Datei bewusst liegen gelassen (verirrte Fassung war **neuer**):
    `Berichte Landesämter/Bevölk.Schutz/StafflerEtAl_2008_…_p .md`
  - `detailViewType` steht auf `book` (vom User umgestellt)
- **Template** produktiv: `Umweltarchiv/templates/pdfanalyse.md` (neu),
  Alt-Fassung als `pdfanalyse.v1-backup-2026-08-03.md` daneben.
  Repo-Kopie: `template-samples/pdfanalyse-umweltarchiv.md`
- **Oldiesforfuture**: Logo, Hintergrundbild, Galerie-Texte, „Unsere Aktionen"

---

## 3. Gefundene Probleme (Befunde, keine Vermutungen)

### 3.1 Galerie-Texte wurden nie angezeigt — BEHOBEN
Die vier Texte aus Settings → Veröffentlichung wurden gespeichert, aber
`useGalleryConfig` nahm ausschliesslich Übersetzungs-Defaults, und die beiden
Explore-APIs lieferten das `gallery`-Objekt gar nicht aus.

### 3.2 Artefakte landeten neben der Quelldatei — BEHOBEN
`src/lib/external-jobs/storage.ts`: Bei bekanntem `shadowTwinFolderId` wurde
`createFolder=false` gesetzt, aber weiterhin der Quell-Ordner als `parentId`
übergeben. `writeArtifactV2` wertet `createFolder=false` als „Sibling
schreiben" — ein *bekannter* Twin-Ordner führte also dazu, dass NICHT
hineingeschrieben wurde.

### 3.3 Umweltarchiv: 908 Dokumente reparaturbedürftig — TEILS BEHOBEN
Prüfbericht: 3.605 Befunde, 0 saubere Dokumente.
- `category` (908×) + `targetLanguage` (908×): falscher Inhaltstyp
  `climateAction`. **Wichtig:** `book` verlangt `targetLanguage` ebenfalls —
  der Typwechsel allein reicht nicht, das Template muss es liefern.
- `date` (908×): Basis-Feld-Contract verlangt `date`, das alte Template
  lieferte nur `year`.
- `source` (429×), `authors` (221× + 221 Typfehler): Extraktion unvollständig.

**Ursache im alten Template:** Es verwies auf einen „OpenAPFAD" und ein
„bereitgestelltes `acronymMapping`" — die Pipeline liefert aber
`context.filePath` und **kein** acronymMapping. Deshalb blieben `path`,
`pathHints`, `project`, `seriesOrJournal` leer und Akronyme unaufgelöst.

**Verifiziert am Kofler-PDF mit neuem Template:** `date: 2008-03-01`,
`targetLanguage: de`, `path`/`pathHints` gefüllt, `source` mit aufgelöstem
Akronym, `project: "Aqua Prad"`, `coverImageUrl` gesetzt.

### 3.4 Shadow-Twin-Ordner: Legacy-Präfix — BEHOBEN (nur Umweltarchiv)
Twin-Ordner heissen heute `_Datei.pdf`, alte tragen `.Datei.pdf`. Es gab
**kein Feature**, das umbenennt: Die Verifikations-Engine patcht nur
Metadaten (`applyRepair`), kennt das Storage-Backend bewusst nicht, und alle
Befunde sind `autoFixable: false`. Der Code tolerierte Alt-Ordner nur beim
Suchen (`generateShadowTwinFolderNameVariants`).

### 3.5 OFFEN: Strategie-Anzeige widerspricht dem Server
`src/components/settings/library/shadow-twin-config-section.tsx:119` baut für
die Vorschau ein künstliches Library-Objekt mit **hart kodiertem**
`primaryStore: "mongo"`. Der Server liest dagegen
`getShadowTwinConfig()` → `cfg?.primaryStore || 'filesystem'`.

Beim Umweltarchiv steht nur `config.shadowTwin = { mode: "v2" }` —
`primaryStore` fehlt. Folge: Die UI zeigt „primaryStore=mongo", die Routen
antworten „Mongo ist nicht aktiv", und „Aus Dateisystem laden" scheitert.
**31.069 Dateien im Storage, 4 Twin-Einträge in Mongo.**

Das ist ein stiller Fallback im Sinne von `no-silent-fallbacks.mdc`.

---

## 4. Was noch zu tun ist

### Sofort (blockiert den Rest)
1. **`primaryStore` klären** (§3.5): Gibt es einen UI-Schalter? Falls nicht,
   ist das die Lücke. Für das Umweltarchiv setzen:
   `primaryStore: "mongo"` **und** `persistToFilesystem: true`.
   ⚠️ `persistToFilesystem` leitet sich sonst vom `primaryStore` ab und
   springt bei `mongo` auf `false` — dann wird nicht mehr ins Dateisystem
   geschrieben.
2. **Strategie-Anzeige reparieren**: echten Wert aus `getShadowTwinConfig()`
   lesen statt `"mongo"` zu erfinden.

### Danach
3. **Andere Libraries normalisieren**, bevor der Legacy-Cleanup gemergt wird.
   Belegt betroffen: **Oldies for Future** (`/Webseite/Seiten/_Kontakt.md` mit
   verirrtem `Kontakt.website-page.de.md`). Nicht prüfbar waren:
   - SFSCON, Commoning, Dialograum, CAST → „Nicht authentifiziert"
     (OneDrive-Token; User muss sich je Library einmal anmelden)
   - Bibliothek Paul, Onedrive Simon, test/Testarchiv → fremder Owner
   - bcoop → WebDAV-URL liefert 404 (`.../files/Peter`)

   ```bash
   node --import tsx scripts/normalize-shadow-twin-folders.ts \
     --user peter.aichner@crystal-design.com --library <id>          # Trockenlauf
   # dann --limit 10 --apply als Stichprobe, dann --apply [--delete-superseded]
   ```

4. **Massenlauf** über alle 908 Dokumente mit dem neuen Template
   (kostet echte LLM-Läufe — nur auf ausdrückliche Freigabe des Users).
5. **Prüflauf** danach; erwartet: `category`/`targetLanguage`/`date` weg.
6. **PR** für `claude/shadow-twin-legacy-cleanup` erst nach Punkt 3.

### Nebenbei aufgefallen
- Vorbestehende Typfehler in `tests/` (u. a. `testimonial-writer.test.ts`) —
  Task-Chip existiert, nicht Teil dieser Arbeit.
- Hintergrundbild von Oldiesforfuture ist 3,8 MB — verkleinerte Web-Version
  wäre besser.

---

## 5. Wichtige Arbeitsregeln aus dieser Session

- **Trockenlauf zuerst** — hat zweimal echten Schaden verhindert:
  `.obsidian`/`.ck-meta` wären umbenannt worden; nach der Umbenennung hätte
  das Skript die 206 verbliebenen Artefakte nicht mehr gefunden.
- **MongoDB nur lesend** für Diagnosen.
- **Prod-DB** heisst `common-knowledge-scout-prod` und fehlt in `.env`.
- Worktrees erben `.env` nicht; Skripte brauchen
  `NODE_PATH="$PWD/node_modules"`.
- `grep -P` funktioniert in dieser Git-Bash-Locale **nicht** (POSIX `sed`
  verwenden) — hat einen Scan zweimal unbrauchbar gemacht.
