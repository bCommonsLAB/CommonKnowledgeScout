---
name: galerie-fokus-aus-sternen
overview: "Die Auswahl „Maßnahmen im Fokus“ ist keine redaktionelle Setzung mehr, sondern die Spitze der Sterne-Rangliste: Mitglieder vergeben Sterne im Bewertungsmodus, die Zahl der Sterne (ohne Namen) wird öffentlich, Galerie und Startseite zeigen die Rangliste live. Das Tag `fokus` entfällt, sobald die Startseite umgestellt ist. Owner-Entscheidung 16.10.2026 (Weg a). Vorhaben 2 in docs/STAND.md; Nachbar von website-startseite-sektionen.plan.md."
vorhaben: [Klimamaßnahmen Südtirol]
status: entwurf
todos:
  - id: f0-daten
    content: "F0 Daten (erledigt 16.10.): die bisherige Fokus-Auswahl ist als Sterne eines Mitglieds-Kontos übernommen, Test-Bewertungen sind entfernt. Sicherung und Abgleich gehören ins Archiv, nicht ins Repo."
    status: completed
  - id: f1-server
    content: "F1 Server: Library-Schalter `publicPublishing.starCountsPublic`; Docs-, Facetten- und Ids-Route liefern `favoriteCount` dann auch anonym (ohne Voter, ohne `isFavorite`); `sort=stars` öffentlich bei aktivem Schalter; `starred=<k>` wird serverseitig (mindestens k Sterne, über eine fileId-Liste aus `source_user_states`); Tie-Break nach Prioritäts-Index. ADR 0011."
    status: pending
  - id: f2-galerie
    content: "F2 Galerie: Knopf „Im Fokus“ für alle (setzt `starred=1&sort=stars`), Sterne-Zahl auf Karten und im Detail-Kopf für Anonyme nur lesend; der clientseitige `starred`-Filter fällt weg (behebt nebenbei die Seitenlücke bei Mitgliedern)."
    status: pending
  - id: f3-banner
    content: "F3 Startseiten-Banner: Frontmatter `banner_sort: stars` holt die Spitze der Rangliste (`sort=stars&starred=1`); der Galerie-Link trägt dieselben Parameter. `banner_tag` bleibt für andere Zwecke."
    status: pending
  - id: f4-inhalt
    content: "F4 Inhalt ohne Code (Owner, Brücke): Schalter setzen, Startseite auf `banner_sort: stars` umstellen, Link „Alle Fokus-Maßnahmen“ auf `?view=gallery&starred=1&sort=stars`, danach Tag `fokus` an den 36 Quellen entfernen (`dokument_felder_setzen`, `entfernen`)."
    status: pending
---

# Fokus aus Sternen: kollektive Rangliste statt redaktionellem Tag

> Vorhaben 2 in [`../STAND.md`](../STAND.md). Ersetzt den Punkt „Tag `fokus`
> an den Fokus-Maßnahmen setzen“ aus
> [`website-startseite-sektionen.plan.md`](website-startseite-sektionen.plan.md)
> (S0, S1). Daten-Abgleich und Vorgeschichte liegen im Archiv,
> Vorhabensordner `26.01 Klimamassnahmen Südtirol`.

## 1. Ausgangslage (Bestand, geprüft am 16.10.2026)

Es gab drei getrennte Systeme für „wichtig“:

| System | Ablage | Sichtbar | Wer setzt |
|---|---|---|---|
| Sterne / Bewertungsmodus | `source_user_states`, je Person | nur Mitglieder (Owner + Co-Creator) | jedes Mitglied |
| Tag `fokus` | Frontmatter, Meta-Dokument, Chunks | öffentlich | Owner über Brücke oder Frontmatter-Editor |
| `prioritaets_index` | Meta-Dokument | öffentlich | Pipeline, bei jedem Lauf neu |

Befund: Tag und Sterne zeigten zwei verschiedene Auswahlen derselben Person
zu verschiedenen Zeitpunkten; nur ein Viertel deckte sich. Owner-Entscheidung
16.10.: **Es gibt ein Kriterium, die Sterne.** Der Fokus ist eine kollektive,
dynamische Entscheidung der Mitglieder, keine Einzelsetzung. Der
Prioritäts-Index bleibt die Reihenfolge innerhalb gleicher Sternezahl.

