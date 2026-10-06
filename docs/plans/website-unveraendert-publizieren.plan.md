---
name: website-unveraendert-publizieren
overview: "Markdown-Quellen (vor allem Website-Seiten mit detailViewType website) aus dem Archiv heraus unverändert publizieren — ohne Vorlage und ohne Sprachmodell. Der Story-Tab der Datei-Vorschau bekommt den Knopf „Unverändert publizieren“, der dieselbe Funktion aufruft wie das Brücken-Werkzeug dokument_publizieren (B1). Dazu meldet seite_pruefen verwaiste Einträge, deren Quelldatei nicht mehr existiert. Vorhaben 2 in docs/STAND.md."
vorhaben: [Klimamaßnahmen Südtirol, Vortrag 30.09.]
status: entwurf
todos:
  - id: p1-route
    content: "P1 Server: Publizier-Funktion aus src/lib/mcp/website-publizieren.ts nach src/lib/website/publish-markdown-source.ts heben (Brücke importiert von dort); Route POST /api/library/[libraryId]/markdown/publish mit Modus vorschau (nur prüfen) und publizieren; Protokoll-Eintrag mit kanal app."
    status: pending
  - id: p2-knopf
    content: "P2 UI: Knopf „Unverändert publizieren“ im Story-Tab von markdown-view.tsx als eigene Komponente publish-unchanged-button.tsx; Vorschau-Dialog mit Warnungen und Fehlern; nach Erfolg Ordner und Story-Status auffrischen."
    status: pending
  - id: p3-verwaist
    content: "P3 Brücke: seite_pruefen meldet publizierte Seiten, deren fileId im Storage nicht mehr existiert (verwaister Eintrag) mit Hinweis auf dokument_depublizieren + dokument_publizieren der neuen Datei."
    status: pending
  - id: p4-doku
    content: "P4 Doku: Contract website-landingpage.md §Publizieren, Skill website-publishing (Knopf als zweiter Weg), Plan website-startseite-sektionen S0 Punkt 5 anpassen."
    status: pending
---

# Website-Seiten aus dem Archiv unverändert publizieren

> Vorhaben 2 in [`../STAND.md`](../STAND.md). Mutter-Plan:
> [`mcp-bruecke-website-publizieren.plan.md`](mcp-bruecke-website-publizieren.plan.md)
> (B1 `dokument_publizieren`). Nachbar:
> [`website-startseite-sektionen.plan.md`](website-startseite-sektionen.plan.md)
> (S0 Punkt 5 nennt den Story-Tab als Übergangsweg).

## 1. Anlass (Befund 06.10.2026)

Zwei Seiten der Website von Steckbrief 5 wurden außerhalb der Anwendung
korrigiert. Dabei wurden die Dateien gelöscht und neu geschrieben und
bekamen neue Storage-Kennungen. Folge: Die Galerie-Einträge hingen an den
alten Kennungen (Webseite zeigte den alten Text), die neuen Dateien kannten
weder Twin noch Eintrag (Archiv zeigte sie unpubliziert). Behoben über die
Brücke: `dokument_depublizieren` der alten, `dokument_publizieren` der
neuen Kennungen, `seite_pruefen`.

Dabei sichtbar geworden: **Im Archiv gibt es keinen Weg, eine
Markdown-Quelle unverändert zu publizieren.** Der Knopf „Erneut
publizieren“ im Story-Tab öffnet das Pipeline-Sheet; für Markdown-Quellen
verlangt `buildSourceMarkdownJob` (`src/lib/external-jobs/enqueue-markdown-job.ts`)
zwingend eine Vorlage, der Text geht durch das Sprachmodell. Für
Website-Seiten ist das der falsche Weg: Hero-Felder, Sektions-Marker und
Formulierungen können sich ändern. Der einzige verlustfreie Weg ist heute
das Brücken-Werkzeug (B1) — das setzt Cowork oder eine Claude-Code-Sitzung
mit freigegebenen Schreibrechten voraus.

## 2. Wie ein Artefakt weiß, dass es eine Webseite ist (Bestand)

- **Einzige Quelle ist das Frontmatter der Markdown-Datei:**
  `detailViewType: website`. Die Registry (`packages/contracts/src/detail-view-type-registry.ts`,
  Eintrag `website`) kennt den Typ, seine Pflichtfelder (`title`,
  `language`, `targetLanguage`) und die optionalen Hero-/Menü-Felder.
  `docType` ist nur eine Facette, keine Typ-Entscheidung.
- **Beim Publizieren** prüft `pruefeMarkdownDokument` (`src/lib/mcp/website-pruefung.ts`)
  das Feld gegen die Registry; bei `website` zusätzlich Sektions-Marker und
  Bild-URLs. Der Vorlagenname des Twin-Artefakts wird daraus abgeleitet
  (`website-page` bzw. `markdown-page`) und ist Teil des Artefakt-Schlüssels.
