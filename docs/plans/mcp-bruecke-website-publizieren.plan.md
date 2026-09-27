---
name: mcp-bruecke-website-publizieren
overview: "Eine Website aus Cowork oder einer Cloud-Session heraus konzipieren UND ausspielen. Heute kann die MCP-Brücke die Markdown-Seiten anlegen, aber nicht publizieren, keine Felder an Galerie-Einträgen setzen, keine Bilder anonym lesbar ablegen und die Veröffentlichungs-Einstellungen nicht lesen oder setzen. Fünf Werkzeuge schließen die Lücke, nach dem Muster der bestehenden Brücke: schreibend nur mit Begründung und Bestätigung, protokolliert, ohne stille Fallbacks. Vorhaben 2 in docs/STAND.md, Nachbar des Plans website-startseite-sektionen."
vorhaben: [Klimamaßnahmen Südtirol, Vortrag 30.09.]
status: entwurf
todos:
  - id: b1-publizieren
    content: "B1 `dokument_publizieren`: Markdown-Quelle unverändert (ohne Sprachmodell) als Transformation registrieren und als Galerie-Eintrag ingestieren; Wiederholung aktualisiert; `dokument_depublizieren` als Gegenstück. Antwort: fileId, Navigations-Slug, Warnungen (Bild-URLs nicht anonym, Parser-Fehler der Sektionen)."
    status: pending
  - id: b2-felder
    content: "B2 `dokument_felder_setzen`: flache Felder und Tags an Galerie-Eintrag UND Twin-Frontmatter setzen, Stapel bis 30 Quellen; Schutz der `_`-Twin-Ordner bleibt, weil die Brücke selbst schreibt."
    status: pending
  - id: b3-bilder
    content: "B3 `bild_veroeffentlichen` und `bilder_auflisten`: Bild (base64, 6 MB) in den öffentlichen Blob unter `<libraryId>/website/images/` legen, anonyme URL zurückgeben; vorhandene Bilder listen."
    status: pending
  - id: b4-veroeffentlichung
    content: "B4 `veroeffentlichung_lesen` und `veroeffentlichung_setzen`: publicPublishing lesen (Schlüssel maskiert) und mit derselben Validierung wie die PUT-Route setzen (slugName, isPublic, siteEnabled, logoUrl, backgroundImageUrl, gallery-Texte)."
    status: pending
  - id: b5-pruefen
    content: "B5 `seite_pruefen`: alle website-Docs einer Library als Menü- und Footer-Struktur, je Doc die geparsten Sektionen, fehlende Pflichtfelder, nicht anonyme Bild-URLs, tote `?site=`-Ziele; liest nur."
    status: pending
  - id: b6-skill
    content: "B6 Skill `website-publishing` auf die neuen Werkzeuge umstellen (kein MongoDB-Lesen, kein Formular-Copy-Paste mehr); Werkzeugsatz-Version hochzählen, `bruecke_info` nennt die neuen Werkzeuge."
    status: pending
---

# MCP-Brücke: Website aus Cowork konzipieren und publizieren

> Vorhaben 2 in [`../STAND.md`](../STAND.md). Nachbar:
> [`website-startseite-sektionen.plan.md`](website-startseite-sektionen.plan.md)
> (was der Renderer können muss). Dieser Plan: was die Brücke können muss,
> damit der ganze Weg ohne die App-Oberfläche geht.

## 1. Der Weg einer Website heute, Station für Station

| Station | Was passiert | Geht über die Brücke? |
|---|---|---|
| 1 Seiten schreiben | Markdown-Dateien mit `detailViewType: website` im Storage, Ordner `Webseite/Seiten/` | ja (`datei_anlegen`, `datei_patchen`, `ordner_anlegen`) |
| 2 Publizieren | Transformation `website-page` am Twin registrieren, `IngestionService.upsertMarkdown` schreibt den Galerie-Eintrag; nur den liest die Landingpage | **nein**. `transformation_starten` schickt den Text durch das Sprachmodell; die Route `ingest-markdown` verlangt Clerk und einen vorhandenen Twin |
| 3 Fokus markieren | Tag oder flaches Feld an bestehenden Galerie-Einträgen (Maßnahmen) | **nein**. `_`-Twin-Ordner sind für `datei_patchen` gesperrt (richtig so); der Galerie-Eintrag ist nur über die App erreichbar |
| 4 Bilder | anonym lesbare Blob-URLs unter `<libraryId>/website/images/` | **nein**. `datei_binaer_anlegen` schreibt in den Storage, der ist auth-gegated; das Spiegelskript braucht den Azure-Schlüssel lokal |
| 5 Veröffentlichung | `publicPublishing`: `isPublic`, `slugName`, `siteEnabled`, `logoUrl`, `backgroundImageUrl`, Galerie-Texte | **nein**. Nur das Formular (`PUT /api/libraries/[id]/public`, Clerk) |
| 6 Prüfen | `/explore/<slug>` ansehen | aus der Cloud-Session nur, wenn die Netzwerk-Regel der Umgebung die Instanz erlaubt |
| 7 Domain | `PUBLIC_DOMAIN_LIBRARY_MAP` im Deployment, DNS | nein, und das bleibt so (Deployment, nicht Library) |