Code-Stand, auf dem der Plan aufsetzt:

- `buildFavoriteLookupStages` (`src/lib/repositories/source-user-states-repo.ts`)
  hängt `favoriteCount`, `favoriteVoters`, `isFavorite` an — für Anonyme und
  Nicht-Mitglieder liefert sie **keine** Stages, die Karten haben dann gar
  keine Zahl.
- `buildGallerySort` (`src/lib/documents/gallery-sort.ts`): `sort=stars` nur
  für Mitglieder; Tie-Break `year`, `upsertedAt`.
- `starred=1` (Mitglieder, „Mit Sternen“) filtert **im Browser** über die
  geladene Seite (`gallery-root.tsx`). Bei Seitenweise-Laden fehlen Treffer
  späterer Seiten; `total` stimmt nicht.
- `total` der Docs-Route ist `countDocuments(query)` (`vector-repo.ts`
  `findDocs`). Eine fileId-Liste im Basisfilter hält ihn richtig; ein
  `$match` hinter dem `$lookup` täte es nicht.
- Galerie liest `starred` und `sort` bereits aus der Adresse
  (`filter-context-bar.tsx`, `pushParams`). Ein Startseiten-Link
  `?view=gallery&starred=1&sort=stars` braucht keinen URL-Facetten-Umbau.
- Banner: `bannerQuery` (`src/lib/website/banner.ts`) fragt `sort=rating`
  und optional `tags=` an.

## 2. Regeln

- **Zahl öffentlich, Namen nicht.** Anonym sichtbar wird nur
  `favoriteCount`. `favoriteVoters`, `isFavorite` und `not_important` bleiben
  Mitgliedern vorbehalten bzw. privat. Bewerten bleibt Mitgliedern
  vorbehalten.
- **Je Library abschaltbar.** Ein Schalter
  `publicPublishing.starCountsPublic` (Vorgabe `false`); ohne ihn ändert sich
  für keine andere Library etwas. Neues Config-Feld nach
  [`../contracts/library-config-field.md`](../contracts/library-config-field.md)
  (Skill `checklisten-erweiterung`).
- **Kein zweites Auswahl-Merkmal.** Kein Tag, kein Feld „fokus“; die Auswahl
  ergibt sich aus den Sternen. Das Tag `fokus` wird nach F3 entfernt.
- **Kein willkürlicher Schnitt in der Galerie.** „Im Fokus“ zeigt alle
  Einträge mit mindestens k Sternen (Vorgabe k = 1), absteigend nach Zahl.
  Eine feste Anzahl gibt es nur auf der Startseite (`banner_limit`), dort
  mit dokumentiertem Tie-Break und dem Link zur ganzen Liste.
- **Kein stiller Fallback.** `starred` mit ungültigem Wert gibt 400;
  `sort=stars` bei abgeschaltetem Schalter für Anonyme gibt 403 statt still
  anders zu sortieren; `banner_sort` mit unbekanntem Wert wirft im Parser
  (`no-silent-fallbacks.md`).
- **Kein Library-Inhalt im Repo.** Tests mit erfundenen Fixtures.
- Dateien höchstens 200 Zeilen: `gallery-root.tsx` (1453) und
  `filter-context-bar.tsx` (376) werden nicht erweitert, neue Teile kommen
  in eigene Dateien und werden nur eingehängt.

## 3. Wellen

### F0 · Daten (erledigt 16.10.)

Die redaktionelle Auswahl (36 Quellen, mit Dubletten aus zwei
Beteiligungsformaten) ist als Sterne des Kontos übernommen, das sie
getroffen hat; dessen ältere, abweichende Sterne sind ersetzt, Test-
Bewertungen des Owners entfernt. Lesender Abgleich, Sicherung (40
Datensätze vorher) und Ergebnis gehören ins Archiv (Vorhabensordner), nicht
ins Repo. Heute: 36 Einträge mit je
einem Stern; die Rangliste entsteht, wenn weitere Mitglieder bewerten.

### F1 · Server: Zahl öffentlich, Filter serverseitig

