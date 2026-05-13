# ADR 0002 — Galerie-Sterne: persistierte Namen, kein Clerk auf dem Read-Pfad

- **Status**: Akzeptiert
- **Datum**: 2026-05-13
- **Kontext**: Plan „Server-Side Sterne und Display-Names“

## Entscheidung

- Beim Setzen eines Sterns (`POST …/source-user-states`) wird der Anzeigename des Users in MongoDB persistiert (`userDisplayName` in `source_user_states`), inkl. Lazy-Backfill fuer aeltere Eintraege desselben Users in derselben Library.
- Die Galerie (`GET …/docs`) liefert `favoriteCount`, `favoriteVoters` und `isFavorite` direkt am Dokument (Aggregation mit `$lookup` auf  `source_user_states`).
- Dafuer entfallen der Bulk-Endpoint `source-favorites/aggregated`, der Resolver `members/display-names` und die zugehoerigen Client-Hooks; Tooltip und Sortierung nutzen nur noch Server-Daten.

## Begruendung

- Weniger Round-Trips und keine Abhaengigkeit von Clerk fuer reine Lese-Szenarien.
- Globale Sortierung „Nach Sternen“ ist konsistent mit der Datenbank (`?sort=stars`), nicht nur innerhalb des clientseitig geladenen Ausschnitts.

## Konsequenzen

- Anzeigenamen in Tooltips koennen veraltet sein, bis der User erneut einen State in der Library setzt oder das optionale Script `scripts/refresh-source-user-display-names.ts` laeuft.
- Geloeschte Clerk-Accounts behalten den zuletzt gespeicherten Namen in historisierten Voter-Listen (gewollt).
