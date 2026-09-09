# Agent-Brief M5 — AECED-Pilot: Galerie als einbettbare Komponente

> Vorhaben 1 in [`docs/STAND.md`](../../STAND.md). Owner-Entscheidung vom
> 2026-09-09: M5 ist das nächste Vorhaben, M6 bis M8 bleiben geplant.
> Dieser Brief ersetzt den langen Modularisierungs-Abschnitt, der bis zum
> 09.09. in `AGENTS.md` stand; die Vorgeschichte ist unten zusammengefasst.

## Ziel

```tsx
<KnowledgeScoutExplorer
  baseUrl="https://knowledgescout.org"
  library="aeced" view="gallery" locale={locale}
/>
```

läuft in der Next-Anwendung von AECED (Einsatz-Muster P2 in
[`einsatz-szenarien.md`](../../architecture/einsatz-szenarien.md)). Die
Komponente liest **anonym** von der zentralen Instanz und zeigt **nur
öffentliche Inhalte**: kein Site-Token, keine Besucher-Anmeldung (ADR 0008,
Nachtrag 2026-08-29). Kein neues Deployment; die Voll-App bleibt
verhaltensneutral (Abnahmekriterium jeder A-Welle).

Nicht Teil von M5: M6 bis M8, die Headless-API P8 (erst wenn AECED sie
verlangt), Story und Chat im Embed vor der Galerie.

## Die fünf Schritte

Jeder Schritt ist eine eigene PR unter dem Diff-Budget aus `AGENTS.md`.
Schritt 3 wird selbst in Teil-PRs zerlegt.

| # | Schritt | Beweis, dass er fertig ist |
|---|---|---|
| 1 | **Galerie-Adressierung**: `src/utils/document-navigation.ts` bekommt ein austauschbares Protokoll (Interface in `@ks/contracts`, Implementierung für Next in der App, für das Embed im Paket) statt zwei fest verdrahteter Routen und dem Rückfall auf `/library/gallery` | `tests/unit/utils/document-navigation-routen.test.ts` bleibt grün; neuer Test verbietet `next/navigation` im Galerie-Baum (Beweis-Ziel aus `00-audit-galerie.md` §5) |
| 2 | **Basis-URL** für die Modul-Fetches: `@ks/api-client` bekommt eine `baseUrl`; die App setzt sie leer (relativ), das Embed setzt sie auf die Instanz. Bewusst bis jetzt nicht eingebaut (Garantie G3, jetzt gibt es den Konsumenten) | Test: alle Explorer-Fetches gehen über den Client, keiner über ein nacktes `fetch('/api/…')` |
| 3 | **Galerie ins Paket** `@ks/module-explorer`, nach der Reihenfolge in [`02-audit-umzug.md`](02-audit-umzug.md) §4: erst Chat-Vokabular (`lib/chat/constants`) ins Paket, dann die 14 Kreuzverweise zu Slots/Props, dann Explore-Routen, Website, Story, Chat-UI, zuletzt die Galerie (100 Dateien, selbst zu teilen) | nach den Kreuzverweisen: ein Test, der Kreuzverweise zwischen den fünf Bereichen verbietet; nach jedem Umzug `pnpm typecheck:packages` und `pnpm build` lokal grün |
| 4 | **Hülle `@ks/embed`**: npm-Paket mit der Wurzelkomponente, CORS auf den Lese-Routen der Instanz für anonyme Zugriffe, Locale als Prop (`@ks/i18n`) | Paket baut isoliert; Lese-Routen antworten mit CORS-Headern nur für öffentliche Libraries |
| 5 | **Nachweis** in einer fremden Next-Anwendung: Demo-App (Frage `apps/embed-demo`, nur entscheiden) oder direkt bei AECED | Galerie rendert aus der fremden App gegen die Instanz, ohne Clerk, ohne App-Code |

## Was schon da ist (Vorgeschichte, Stand 2026-09-09)

- **M1 bis M4e erledigt**: Workspace und `@ks/viewers` (M1), `@ks/contracts`
  und `@ks/api-client` (M2), `@ks/shell` mit Host→SiteConfig-Auflösung (M3),
  Zugangs-Gate und API-Namensraum (M4), `@ks/ui` (M4b), `@ks/i18n` mit zwei
  Einstiegspunkten (M4c), `ClientLibrary` in `@ks/contracts` (M4d),
  Library-Auswahl als Hooks in `@ks/shell/react` (M4e). Briefs:
  `AGENT-BRIEF.md`, `-M2`, `-M3`, `-M4`, `-M4b`, `-M4c`, `-M4d`, `-M4e`.
