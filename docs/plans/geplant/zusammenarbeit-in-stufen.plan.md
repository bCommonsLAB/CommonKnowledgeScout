---
name: zusammenarbeit-in-stufen
overview: "ADR 0011 umsetzen: Co-Creators arbeiten bewusst und sichtbar mit dem Speicherzugang des Owners; Urheberschaft (erstellt_von, im_namen_von) am Artefakt; drei Voreinstellungen (Lesen, Eigenes, Mitgestalten) und eine Prüfstelle auf dem Server; Commons-Libraries mit unveränderlichen Originalen. Löst A4 des Plans speicher-verbindungen-und-library-anlage ab."
status: geplant
umsetzung_ab: 2026-10-23
todos:
  - id: z1-urheberschaft
    content: "Z1 — Urheberschaft am Artefakt: erstellt_von und im_namen_von (flach, E-Mail) setzen in Pipeline (Transkript, Transformation über twin-core-stamp), beim Upload und Anlegen von Markdown (App, Brücke), am Twin-Dokument binärer Quellen (quelle_erstellt_von) und im Index-Eintrag (meta-document-builder). Migration Altbestand: Twins und Index-Einträge ohne Feld bekommen den Owner (Probelauf, --apply, Backup). Lesend sichtbar in dokument_lesen und der Datei-Vorschau."
    status: pending
  - id: z2-voreinstellung-pruefstelle
    content: "Z2 — Voreinstellung am Mitglied (LibraryMember.zugang: lesen | eigenes | mitgestalten; Map statt Enum) und eine Prüfstelle auf dem Server, durch die alle schreibenden Wege laufen (Storage-Routen, Brücken-Werkzeuge, Job-Start). Prüft Identität, Voreinstellung und erstellt_von; Ordner-Operationen prüfen alles darin. Bestehende Co-Creators werden mitgestalten (unverändertes Verhalten). Tests je Funktion × Voreinstellung × eigen/fremd."
    status: pending
  - id: z3-geliehener-zugang-sichtbar
    content: "Z3 — Geliehener Speicherzugang sichtbar: Freigabe je Mitglied beim Einladen (Voreinstellung wählen, Hinweis auf den geliehenen Zugang), Hinweis im Archiv („Sie arbeiten mit dem Speicherzugang von …\"), Spalte in der Mitgliederliste, im_namen_von wird bei jeder Handlung gesetzt."
    status: pending
  - id: z4-commons
    content: "Z4 — Commons: Freigabe als Commons mit Pflicht-Lizenz; Originale (Galerie-Inhalte, Transformationen) für alle unveränderlich, Owner ändert nur als neue Fassung; Kopieren in eine eigene Library mit abgeleitet_von und urheber_original (Quellkennung sourceContentHash aus W8-1); öffentlich Anzeigename statt E-Mail. Rohdateien später."
    status: pending
---

# Zusammenarbeit in Stufen

Entscheidung: [ADR 0011](../../adr/0011-zusammenarbeit-in-stufen.md)
(akzeptiert 2026-10-16). Die zehn Owner-Entscheide stehen dort als
Entscheidung; die Herleitung liegt im Archiv (Konzept vom 16.10.).
**Umsetzung ab 23.10.2026** (Owner).

## 1. Reihenfolge

| Welle | Hängt an | Diff | Modell |
|---|---|---|---|
| Z1 Urheberschaft + Migration | — | mittel | Opus (Pipeline-Contracts, Migration) |
| Z2 Voreinstellung + Prüfstelle | Z1 | mittel | Opus (sicherheitsrelevant) |
| Z3 Sichtbarkeit geliehener Zugang | Z2 | klein | Sonnet |
| Z4 Commons | Z1, Z2 | mittel | Opus |

Z2 setzt Z1 voraus: ohne `erstellt_von` lässt sich „eigen/fremd" nicht prüfen.
Bis Z2 läuft, behalten bestehende Co-Creators ihr heutiges Verhalten
(= Mitgestalten); nichts wird entzogen.

## 2. Berührte Stellen (vor Umsetzung am Code prüfen)

- Urheberschaft: `src/lib/shadow-twin/twin-core-stamp.ts`,
  `src/lib/external-jobs/storage.ts`, `extract-only.ts`,
  `src/lib/ingestion/meta-document-builder.ts`, Upload in
  `src/app/api/storage/**`, Brücke `src/lib/mcp/storage/**` und
  `sammeldatei_anlegen`. Contracts: `contracts-story-pipeline`,
  `frontmatter-single-serializer`, `shadow-twin-contracts`.
- Mitglieder: `src/types/library-members.ts`,
  `src/lib/repositories/library-members-repo.ts`,
  `src/app/api/libraries/[id]/members/route.ts`,
  `src/components/settings/members-list.tsx`, Einladung/Annahme.
- Prüfstelle: `src/lib/storage/server-provider.ts` (handelnder Nutzer ist schon
  bekannt), Storage-Routen, `src/lib/mcp/tool-shared.ts`, Job-Start.
- Commons: `publicPublishing` (Freigabe), Galerie-Lesepfad, neue Kopier-Route
  bzw. Brücken-Werkzeug.

## 3. Regeln, die gelten

- Frontmatter flach, snake_case; `generated_by` bleibt die Maschine.
- Keine stillen Fallbacks: ein Artefakt ohne `erstellt_von` nach der Migration
  ist ein Fehler; die Regel „ohne Angabe = Owner" gilt nur für Rohdateien ohne
  Twin und steht ausdrücklich im Code.
- Öffentliches Repo: im Code und in Tests nur erfundene E-Mails.
- Je Welle eine PR; `pnpm test`, `pnpm lint`, volle tsc-Prüfung vorher/nachher;
  `pnpm build` lokal beim Owner vor dem Merge.