1. **Config-Feld** `publicPublishing.starCountsPublic?: boolean` in
   `@ks/contracts` (Typ), Validierung, Settings-Formular (Abschnitt
   Veröffentlichung), `veroeffentlichung_setzen` der Brücke.
2. **Zähl-Stages ohne Namen**: `buildFavoriteCountStages(libraryId)` neben
   `buildFavoriteLookupStages` — `$lookup` mit `$count`, liefert nur
   `favoriteCount`. `findDocs`/`findDocsGrouped` wählen: Mitglied → volle
   Stages wie heute; Nicht-Mitglied und Schalter an → Zähl-Stages; sonst
   keine.
3. **`starred=<k>` serverseitig**: Hilfsfunktion
   `fileIdsMitMindestSternen(libraryId, k)` (Aggregation `$group` über
   `source_user_states`, `state: 'favorite'`) und
   `sternFilterAusQuery(url, { libraryId, isMember, starCountsPublic })` →
   `{ fileId: { $in: [...] } }` im Basisfilter. Eingebaut in Docs-, Facetten-
   und Ids-Route, damit Liste, `total` und Facetten-Zahlen übereinstimmen.
   k ist eine ganze Zahl ≥ 1; anderes → 400. Nicht-Mitglied ohne Schalter →
   403.
4. **`sort=stars`**: `buildGallerySort` bekommt `starCountsPublic`; erlaubt
   für Mitglieder wie heute und für alle bei aktivem Schalter. Tie-Break neu:
   `favoriteCount` ↓, `docMetaJson.prioritaets_index` ↓, `upsertedAt` ↓
   (Libraries ohne Index sortieren damit wie bisher nach Datum).
5. **ADR 0011** „Sterne-Zahl öffentlich, Namen privat“: Entscheidung,
   Schalter, was öffentlich wird und was nicht; Verweis aus ADR 0002.
6. Cache prüfen: Antwortet die öffentliche Docs-Route mit Cache-Headern,
   muss ein neuer Stern spätestens nach kurzer Frist sichtbar sein.

Tests: `gallery-sort.test.ts` (stars mit/ohne Schalter, Tie-Break),
`stern-filter.test.ts` (k gültig/ungültig, Mitglied/anonym/Schalter),
Zähl-Stages ohne Voter-Felder, Route-Test „anonym sieht keine Namen“.

### F2 · Galerie: „Im Fokus“ für alle

1. **Knopf** `fokus-filter-button.tsx` (neu), in `filter-context-bar.tsx`
   nur eingehängt: sichtbar für Mitglieder immer, für Anonyme bei aktivem
   Schalter. Klick setzt bzw. entfernt `starred=1` und `sort=stars` per
   `pushParams`. Unter `lg` nur Symbol (Owner-Regel 08.10.). Der bisherige
   Mitglieder-Knopf „Mit Sternen“ geht darin auf; „Nur Favoriten“ und „Nach
   Sternen sortieren“ bleiben für Mitglieder.
2. **Daten**: `use-gallery-data.ts` reicht `starred` an die API; der
   clientseitige `starred`-Zweig in `gallery-root.tsx` entfällt (eine Zeile
   Aufruf bleibt). Bulk-Aktionen brauchen für `starred` keine
   `explicitBulkFileIds` mehr.
3. **Zahl anzeigen**: Karten (`source-stars-badge.tsx`) und Detail-Kopf
   zeigen für Anonyme die Zahl lesend, ohne Tooltip mit Namen und ohne
   Klick. Die `ClimateActionCard` zeigt ihre Sterne damit auch öffentlich.
4. Leerer Zustand: „Noch keine Maßnahme mit Stern.“ statt leerer Fläche.
5. Embed: liefert nur Öffentliches (ADR 0008 Nachtrag a); bei aktivem
   Schalter gehören Zahl und Knopf dazu, die Gastgeber-Adresse bleibt
   unberührt.

Tests: Knopf setzt/entfernt beide Parameter, sichtbar je Rolle und Schalter;
`use-gallery-data` sendet `starred`.

### F3 · Startseiten-Banner aus der Rangliste