- **Wurzelkomponente** (M4-Nachtrag 2026-08-28): `ExplorerRoot` liegt in
  `@ks/module-explorer/react`, `/explore/[slug]` ist nur der Montagepunkt (59
  Zeilen). Slug als Prop, Betrachter als zwei Booleans, Galerie und Hinweis
  als Slots. Kein Next-Routing, kein Auth-Anbieter im Modul. Der Wurzel-Test
  montiert ohne Router und ohne Clerk.
- **Galerie-Vorarbeiten** (Audit [`00-audit-galerie.md`](00-audit-galerie.md)):
  Galerie-Vertrag (`DocCardMeta` & Co in `@ks/contracts`, Fachlogik in
  `src/lib/documents/`), Galerie-Eine-Quelle (eine Werteliste statt dreizehn
  Kopien), Galerie-Betrachter (Betrachter wird hereingereicht, vier Felder)
  sind erledigt. **Galerie-Adressierung** ist Schritt 1 dieses Briefs.
- **Galerie-Chat-Mittelschicht** ([`01-audit-galerie-chat.md`](01-audit-galerie-chat.md)):
  die Kopplung ist fast nur Vokabular; `ChatReferenceList` liegt im
  Chat-Ordner und wird nur von der Galerie benutzt. Empfehlung: die
  Mittelschicht benennen statt den Chat mitzunehmen. Fällig in Schritt 3.
- **Umzugs-Messung** ([`02-audit-umzug.md`](02-audit-umzug.md)): 157 Dateien /
  24.821 Zeilen ohne `src/lib/chat` (Server-Stack, gehört nicht ins Paket).
  Fünf UI-Bereiche hängen über 14 Kreuzverweise zusammen, mit Zyklen Galerie
  ↔ Chat-UI und Galerie ↔ Website. Option B (Kreuzverweise zuerst, dann
  Bereich für Bereich) ist empfohlen.
- **Pakete pro `detailViewType`** wurden geprüft und verworfen; erneut prüfen
  erst in M6 per Bundle-Messung.
- **Grundlagen**: ADR [0007](../../adr/0007-modularisierung-monorepo-schale-module.md)
  und [0008](../../adr/0008-deployment-ziele.md) (seit 09.09. akzeptiert),
  [`modul-landkarte.md`](../../architecture/modul-landkarte.md) §5,
  [`migrations-strategie.md`](../../architecture/migrations-strategie.md)
  (Garantien G1 bis G5).

## Regeln, die aus früheren Wellen kommen

- **`pnpm build` lokal grün vor jedem Merge.** `check-build` an der PR fährt
  den Docker-Build nicht. Lehre aus M4b.
- **`pnpm typecheck:packages`** nach jedem Umzugsschritt: typprüft jedes
  Paket isoliert, ein Rückwärts-Import scheitert dort mit `TS2307`.
- **Verschieben, nie kopieren.** Teil-Extraktionen können `git log --follow`
  nicht halten (M4b-Korrektur); ganze Dateien bewegen.
- **Pakete halten ihre Atome intern** und exportieren nur Hooks (entschieden
  in M3, bestätigt in M4e).
- **Kein Auth-Anbieter im Modul.** Der Betrachter wird hereingereicht.
- **Verhaltensneutralität der Voll-App** ist Abnahmekriterium; die Explore-
  und Galerie-Tests sind das Netz.

## Mitgenommene alte Themen

- Galerie-Chat-Mittelschicht benennen (Schritt 3).
- `apps/`-Frage: nur entscheiden, ob es eine Demo-App unter
  `apps/embed-demo` gibt; die Next-App zieht nicht um.

## Neu dazugekommen

Punkte, die beim Bauen sichtbar werden, hier mit Datum eintragen und
zugleich in `docs/STAND.md` unter Vorhaben 1.

- (noch nichts)

## Hand-off

Jede Schritt-PR endet mit dem Hand-off-Block aus `AGENTS.md` §Hand-off.
Der nächste Schritt dieses Briefs ist die nächste Welle; der Name folgt der
Konvention `M5-<schritt>` (z. B. `M5-adressierung`, `M5-basis-url`,
`M5-umzug-1-chat-vokabular`).
