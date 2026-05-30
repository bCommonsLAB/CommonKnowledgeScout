# Zielbild: Kollaborative Favoriten & Kommentare im Maßnahmen-Archiv

> Status: **Entwurf zur Schärfung** · Letzte Aktualisierung: 2026-05-30
> Verwandt: [`docs/adr/0002-galerie-sterne-ohne-clerk-read.md`](../adr/0002-galerie-sterne-ohne-clerk-read.md),
> [`.cursor/plans/quell-favoriten_und_kommentare_f294a0fd.plan.md`](../../.cursor/plans/quell-favoriten_und_kommentare_f294a0fd.plan.md)

## 1. Kontext & Zweck

In der „Erkunden"-/Galerie-Ansicht eines Maßnahmen-Archivs sollen **eingeladene
Mitglieder** (Owner + Co-Creators) eine Quellen-/Maßnahmensammlung **gemeinsam
bewerten und diskutieren** — als kollaborative Priorisierung, nicht als
Einzel-Notiz.

## 2. Zielbild (verbindliche Soll-Vorstellung)

- **Gemeinsam favorisieren**: Jedes Mitglied vergibt eigene Sterne. Die Sterne
  der Gruppe werden **aggregiert** — pro Maßnahme zählt die Gesamtzahl der
  Favoriten über alle Mitglieder.
- **Ranking**: Man sieht auf einen Blick, **welche Maßnahmen die meisten
  Favoriten** haben, und kann **danach sortieren** („Nach Sternen sortieren").
- **Gegenseitig kommentieren**: Mitglieder sehen die Kommentare der **anderen**
  Mitglieder und können darauf reagieren (Diskussion, nicht nur Feedback-an-Owner).
- **Transparente Übersicht**: Eigene Favoriten **und** die Team-Favoriten sollen
  übersichtlich **nebeneinander** erkennbar sein (wer hat was favorisiert,
  Gesamtzahl, eigene Auswahl) — eine echte Gruppen-Sicht.
- **Privates Aussortieren bleibt privat**: Der Tinder-Marker `not_important`
  ist rein persönlich (eigener Aussortier-Filter), zählt **nicht** ins
  Team-Ranking und ist für andere nicht sichtbar.

## 3. Rollen & Berechtigungen

| Aktion | Anonym | Gast (eingeloggt, kein Mitglied) | Owner / Co-Creator |
|---|---|---|---|
| Favoriten sehen / setzen / sortieren | – | – (403) | ✅ |
| Aggregierte Sterne + Voter-Namen sehen | – | – | ✅ |
| Kommentar schreiben | – (401) | ✅ | ✅ |
| Kommentare **aller** sehen | – | nur eigene | ✅ alle |
| Kommentar moderieren (löschen) | – | nur eigene | ✅ beliebige |

## 4. Datenmodell (V2, aktuell)

Stabiler Schlüssel je Quelle: storage-agnostische `fileId`.

- **`source_user_states`** — per-User-Zustand `(libraryId, fileId, userEmail)`,
  `state ∈ { 'favorite', 'not_important' }`, plus eingefrorener
  `userDisplayName`. Aggregation (`favoriteCount`, `favoriteVoters`,
  `isFavorite`) hängt direkt am Galerie-Endpoint `GET …/docs`
  ([`source-user-states-repo.ts`](../../src/lib/repositories/source-user-states-repo.ts),
  Funktion `buildFavoriteLookupStages`).
- **`source_comments`** — Multi-User-Feedback je `(libraryId, fileId)` mit
  Versions-History (`revisions[]`) und Soft-Delete
  ([`source-comments-repo.ts`](../../src/lib/repositories/source-comments-repo.ts)).

## 5. Aktueller Stand vs. Zielbild (Gap-Analyse)

| Aspekt | Stand heute | Lücke zum Zielbild |
|---|---|---|
| Aggregierte Sterne + Sortierung | ✅ vorhanden (`?sort=stars`) | — |
| Eigene Favoriten filtern | ✅ „Nur Favoriten" (`?favorites=1`) | zeigt **nur eigene**, keine Team-Sicht |
| Team-Favoriten-Übersicht | ⚠️ nur indirekt über Stern-Sortierung | **eigene vs. Team nebeneinander** fehlt als dedizierte Sicht |
| Kommentare aller sehen | ✅ im Code (Mitglied sieht alle) | nur in **Tabellen-/Listen-Ansicht** sichtbar, **nicht** im Karten-Grid |
| Kommentar-Anzeige Karten-Grid | ❌ | Kommentar-Indikator/Panel fehlt in der Kartenansicht |

## 6. Datenrettung V1 → V2 (erledigt 2026-05-30)

Ursprünglich gab es ein geteiltes V1-Modell (`source_favorites`,
`{libraryId, fileId, createdBy}`). Die Umstellung auf das per-User-V2-Modell
(`source_user_states`) **kopierte die Altdaten nicht automatisch** — die
Migration war nie ausgeführt worden.

- Befund (Prod-DB `common-knowledge-scout-prod`, Library
  `df02248c-9d4e-489f-9914-4ca875a6479f`): 35 V1-Favoriten von
  `klima@umwelt.bz.it` fehlten komplett in V2; 22 Kommentare lagen unberührt in
  `source_comments`.
- Reparatur: additive, idempotente Migration der 35 Favoriten nach
  `source_user_states` via
  [`scripts/rescue-source-favorites.ts`](../../scripts/rescue-source-favorites.ts).
  `source_favorites` blieb als Backup erhalten (kein Drop).
- Ergebnis: V2 = 39 Einträge, GAP = 0.
- Offen (kosmetisch): klimas Voter-Name zeigt zunächst den E-Mail-Prefix
  („klima"), bis er selbst erneut einen Stern setzt (Lazy-Backfill) oder
  [`scripts/refresh-source-user-display-names.ts`](../../scripts/refresh-source-user-display-names.ts)
  gegen die Prod-DB läuft.

## 7. Offene Punkte / Future Work

1. **Team-Favoriten-Übersicht** als eigene Sicht: eigene Auswahl + Gesamt-Ranking
   + Voter-Namen kompakt nebeneinander (statt nur „Nur Favoriten" = eigene).
2. **Kommentare in der Karten-Ansicht** sichtbar machen (Indikator + Panel),
   nicht nur in der Tabellen-/Listen-Ansicht.
3. Optional: Stern-Aufschlüsselung „X von Y Mitgliedern" inkl. wer noch nicht
   bewertet hat (Vollständigkeits-Sicht für die Gruppe).

## 8. Leitplanke

**Zuerst Daten erhalten, dann Features bauen.** Bestehende Erfassungen
(`source_favorites`, `source_comments`) sind die Quelle der Wahrheit für die
Gruppenbewertung und dürfen bei UI-Weiterentwicklungen nicht verloren gehen.