- **Im Galerie-Eintrag** steht der Typ als `docMetaJson.detailViewType`
  (das Frontmatter wird beim Ingest in den Eintrag übernommen). Danach
  entscheidet er alles Weitere: die Docs-API filtert damit
  (`src/lib/chat/facet-scope.ts`), der Mapper `doc-meta-mappers.ts` zieht
  die Website-Felder, `detail-view-renderer.tsx` wählt `WebsiteDetail`, und
  `seite_pruefen` listet nur Einträge dieses Typs.
- **Das Archiv weiß es NICHT.** Datei-Liste und Datei-Vorschau bestimmen
  den Dateityp über die Endung (`src/components/library/file-preview/extension-map.ts`,
  `file-list/list-utils.ts`). `Klimakaffee.md` ist dort schlicht `markdown`
  und öffnet `markdown-view.tsx`. Der dort vorkommende Typ `website`
  bezeichnet etwas anderes: gespeicherte Web-Links (`.url`, `.webloc`),
  die `website-view.tsx` mit Iframe anzeigt. Zwei Bedeutungen desselben
  Worts — der Plan ändert daran nichts, hält es aber fest (Vorrat: Umbenennung
  `fileType 'website'` → `'weblink'`).

Folge für diese Welle: Die Datei-Vorschau muss das Frontmatter des
geladenen Markdowns selbst lesen (`content`-Prop, `parseFrontmatter` wie in
`file-preview.tsx` für `kind: composite-*`), um zu wissen, ob der Knopf
„Unverändert publizieren“ sinnvoll ist. Der Knopf gilt für **jede**
Markdown-Quelle (ein handgeschriebener Bericht wird ebenso Galerie-Eintrag,
wie B1 es schon tut); bei `detailViewType: website` zeigt die Vorschau
zusätzlich die Website-Prüfung.

## 3. Regeln

1. **Kein zweiter Publizier-Pfad.** Route und Brücke rufen DIESELBE
   Funktion. Die heutige `publiziereMarkdownQuelle` wandert aus
   `src/lib/mcp/` nach `src/lib/website/publish-markdown-source.ts`; die
   Brücke importiert von dort. Vorlagenname bleibt deterministisch
   (`website-page` / `markdown-page`, Contract `shadow-twin-contracts`).
2. **Erst zeigen, dann schreiben.** Der Knopf ruft zuerst den Modus
   `vorschau` (nur `pruefeMarkdownDokument`), zeigt Warnungen und Fehler im
   Dialog; harte Fehler sperren den Bestätigen-Knopf, Warnungen brauchen
   ein ausdrückliches „trotzdem“. Nichts wird still korrigiert
   (`no-silent-fallbacks`).
3. **Protokoll wie die Brücke.** Jede Publikation aus der App landet im
   Aktions-Protokoll der Library. `ProtokollKopf` bekommt `kanal: 'bruecke' | 'app'`
   (heute fest `bruecke` in `src/lib/mcp/protokoll.ts`); die Begründung aus
   der App ist ein fester Satz („Unverändert publiziert aus der Datei-Vorschau“).
4. **Storage-Abstraktion.** Die Route liest die Quelle über
   `getServerProvider`, kennt kein Backend. Die Kennung der Quelle ist die
   `item.id` der Datei-Vorschau.
5. **Kein Library-Inhalt im Repo.** Plan und Tests nennen keine Dateinamen,
   Kennungen oder Texte einer Library.

## 4. Wellen

### P1 · Server (Funktion heben, Route)

- `src/lib/website/publish-markdown-source.ts`: `publiziereMarkdownQuelle`,
  `depubliziereQuelle`, `vorlageFuer`, Konstanten — unverändert verschoben;
  `ResolvedSource` wird zu einem eigenen Typ `MarkdownSourceRef`
  (`itemId`, `parentId`, `name`), den `tools-erschliessen-shared.ts` weiter
  liefert. `src/lib/mcp/website-publizieren.ts` wird zur Re-Export-Hülle
  oder entfällt (Importe der Brücke anpassen).
- Route `POST /api/library/[libraryId]/markdown/publish/route.ts` nach
  [`api-route-conventions.md`](../architecture/api-route-conventions.md):
  Body `{ sourceId, modus: 'vorschau' | 'publizieren', zielsprache?, trotzWarnungen? }`.
  `vorschau` liest die Datei und antwortet mit `{ detailViewType, warnungen, fehler, pflichtfelderFehlen }`;
  `publizieren` antwortet mit der `PublizierZeile` (fileId, navigationSlug,
  chunks, warnungen) oder `uebersprungen` mit Grund. 404, wenn die Kennung
  keine Datei ist; 400 bei Nicht-Markdown mit Hinweis auf die Pipeline.
- Protokoll: `mitProtokoll` mit `kanal: 'app'`, `werkzeug: 'dokument_publizieren'`,
  `akteur` = angemeldete E-Mail.
