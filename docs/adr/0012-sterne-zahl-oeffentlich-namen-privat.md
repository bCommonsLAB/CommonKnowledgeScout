# ADR 0012 — Sterne-Zahl öffentlich, Namen privat (Fokus aus Sternen)

- **Status**: Akzeptiert (Owner 16.10.2026), Umsetzung Welle F1 (18.10.2026)
- **Datum**: 2026-10-18
- **Kontext**: Plan [`../plans/galerie-fokus-aus-sternen.plan.md`](../plans/galerie-fokus-aus-sternen.plan.md),
  Vorhaben 2 in [`../STAND.md`](../STAND.md); baut auf [ADR 0002](0002-galerie-sterne-ohne-clerk-read.md) auf.

## Entscheidung

Die Auswahl „im Fokus" einer Library ist keine redaktionelle Setzung (Tag,
Feld), sondern die Spitze der Sterne-Rangliste ihrer Mitglieder. Damit
Besucher diese Rangliste sehen können, gilt:

- **Ein Schalter je Library**: `publicPublishing.starCountsPublic`
  (Vorgabe `false`). Ohne ihn ändert sich für keine Library etwas.
- **Zahl öffentlich, Namen nicht.** Ist der Schalter an, liefern die
  Lese-Routen der Galerie (`GET …/docs`, `…/facets`, `…/docs/ids`) das Feld
  `favoriteCount` auch anonym. `favoriteVoters`, `isFavorite` und der private
  Marker `not_important` bleiben Mitgliedern (Owner + aktive Co-Creator)
  vorbehalten. Der Lookup für Nicht-Mitglieder zählt nur
  (`buildFavoriteCountStages`), er lädt keine Voter-Dokumente in die Antwort.
- **Bewerten bleibt Mitgliedern vorbehalten.** Der Schalter öffnet das Lesen,
  nicht das Schreiben (`POST …/source-user-states` unverändert).
- **`sort=stars` und `starred=<k>` sind damit öffentlich.** `starred=<k>`
  (mindestens k Sterne, ganze Zahl ≥ 1) läuft serverseitig als
  fileId-Liste im Basisfilter aller drei Routen, damit Liste, `total` und
  Facetten-Zahlen übereinstimmen. Tie-Break bei gleicher Sternezahl:
  `docMetaJson.prioritaets_index` absteigend, dann `upsertedAt`.
- **Kein stiller Fallback.** Gäste ohne Schalter bekommen für `sort=stars`,
  `sortField=favoriteCount` und `starred` eine 403, ungültiges `starred`
  eine 400 — nie eine still anders sortierte oder ungefilterte Liste.
- **Kein zweites Auswahl-Merkmal.** Ein Tag oder Feld „fokus" wird nicht
  mehr gepflegt; es bleibt nur als Rückfallebene stehen, bis die Startseite
  auf die Rangliste umgestellt ist (Welle F3/F4).

## Begründung

- Tag und Sterne zeigten im Bestand zwei verschiedene Auswahlen derselben
  Person zu verschiedenen Zeitpunkten; nur ein Viertel deckte sich. Ein
  Kriterium, das Mitglieder gemeinsam und laufend pflegen, ist ehrlicher als
  eine Setzung, die niemand nachzieht.
- Die Zahl ist kein personenbezogenes Datum, die Voter-Liste schon. Die
  Trennung in zwei Stage-Sätze macht das im Code sichtbar, statt Felder nach
  dem Laden auszufiltern.
- Der clientseitige Filter „Mit Sternen" ließ bei seitenweisem Laden Treffer
  späterer Seiten aus; der serverseitige Filter behebt das für Mitglieder
  gleich mit.

## Konsequenzen

- Neues Config-Feld auf allen Stationen (Typ, Client-Steckbrief, Service,
  Formular Einstellungen → Veröffentlichung, Route `PUT /api/libraries/[id]/public`,
  Brücke `veroeffentlichung_setzen`/`_lesen`, öffentliche Library-Routen).
- `buildGallerySort` und `resolveColumnSort` kennen den Schalter;
  `findDocs`/`findDocsGrouped` wählen die Stages über `waehleSterneStages`.
- Embed (ADR 0008, Nachtrag a) liefert nur Öffentliches: bei aktivem Schalter
  gehört die Zahl dazu, die Namen nie.
- Offen (Vorrat des Plans): gewichtete Rangliste, Schwelle k je Library,
  Platz in der Rangliste auf Karten.