- Frontmatter `banner_sort` am Seiten-Doc: `rating` (Vorgabe, wie heute)
  oder `stars`. `stars` erzeugt `sort=stars&starred=1&limit=…`; ist der
  Schalter aus, zeigt das Banner den Fehler im Seiten-Check (`seite_pruefen`)
  statt still nach Index zu sortieren.
- Der Galerie-Link unter dem Banner übernimmt dieselben Parameter
  (`?view=gallery&starred=1&sort=stars`), damit „Alle ansehen“ die ganze
  Rangliste zeigt.
- Dateien: `src/lib/website/banner.ts` (`bannerSortAus`, `bannerQuery`),
  `use-website-landing-data.ts`, `website-banner-grid.tsx`, Mapper
  `doc-meta-mappers.ts`, Registry `website` (optionalFields). Contract
  [`../contracts/website-landingpage.md`](../contracts/website-landingpage.md)
  nachziehen.

Tests: `bannerSortAus` (fehlend, `rating`, `stars`, unbekannt), Query mit
und ohne Tag, Link-Parameter.

### F4 · Inhalt ohne Code (Owner, Brücke)

1. `starCountsPublic: true` für die Library setzen.
2. Startseite: `banner_sort: stars`, `banner_tag` entfernen; Link „Alle
   Fokus-Maßnahmen ansehen“ auf `?view=gallery&starred=1&sort=stars`.
3. Erst danach Tag `fokus` an den 36 Quellen entfernen
   (`dokument_felder_setzen`, `entfernen: { tags: ["fokus"] }`, Stapel zu
   30). Vorher bleibt es als Rückfallebene stehen.
4. Mitglieder als Co-Creator einladen, damit aus 36 × 1 Stern eine
   Rangliste wird.

## 4. Reihenfolge und Aufwand

| Welle | Aufwand | Vor der Vorstellung am 20.10.? |
|---|---|---|
| F0 | erledigt | ja |
| F1 | ein Tag | ja, zuerst |
| F2 | ein halber Tag | ja |
| F3 | ein halber Tag | ja |
| F4 | eine Stunde Inhaltsarbeit | ja, nach F3 live |

F1 bis F3 je eine PR (Diff-Limits aus AGENTS.md). F2 und F3 hängen an F1
(Parameter und Schalter), nicht aneinander: nach dem Merge von F1 können
sie parallel laufen. Jede PR: `pnpm test`, `pnpm lint`,
`npx tsc --noEmit -p tsconfig.json` mit Vorher/Nachher-Vergleich; vor dem
Merge `pnpm build` und `bash scripts/welle-pre-merge-check.sh` lokal beim
Owner. Live-Prüfung anonym im privaten Fenster: Startseite, Knopf, Zahl,
keine Namen in der Antwort (`read_network_requests`).

Wird es knapp, trägt F1 + F3 die Startseite allein; der Galerie-Knopf (F2)
lässt sich bis dahin durch den Link ersetzen.

## 5. Nicht in diesem Plan (Vorrat)

- Dubletten zusammenlegen (gleiches Anliegen aus zwei
  Beteiligungsformaten) — der nächste Schritt laut Owner; Sterne der
  zusammengelegten Einträge müssen dabei mitwandern.
- Schwelle k je Library (`starred=2` usw. als Vorgabe der Startseite),
  sobald mehr Mitglieder bewerten.
- Galerie liest beliebige Facetten aus der URL (`?tags=…`); für diesen Plan
  nicht mehr nötig.
- Gewichtete Rangliste (Sterne minus „nicht wichtig“); `not_important`
  bleibt privat, solange es keine Owner-Entscheidung dazu gibt.

## 6. Offene Entscheidungen (Owner)

1. **Schalter oder global?** Empfehlung: Schalter je Library, Vorgabe aus.
2. **Beschriftung des Knopfs**: „Im Fokus“ (Empfehlung) oder je Library
   einstellbar. Einstellbar wäre ein weiteres Config-Feld.
3. **Tie-Break** bei gleicher Sternezahl: Prioritäts-Index (Empfehlung) oder
   Datum.
4. **Zahl auf öffentlichen Karten**: nur Zahl (Empfehlung) oder zusätzlich
   der Platz in der Rangliste.