Stationen 2 bis 5 fehlen. Das Muster für 2 existiert schon als Skript
(`scripts/migrate-website-docs-to-files.ts`, Schritte 3 und 4); die Brücke
macht daraus ein Werkzeug.

## 2. Regeln

- **Gleiche Rechte wie der Schlüssel.** Der Konto-Schlüssel gilt mit den
  vollen Rechten seines Besitzers (ADR 0008, offene Kante). Publizieren und
  Einstellungen setzen sind Owner-Aktionen; wer den Schlüssel hat, darf sie
  heute schon über die App. Kein neuer Mechanismus, keine Scopes in diesem
  Plan.
- **Schreibend nur mit `begruendung` und nach Bestätigung**, wie alle
  Schreibwerkzeuge der Brücke; jede Aktion steht im Aktionsprotokoll
  (`protokoll.ts`).
- **Kein Sprachmodell im Publizieren.** `dokument_publizieren` überträgt den
  Text unverändert. Wer eine Vorlage anwenden will, nimmt weiterhin
  `transformation_starten`.
- **Kein stiller Fallback.** Fehlt `detailViewType`, ist ein Sektions-Marker
  ungültig oder eine Bild-URL nicht anonym lesbar, sagt die Antwort das;
  publiziert wird trotzdem nur, wenn der Aufrufer `trotzWarnungen: true`
  setzt.
- **Antwortgrößen bleiben begrenzt** (Q2-Regel der Brücke): Listen mit
  `limit`, Prüfberichte gekürzt mit `gekuerzt: true`.
- **Archivpflege ist nicht Voraussetzung.** Die Werkzeuge sind generisch
  und laufen in jeder Library des Schlüssels; nur `stand_setzen` und
  Verwandte bleiben an `archivpflege` gebunden.
- **Kein Library-Inhalt im Repo.** Tests mit erfundenen Fixtures.
- Dateien höchstens 200 Zeilen: je Werkzeug eine Datei
  `src/lib/mcp/tools-website-*.ts`, Registrierung in `tools.ts`.

## 3. Die Werkzeuge

### B1 · `dokument_publizieren` / `dokument_depublizieren`

- Eingabe: `libraryId`, `pfad` oder `sourceId` (Stapel `sourceIds` bis 30),
  `zielsprache` (Vorgabe `de`), `trotzWarnungen`, `begruendung`.
- Ablauf je Quelle: Markdown lesen, Frontmatter parsen (flacher Parser der
  Pipeline), Warnungen sammeln (§2), Transformation mit festem
  Vorlagennamen `website-page` am Twin registrieren oder aktualisieren
  (`ShadowTwinService`, Mongo-Mode), dann `IngestionService.upsertMarkdown`.
  Der Vorlagenname ist Teil des Artefakt-Schlüssels und muss
  deterministisch bleiben (Contract `shadow-twin-contracts`).
- Gilt für jede Markdown-Quelle, nicht nur `website`: ein handgeschriebener
  Bericht wird damit ebenso Galerie-Eintrag. Für Nicht-Markdown-Quellen
  Fehler mit Hinweis auf `quelle_erschliessen`.
- Antwort je Quelle: `fileId`, `navigationSlug`, `detailViewType`,
  `warnungen[]`, `uebersprungen` mit Grund.
- `dokument_depublizieren`: Galerie-Eintrag und Vektoren entfernen, Twin
  bleibt; Antwort nennt, was entfernt wurde.
- Wiederverwendung: `scripts/migrate-website-docs-to-files.ts` (Schritte
  3 bis 4), `src/lib/mcp/transformation-markdown.ts` (Markdown-Quellen),
  `ingest-markdown/route.ts` (Frontmatter-Prüfung).

### B2 · `dokument_felder_setzen`

- Eingabe: `sourceIds` (bis 30), `felder` (flache Skalare) und `listen`
  (z. B. `tags: ["fokus"]`, Dubletten normalisiert wie
  `frontmatter_ergaenzen`), `entfernen` (Listeneinträge), `begruendung`.
- Schreibt in derselben Reihenfolge wie die App: Twin-Frontmatter der
  gewählten Transformation, dann Galerie-Eintrag (`docMetaJson`). Beide
  Seiten oder keine; ein gescheiterter Eintrag bricht den Stapel nicht ab,
  jede Zeile trägt ihr Ergebnis.
- Gesperrt: Felder, die die Pipeline rechnet (`prioritaets_index`,
  `bewertung_stand`) und Pflichtfelder der Registry (`title`,
  `detailViewType`); die Liste kommt aus `detail-view-type-registry.ts`,
  nicht aus einer zweiten Quelle.