- Tests: Unit-Test der Route-Logik als reine Funktion
  (`publishMarkdownSourceHandler`) mit Fake-Provider: Vorschau liefert
  Warnungen, Publizieren mit Warnungen ohne `trotzWarnungen` schreibt nicht,
  Nicht-Markdown → Fehler. Bestehende Tests zu `website-pruefung` bleiben.

### P2 · UI (Knopf im Story-Tab)

- Neue Komponente `src/components/library/file-preview/publish-unchanged-button.tsx`
  (Knopf + Dialog + Hook `usePublishUnchanged`), eingebunden in
  `markdown-view.tsx` neben „Jetzt erstellen“ / „Erneut publizieren“.
  `markdown-view.tsx` hat 386 Zeilen; die Welle fügt dort nur den Einbau
  hinzu (zwei Zeilen) und baut sonst nichts an.
- Sichtbarkeit: immer für `fileType === 'markdown'`. Beschriftung
  „Unverändert publizieren“; Tooltip erklärt den Unterschied zu „Erneut
  publizieren“ (Vorlage + Sprachmodell).
- Ablauf: Klick → `modus: 'vorschau'` → Dialog zeigt Typ, Pflichtfelder,
  Warnungen (gelb), Fehler (rot, sperren) → „Publizieren“ bzw. „Trotz
  Warnungen publizieren“ → `modus: 'publizieren'` → Toast mit Ergebnis
  (Chunks, Link `/explore/<slug>?doc=<navigationSlug>` bei öffentlicher
  Library) → `onRefreshFolder()` und Story-Status neu laden, damit der grüne
  Upload-Haken in der Datei-Liste erscheint (`fileGroup.ingestionStatus.exists`).
- Während eines laufenden Jobs (`hasActiveJob`) ist der Knopf gesperrt wie
  die Nachbarn.
- Tests: Hook mit gemocktem `fetch` (Vorschau → Dialog-Zustand, Fehler →
  Bestätigen gesperrt). UI-Verifikation lokal nach
  [`verification-playbook.md`](../guides/verification-playbook.md) an einer
  Test-Library (`scripts/seed-test-library.ts`), nicht an Steckbrief 5.

### P3 · Brücke (verwaiste Einträge sichtbar machen)

- `seite_pruefen` (`src/lib/mcp/website-pruefung.ts` / `tools-website-pruefen.ts`)
  prüft je publizierter Seite mit `provider.getItemById(fileId)`, ob die
  Quelle noch existiert. Fehlt sie: Befund `verwaist` mit Hinweis
  „Quelldatei fehlt — wurde sie neu angelegt, trägt sie eine neue Kennung:
  `dokument_depublizieren` dieser fileId, dann `dokument_publizieren` der
  neuen Datei“. Zusätzlich Hinweis, wenn im Ordner der Quelle eine
  gleichnamige Datei mit anderer Kennung liegt (das war der Fall vom 06.10.).
- Kein Automatismus: die Brücke schlägt vor, der Mensch bestätigt.
- Werkzeugsatz-Version anheben (`bruecke_info`), Skill-Text ergänzen.

### P4 · Doku

- [`website-landingpage.md`](../contracts/website-landingpage.md): neuer
  Abschnitt „Publizieren“ — zwei Wege (Knopf, Brücke), eine Funktion; Twin
  hängt an der Storage-Kennung; Neuanlage einer Datei = neue Kennung.
- Skill `website-publishing` (Repo-Kopie und Original im Archiv): Schritt
  „Publizieren“ nennt den Knopf als Weg ohne Brücke.
- [`website-startseite-sektionen.plan.md`](website-startseite-sektionen.plan.md)
  S0 Punkt 5: Übergangslösung streichen.
- `docs/STAND.md` Vorhaben 2: Punkt erledigt melden.

## 5. Nicht in dieser Welle (Vorrat)

- Automatisches Nachpublizieren beim Speichern im Editor.
- Umbenennung `fileType 'website'` (Web-Link) → `'weblink'`.
- Ein Knopf „Unverändert publizieren“ in der Datei-Liste (Mehrfachauswahl).
- Kennungs-Wechsel automatisch erkennen und den Eintrag umhängen
  (`familie_umziehen` kann es nur, solange die alte Quelle existiert).

## 6. Aufwand und Reihenfolge

| Welle | Aufwand | Reihenfolge |
|---|---|---|
| P1 | halber Tag | zuerst — Route ist die Grundlage |
| P2 | halber Tag | danach, braucht P1 |
| P3 | zwei Stunden | unabhängig, kann parallel |
| P4 | eine Stunde | zum Schluss |

Eine PR für P1+P2 (Branch `claude/website-unveraendert-publizieren`),
eine zweite für P3+P4. Vor Merge: `pnpm test`, `pnpm lint`,
`npx tsc --noEmit -p tsconfig.json`, `pnpm build` lokal,
`bash scripts/welle-pre-merge-check.sh`.
