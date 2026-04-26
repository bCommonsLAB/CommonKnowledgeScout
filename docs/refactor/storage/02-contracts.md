# Contracts: Modul `storage`

Stand: 2026-04-26. Erstellt vom Cloud-Agent (Welle 1, Plan-Schritt 2).

Bezug:
- Neue Rule: [.cursor/rules/storage-contracts.mdc](../../../.cursor/rules/storage-contracts.mdc)
- Architektur-Rule (alwaysApply): [.cursor/rules/storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc)
- Audit-Vorlage: [`00-audit.md`](./00-audit.md)
- Pilot-Vorbild: keine `02-contracts.md` in external-jobs (dort wurde Rule
  in-place geupdated). Hier neu erstellt, weil noch keine Modul-Contract-Rule
  existierte.

## Was wurde gemacht

Die neue Rule [`storage-contracts.mdc`](../../../.cursor/rules/storage-contracts.mdc)
definiert harte technische Invarianten auf Code-Ebene und ergaenzt die
bereits existierende Architektur-Rule (`storage-abstraction.mdc`).

Die Architektur-Rule erklaert das **Warum**: UI darf storage-agnostisch sein,
Factory ist einziger Einstiegspunkt. Die neue Contract-Rule erklaert das
**Wie genau**: Welche Funktionssignatur, welcher Fehlertyp, welche erlaubten
Imports.

### Sektionen der neuen Rule

| Sektion | Inhalt | Bezug zu Welle 1 |
|---|---|---|
| §1 Determinismus & Vertrag | `StorageProvider`-Interface ist Pflicht-Subset, optionale Methoden via Feature-Detection | Sichert Char-Tests in Schritt 3 |
| §2 Fehler-Semantik | Welche Inputs werfen, welche Catches sind erlaubt, welche Anti-Pattern verboten | Begruendet Silent-Catch-Fix in Schritt 4 (`onedrive-provider.ts:2092`) |
| §3 Erlaubte / verbotene Abhaengigkeiten | `src/lib/storage/**` darf nicht von UI-Code abhaengen, ausser API-Route → Storage | Schuetzt vor Drift, der in Welle 9d (file-preview) aufgeraeumt wird |
| §4 Skip- / Default-Semantik | `getProvider()` hat keinen Default-Provider, `setLibraries([])` ist dokumentierter Sonderfall | Verbietet stille Fallbacks |
| §5 Helper statt `library.type`-Checks | Neuer Helper `isFilesystemBacked` ersetzt direkte Type-Checks in UI/Hooks | Pflicht-Migration `file-preview.tsx:1134` in Schritt 4 |
| §6 OneDrive-Sub-Module | Verzeichnis-Struktur fuer den Schritt-4-Split (5 Sub-Files + Fassade + OAuth-Helper) | Definiert Ziel-Struktur **vor** dem Split, damit Char-Tests die richtige API testen |
| §7 Review-Checkliste | 6 Punkte fuer jede Storage-Code-Aenderung | Selbstkontrolle in Schritt 4 |

## Audit-Findings, die in dieser Rule landen

Aus [`00-audit.md`](./00-audit.md):

- "Architektur-Anmerkung: silent-Catch in `onedrive-provider.ts:2092`" → §2.
- "Helper `isFilesystemBacked()` einfuehren" → §5 (verankert die
  Migration als Vertrag, nicht nur als Empfehlung).
- "OneDrive-Sub-Module" → §6 (legt die Struktur **vor** dem Split fest,
  damit die Char-Tests in Schritt 3 den Ziel-API-Vertrag pruefen).
- "Pre-Flight-Entscheidungen" (Mongo-Factory ist tot, OAuth-Server ist kein
  Strangler-Fig) → §6 (`oauth-server.ts` als bewusst eigener Helper
  dokumentiert).

## Audit-Update fuer `external-jobs-integration-tests.mdc`

Aus dem Audit als "optional" eingestuft. **Nicht in dieser Welle umgesetzt**,
weil:

- Die Cross-Reference auf `storage-contracts.mdc` ist Komfort, kein Vertrag.
- Die external-jobs-Rule wuerde dadurch laenger ohne neue normative Aussage.
- Folge-PR-Kandidat (siehe `06-acceptance.md` "Folge-PRs").

## Was die Rule nicht regelt

Bewusst **out of scope** in Welle 1:

- Storage-spezifische **Datenformate** (z.B. wie PDF-Fragments in
  `binaryFragments` strukturiert sind) → `media-lifecycle.mdc`.
- **API-Route-Vertraege** unter `src/app/api/storage/**` (Request/Response-
  Shape) → eigene Rule kann in spaeterer Welle entstehen, falls noetig.
- **Retry-/Rate-Limit-Strategie** im OneDrive-Provider → in Schritt 4
  durch den `cache.ts`-Sub-Modul abgegrenzt, aber nicht als Vertrag
  formuliert (Implementierung darf sich aendern, solange das Verhalten
  beobachtbar bleibt).

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 3 | Char-Tests **gegen** §1, §2 schreiben | `tests/unit/storage/onedrive-provider-*.test.ts`, `storage-factory-provider-selection.test.ts` |
| 4 | §2 (Silent-Catch) + §5 (Helper) + §6 (Split) implementieren | `src/lib/storage/onedrive/`, `library-capability.ts`, `file-preview.tsx:1134` |
| 6 | Tote Code-Pfade aus §6-Migration knip-bestaetigen + loeschen | `storage-factory-mongodb.ts`, alte `onedrive-provider-server.ts` |
| 7 | Vertrag in `06-acceptance.md` als "Methodik-DoD: Contract-Rule existiert" abnehmen | `06-acceptance.md` |