- Damit wird die Fokus-Markierung der Maßnahmen (Tag `fokus`) ein Aufruf
  statt dreißig Klicks.

### B3 · `bild_veroeffentlichen` / `bilder_auflisten`

- Eingabe: `libraryId`, `dateiname`, `inhaltBase64`, `mimeType` (nur
  Bildtypen), `begruendung`; Grenze 6 MB wie `datei_binaer_anlegen`.
- Ziel: Blob-Container `knowledgescout`, Pfad
  `<libraryId>/website/images/<dateiname>`; gleicher Client wie
  `scripts/mirror-website-images-to-blob.ts` und `upload-image/route.ts`.
  Existiert der Name, Absage mit URL des vorhandenen Bilds
  (`ueberschreiben: true` erlaubt).
- Antwort: anonyme URL, Größe, Hash. `bilder_auflisten` listet den Ordner
  mit URLs.
- Optional: `quellPfad` statt `inhaltBase64`, dann kopiert die Brücke ein
  Bild aus dem Storage in den Blob (die Spiegel-Funktion des Skripts als
  Werkzeug).

### B4 · `veroeffentlichung_lesen` / `veroeffentlichung_setzen`

- Lesen: `publicPublishing` der Library, `apiKey` maskiert
  (Sicherheitsregel in CLAUDE.md), dazu die abgeleitete öffentliche URL
  `/explore/<slug>` und ob die Domain-Zuordnung greift (nur Lesen der
  Umgebungsvariable, nie ihr Wert).
- Setzen: dieselben Felder und dieselbe Validierung wie die PUT-Route
  (Slug-Format, Slug-Kollision, `requiresAuth` nur mit `isPublic`).
  Validierung in eine gemeinsame Datei ziehen
  (`src/lib/services/public-publishing-validation.ts`), damit Route und
  Werkzeug nicht auseinanderlaufen. Nur genannte Felder ändern sich.
- `isPublic: true` ist die eine Aktion mit Außenwirkung (Inhalte werden
  anonym lesbar). Die Antwort sagt das ausdrücklich; die Bestätigung durch
  den Menschen bleibt die Sperre.

### B5 · `seite_pruefen`

- Liest nur. Eingabe: `libraryId`, optional `pfad` einer einzelnen Seite.
- Antwort: Menü (`menu_order`, `menu_area`), Footer-Doc, je Seite die
  geparsten Sektionen (Layout, Hintergrund, Bild vorhanden), Parser-Fehler
  mit Zeile, fehlende Pflichtfelder, Bild-URLs außerhalb des Blobs, tote
  `?site=`-Ziele, Startseite (kleinster `menu_order`).
- Nutzt `parseWebsiteSections`, `site-navigation.ts` und die Registry;
  keine zweite Implementierung der Regeln.
- Das ist die Vorschau ohne Browser: Was hier sauber ist, rendert.

### B6 · Skill und Doku

- Skill `.claude/skills/website-publishing/SKILL.md` umschreiben: Ablauf
  über B1 bis B5, „erst vorschlagen, dann speichern“ bleibt.
- `bruecke_info` nennt die Werkzeuge unter `neuInDieserVersion`;
  Werkzeugsatz-Version hochzählen (`tools-info.ts`).
- Contract `website-landingpage.md`: Absatz „Publizieren über die Brücke“.

## 4. Reihenfolge und Aufwand

| Welle | Aufwand | Warum in dieser Reihenfolge |
|---|---|---|
| B1 | 1 Tag | Ohne Publizieren bleibt jede Seite unsichtbar; Muster liegt im Skript |
| B2 | ½ Tag | Fokus-Markierung, wird sofort gebraucht |
| B5 | ½ Tag | Prüfen vor dem ersten echten Publizieren; nur lesend, risikoarm |
| B3 | ½ Tag | Bilder; bis dahin Spiegelskript lokal |
| B4 | ½ Tag | Einstellungen; bis dahin Formular |
| B6 | ½ Tag | Skill und Doku, sonst nutzt die Werkzeuge niemand |

Je Welle eine PR mit Tests (Fixtures ohne echte Library), `pnpm test`,
`pnpm lint`, `tsc`-Vergleich. Kein `pnpm build` im Cloud-Agent.

## 5. Was außerhalb der Brücke bleibt

- **Netzwerk der Cloud-Session**: Für die Sichtprüfung der fertigen Seite
  muss die Umgebung die Instanz-Domain erlauben. Das ist eine Einstellung
  der Umgebung, kein Werkzeug.
- **Domain-Zuordnung** (`PUBLIC_DOMAIN_LIBRARY_MAP`, DNS): Deployment.
- **Übersetzung DE/IT**: bestehender Übersetzungspfad; ein Werkzeug
  `dokument_uebersetzen` wäre B7, erst wenn S6 des Sektionen-Plans ansteht.
- **Scopes am Konto-Schlüssel**: offene Kante aus ADR 0008, eigener Plan.
