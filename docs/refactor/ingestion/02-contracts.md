# Contracts: Modul `ingestion`

Stand: 2026-04-27. Erstellt vom IDE-Agent (Welle 3, Plan-Schritt 2).

Bezug:
- Neue Rule: [.cursor/rules/ingestion-contracts.mdc](../../../.cursor/rules/ingestion-contracts.mdc)
- Pipeline-Rule (Verbindung): [.cursor/rules/ingest-mongo-only.mdc](../../../.cursor/rules/ingest-mongo-only.mdc)
- Audit: [`00-audit.md`](./00-audit.md)
- Welle-2-Vorbild: [`docs/refactor/shadow-twin/02-contracts.md`](../shadow-twin/02-contracts.md)

## Was wurde gemacht

Die neue Rule
[`ingestion-contracts.mdc`](../../../.cursor/rules/ingestion-contracts.mdc)
definiert harte technische Invarianten auf Code-Ebene fuer das Modul
`src/lib/ingestion/` und ergaenzt die bestehenden Pipeline-Rules
`ingest-mongo-only.mdc` und `contracts-story-pipeline.mdc`.

Die Pipeline-Rule `ingest-mongo-only.mdc` erklaert das **Warum** auf
Pipeline-Ebene (kein Fallback fuer Ingest-Quellen). Die neue Rule
erklaert das **Wie genau** auf Funktions-/Fehler-Ebene fuer die Helper
unter `src/lib/ingestion/`.

### Sektionen der neuen Rule

| Sektion | Inhalt | Bezug zu Welle 3 |
|---|---|---|
| §1 Determinismus | Pure Helper sind seiteneffekt-frei; `ImageProcessor` hat Cache und ist NICHT pure | Char-Tests in Schritt 3 verifizieren das (mit `clearImageCache` in `beforeEach`) |
| §2 Fehler-Semantik | Result-Objekt-Pattern fuer Bilder; bewusste `try/catch` mit Logging und Kommentar erlaubt | Verstaerkt `no-silent-fallbacks.mdc` und `ingest-mongo-only.mdc` |
| §3 Erlaubte / verbotene Abhaengigkeiten | `src/lib/ingestion/**` darf nicht von UI- oder Aufrufer-Code (`ingestion-service`) abhaengen | Schuetzt vor zyklischen Imports |
| §4 Skip- / Default-Semantik | Pure Helper liefern leere Strings/Arrays bei leerer Eingabe (kein Wurf); Timestamps explizit nicht-deterministisch | Begruendet bestehendes Verhalten + erleichtert Tests |
| §5 Cache-Vertrag (`ImageProcessor.imageCache`) | Klassen-statisch, `private`, `clearImageCache` in Tests Pflicht | Verhindert Test-Kreuz-Kontamination |
| §6 Mongo-Only-Vertrag | Verbindung zu `ingest-mongo-only.mdc`; einzelne Bild-Provider-Lookups sind erlaubt, Quell-Dokumente nicht | Verankert Pipeline-Rule auf Helper-Ebene |
| §7 Review-Checkliste | 8 Punkte fuer jede ingestion-Code-Aenderung | Selbstkontrolle in Schritt 4 |

## Audit-Findings, die in dieser Rule landen

Aus [`00-audit.md`](./00-audit.md):

- "Es gibt keine modul-spezifische Contract-Rule fuer `ingestion`" →
  durch diese neue Rule geloest.
- "`image-processor.ts` hat bewusste `try/catch`-Bloecke mit Logging" →
  §2 (erlaubte gefangene Fehler mit Kommentar + Logger).
- "`ImageProcessor` hat klassen-statischen Cache" → §1 (Determinismus
  ausser Cache) + §5 (Cache-Vertrag).
- "Mongo-Only-Regel ist Pipeline-Ebene, nicht Helper-Ebene" → §6
  (explizite Verbindung).

## Audit-Update fuer `ingest-mongo-only.mdc`

Aus dem Audit als "optional" eingestuft. **Nicht in dieser Welle umgesetzt**,
weil:

- Die Erweiterung der Glob-Liste auf `src/lib/ingestion/**/*.ts` ist
  Komfort (Rule wuerde dann auch bei Edits in `image-processor.ts` triggern),
  aber kein neuer Vertrag.
- Die neue `ingestion-contracts.mdc` triggert ohnehin auf den
  `src/lib/ingestion/`-Globs und verweist auf `ingest-mongo-only.mdc`.
- Folge-PR-Kandidat (siehe `06-acceptance.md` "Folge-PRs").

## Was die Rule nicht regelt

Bewusst **out of scope** in Welle 3:

- **Embedding-Modelle** (welches LLM, welche Dimensionen) → eigene
  Rule/Doku in `docs/architecture/mongodb-vector-search.md`.
- **Vector-Index-Strategie** → eigene Welle (Chat/Search).
- **Konkrete Mongo-Schemata** → `src/lib/repositories/vector-repo.ts` und
  `metadata-repo.ts` sind die Quelle.
- **Aufrufer `src/lib/chat/ingestion-service.ts`** → ist NICHT Teil von
  `src/lib/ingestion/`, gehoert in eine spaetere Chat-/Pipeline-Welle.
- **Markdown-Page-Splitter-Doppelimplementierung** (`splitByPages` vs.
  `splitMarkdownByPageMarkers`) → siehe Audit-Watchpoint, wird in
  Schritt 4 untersucht (Analyse, keine Konsolidierung).

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 3 | Char-Tests **gegen** §1, §2, §4 schreiben (mit `clearImageCache` in `beforeEach`) | `tests/unit/ingestion/*-*.test.ts` |
| 4 | §1 (Pure Helper) als Anlass fuer Helper-Extract aus `image-processor.ts` | `src/lib/ingestion/`, ggf. neue Helper-Datei |
| 4 | Duplikat-Verdacht `splitByPages` vs. `splitMarkdownByPageMarkers` analysieren | `04-altlast-pass.md` Notiz |
| 6 | Doku-Hygiene: `docs/analysis/ingestion.md` Helper-Files erwaehnen | direkt oder Folge-PR |
| 7 | Vertrag in `06-acceptance.md` als "Methodik-DoD: Contract-Rule existiert" abnehmen | `06-acceptance.md` |
