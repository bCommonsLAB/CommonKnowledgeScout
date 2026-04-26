# Contracts: Modul `shadow-twin`

Stand: 2026-04-27. Erstellt vom Cloud-Agent (Welle 2, Plan-Schritt 2).

Bezug:
- Neue Rule: [.cursor/rules/shadow-twin-contracts.mdc](../../../.cursor/rules/shadow-twin-contracts.mdc)
- Architektur-Rule: [.cursor/rules/shadow-twin-architecture.mdc](../../../.cursor/rules/shadow-twin-architecture.mdc)
- Audit: [`00-audit.md`](./00-audit.md)
- Welle-1-Vorbild: [`docs/refactor/storage/02-contracts.md`](../storage/02-contracts.md)

## Was wurde gemacht

Die neue Rule
[`shadow-twin-contracts.mdc`](../../../.cursor/rules/shadow-twin-contracts.mdc)
definiert harte technische Invarianten auf Code-Ebene und ergaenzt die
bereits existierende Architektur-Rule (`shadow-twin-architecture.mdc`).

Die Architektur-Rule erklaert das **Warum**: ArtifactKey-Determinismus,
Storage-Abstraktion in der UI-Schicht, virtuelle Mongo-IDs. Die neue
Contract-Rule erklaert das **Wie genau**: Welche Funktionssignatur, welcher
Fehlertyp, welche erlaubten Imports.

### Sektionen der neuen Rule

| Sektion | Inhalt | Bezug zu Welle 2 |
|---|---|---|
| §1 ArtifactKey-Determinismus | `templateName` Pflicht fuer `transformation`, verboten fuer andere; Reihenfolge der Argumente fest | Char-Tests in Schritt 3 verifizieren das |
| §2 Fehler-Semantik | Welche Inputs werfen, welche Catches sind erlaubt, welche Anti-Pattern verboten | Verstaerkt `no-silent-fallbacks.mdc` fuer das Modul |
| §3 Erlaubte / verbotene Abhaengigkeiten | `src/lib/shadow-twin/**` darf nicht von UI-Code abhaengen | Schuetzt vor Drift |
| §4 Skip- / Default-Semantik | `primaryStore` ist Source of Truth fuer Writes; Fallbacks nur fuer Reads dokumentiert erlaubt | Begruendet bestehende Service-Logik |
| §5 Helper statt direkter Config-Zugriffe | `getShadowTwinConfig` + `isFilesystemBacked` (aus Welle 1) | Verbietet Drift in spaeteren Wellen |
| §6 Store-Architektur | Strategy-Pattern; Pflicht-Interface `ShadowTwinStore` | Definiert Erweiterungspunkt fuer kuenftige Stores |
| §7 Review-Checkliste | 7 Punkte fuer jede shadow-twin-Code-Aenderung | Selbstkontrolle in Schritt 4 |

## Audit-Findings, die in dieser Rule landen

Aus [`00-audit.md`](./00-audit.md):

- "ArtifactKey ist deterministisch" → §1 (technisch verankert).
- "Storage-Abstraktion in shadow-twin" → §3 + §5 (Imports + Helper).
- "Mongo-virtuelle IDs duerfen nicht an Provider" → §2.
- "Strategy-Pattern fuer Stores" → §6 (Pflicht-Interface).

## Audit-Update fuer `external-jobs-integration-tests.mdc`

Aus dem Audit als "optional" eingestuft. **Nicht in dieser Welle umgesetzt**,
weil:

- Die Cross-Reference auf `shadow-twin-contracts.mdc` ist Komfort, kein Vertrag.
- Die external-jobs-Rule wuerde dadurch laenger ohne neue normative Aussage.
- Folge-PR-Kandidat (siehe `06-acceptance.md` "Folge-PRs").

## Was die Rule nicht regelt

Bewusst **out of scope** in Welle 2:

- **Datenformate** der Binary-Fragments (z.B. Image-Variants
  Original/Thumbnail/Preview) → bereits in `media-lifecycle.mdc` und
  `store/shadow-twin-store.ts` typisiert.
- **API-Route-Vertraege** unter `src/app/api/library/[libraryId]/shadow-twins/**`
  → eigene Rule kann in spaeterer Welle entstehen, falls noetig.
- **Konkrete Mongo-Schemata** → `src/lib/repositories/shadow-twin-repo.ts`
  ist die Quelle, nicht hier zu duplizieren.

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 3 | Char-Tests **gegen** §1, §2 schreiben | `tests/unit/shadow-twin/analyze-shadow-twin-*.test.ts`, `shadow-twin-migration-writer-*.test.ts` |
| 4 | §5 (Helper-Bevorzugung) als Code-Review-Pruefung anwenden; ggf. Code-Aenderungen | `src/lib/shadow-twin/`, `src/components/library/` |
| 6 | Doku-Hygiene aus `00-audit.md` (analysis-Files archivieren) | spaetere Folge-PR |
| 7 | Vertrag in `06-acceptance.md` als "Methodik-DoD: Contract-Rule existiert" abnehmen | `06-acceptance.md` |
