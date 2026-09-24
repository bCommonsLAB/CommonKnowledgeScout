---
name: d08-ergebnis-und-ingest
overview: "Detailkonzept D8: Tisch-Abschluss und Redaktions-Freigabe machen aus einer Fassung eine Ergebnis-Datei im Storage, die in den Suchindex kommt. Facetten organisation, gruppe, thema vor dem ersten Ingest, Ingest ohne Umweg über die Twin-Route, Organisation als Quellenangabe im Chat, Ergebnis-Ansicht ohne neuen Detail-Typ."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D8 · Ergebnis veröffentlichen und Ingest mit Quellenangabe

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md)
(Übergang ③, Klasse **E**: Original ist die Datei; E4 Facetten vor dem
ersten Ingest; E5 Quellenverweis), [D6](d06-verdichten.plan.md)
(Fassungskette). Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| T-S8b.2 Tisch-Abschluss | Der Tisch sieht am Beamer oder am eigenen Gerät, was er hinausgibt, und bestätigt einmal für alle: Konsens · Konsentiert mit Bedenken · Dissens · Neue Vorschläge; „Alle n Beiträge sind eingeflossen. Herausgenommen: k“ |
| T-S10.1 / E-S10.1 Ergebnis | Das Ergebnis auf Gruppenebene, mit Link auf die Beiträge |
| R-S8b Fassung freigeben | Die Redaktion macht aus dem bestätigten Entwurf die Fassung (Nummer der Fassungskette); nichts wird gelöscht |

## 2. Zwei Übergänge, ein Mechanismus

| Übergang | Wer | Was wird geschrieben | Suchindex |
|---|---|---|---|
| **Tisch-Abschluss** | Moderation, für den Tisch | `syntheses.confirmedByTable`; Ergebnis-Datei `…{Treffen}/Ergebnisse/{textstelle_id} Tisch {n} Entwurf.md` mit `ergebnis_stand: vom_tisch_bestaetigt` | **nein** |
| **Redaktions-Freigabe** | Redaktion | `syntheses.releasedByEditors[]`; neue Datei `…/Ergebnisse/{textstelle_id} Tisch {n} Fassung {k}.md` mit `ergebnis_stand: freigegeben`; in der Textstelle wird `gueltige_fassung` gesetzt (D10) | **ja** |

Das Ergebnis ist öffentlich auffindbar, **nachdem die Redaktion
freigegeben hat**. Owner-Entscheidung 21.09.: „Ergebnis nicht live am
ersten Tag, sondern nachgelagert“. Der vom Tisch bestätigte Entwurf ist
im Archiv lesbar, aber nicht im Index. Jede Fassung ist eine eigene Datei;
eine Datei wird nie überschrieben (D0, Klasse E).

Nach dem Tisch-Abschluss ist ein Widerruf von Beiträgen gesperrt (D3,
4.4; D5, 5).

## 3. Die Ergebnis-Datei

```markdown
---
docType: ergebnis
detailViewType: blog
ergebnis_id: shf-2026-t1-tisch2-hf2-ziel-01-f1
title: "Biodiversität · Ziel 1 — Fassung 1"
reihe_id: shf-2026
treffen_id: shf-2026-t1
tisch_id: shf-2026-t1-tisch2
textstelle_id: hf2-ziel-01
thema: Ziel 1 Lebensräume erhalten
handlungsfeld: Biodiversität
gruppe_tisch: 1
ergebnis_stand: freigegeben
fassung: 1
synthese_seq: 3
konsens_stufe: konsentiert_mit_bedenken
beitraege_gesamt: 11
beitraege_herausgenommen: 0
organisationen: ["Gemeinde Kastelbell", "Umweltverband X"]
gruppen: ["gem", "ngo", "wirt"]
date: 2026-11-13
authors: ["Tisch 2, Gruppe 1"]
source: Stakeholderforum Nachhaltigkeit 2026
tags: ["hf2", "ziel"]
---

(Fassung: Text aus „Zur Messung“ der bestätigten Synthese, redigiert.)

## Worauf sich der Tisch einigen konnte
…
## Mit Bedenken
…
## Einzelstimmen
… [^1]

[^1]: Beleg: Beitrag 7Q3K (Gemeinde Kastelbell)
```

- **Flach.** `organisationen` und `gruppen` sind Listen; das
  JSON-Schreiben und -Lesen von Listen trägt (`compose.ts:14`,
  `frontmatter.ts:127`).
- **Pflicht-Grundfelder** des Suchindex sind `title`, `date`, `authors`,
  `language`, `source` und `tags` (`BASE_REQUIRED_FIELDS`, `base-fields.ts:31-38`). Sie werden gesetzt,
  keine stillen Lücken. `authors` ist **die Gruppe**, nicht eine Person
  (Zuschreibung auf Gruppenebene).
- **Belege** stehen als Fußnoten mit Kurz-Id und Organisation. Die
  vollständige Belegspur (`beitragId`, `fileId`) bleibt in `syntheses`
  (MongoDB), Klasse V.
- **`detailViewType: blog`** ist eine bestehende Ansicht
  (`detail-view-type.ts:29-39`). Ein eigener Typ `ergebnis` würde die
  ganze Checkliste auslösen (`docs/contracts/detail-view-type-checklist.md`)
  und ist für das Fundament nicht nötig. `docType: ergebnis` ist ein
  freies Feld und trennt Ergebnisse von anderen Dokumenten.

## 4. Ingest

- **Direkt über `IngestionService.upsertMarkdown(userEmail, libraryId,
  fileId, fileName, markdown, meta?)`** (`src/lib/chat/ingestion-service.ts:94`),
  wie es die Promotion tut (`promote-actions.ts:97`).
- **Nicht** über die Route `POST /api/chat/[libraryId]/ingest-markdown`.
  Sie verlangt für eine gewöhnliche Datei eine Transformation im Shadow
  Twin und antwortet sonst mit 404 (`ingest-markdown/route.ts:90-107`).
- Das Frontmatter wird vollständig nach `docMetaJson` übernommen
  (`:283`). Jedes Feld ist damit im Index **gespeichert**.
- **Facetten** (E4, entschieden): In `config.chat.gallery.facets`
  (`dynamic-facets.ts:6-28`) kommen **vor dem ersten Ingest der Library**:

  | `metaKey` | `type` | `label` |
  |---|---|---|
  | `organisationen` | `string[]` | Organisation |
  | `gruppen` | `string[]` | Interessengruppe |
  | `handlungsfeld` | `string` | Handlungsfeld |
  | `thema` | `string` | Thema |
  | `docType` | `string` | Art |
  | `ergebnis_stand` | `string` | Stand |

  **Warum vorher:** Die Filterfelder des Vektorindex entstehen nur beim
  Anlegen des Index (`vector-repo.ts:497-501`). Eine später ergänzte
  Facette wirkt nicht als Filter, bis der Index neu gebaut und alles neu
  ingestiert ist. Das hält die Redaktion in der Checkliste „Library
  einrichten“ fest (D1, Freigabe prüft: Facetten vorhanden, sonst
  Warnung).

## 5. Organisation als Quellenangabe (E5)

Heute:
- Ein Chat-Quellenverweis ist `DocReference {number, fileId, fileName?,
  description, detailViewType?}` (`packages/contracts/src/doc-reference.ts:28-35`).
  Er entsteht in `orchestrator.ts:477-510`.
- Im Kontext des Modells stehen die Facetten-Werte schon
  (`chat/common/prompt.ts:88-116`). Das Modell „weiß“ also, von welcher
  Organisation ein Dokument ist, wenn `organisationen` eine Facette ist.

Vorschlag:
- `DocReference` um ein **optionales** Feld `sourceLabel?: string`
  erweitern (Contract-Änderung in `@ks/contracts`). Es wird im
  Orchestrator aus den Facetten-Werten gebildet, deren `metaKey` in einer
  Library-Einstellung `chat.referenceLabelKeys` steht (für das SHF:
  `['organisationen']`).
- Die Quellen-Liste zeigt es als zweite Zeile: „Gemeinde Kastelbell ·
  Positionspapier 2025“ (`chat-document-sources.tsx`, `reference-list.tsx`).
- Das gilt ebenso für **Organisations-Dokumente** (D0, Klasse Quelle). Ihr
  Frontmatter bekommt `organisationen: ["…"]` bei der Transformation. Die
  Vorlage der Library setzt es aus dem Ordnerpfad; das ist ein Feld der
  Vorlage, kein Code.

Die Alternative ohne Contract-Änderung wäre die Auflösung über
`docMetaJson` in der Oberfläche: Die Galerie-Daten sind schon da
(`use-gallery-data.ts:346-368`). Sie gilt aber nur in der Galerie-Ansicht,
nicht im reinen Chat. Deshalb der Vorschlag mit dem Contract-Feld.

## 6. Schnittstellen

### 6.1 Bestand

| Zweck | Bestand |
|---|---|
| Datei schreiben | Provider `uploadFile`; Ordner-Helfer aus D5 |
| Frontmatter | `createMarkdownWithFrontmatter` |
| Ingest | `IngestionService.upsertMarkdown` |
| Facetten | `library.config.chat.gallery.facets`, `FacetDef` (`dynamic-facets.ts`) |
| Quellenverweis | `DocReference`, `orchestrator.ts:477-510`, `chat-document-sources.tsx`, `reference-list.tsx` |
| Galerie-Liste | `GET /api/chat/[libraryId]/docs` (Facetten-Filter `:78-96`) |

### 6.2 Neu

| Baustein | Signatur |
|---|---|
| Ergebnis-Markdown (rein) | `buildResultMarkdown(synthesis, version, table, passage, counts, stage): {fileName, markdown}` |
| Tisch-Abschluss | `POST /api/deliberation/[libraryId]/tables/[tableId]/results/confirm {passageId, seq, konsensStufe}` |
| Redaktions-Freigabe | `POST …/results/release {passageId, seq, editedMarkdown?}` → neue Datei + Ingest + `gueltige_fassung` (D10) |
| Contract | `DocReference.sourceLabel?: string`; Einstellung `chat.referenceLabelKeys?: string[]` (Library-Config-Feld nach `library-config-field.md`) |
| Prüfung | Freigabe-Prüfbericht (D1) warnt, wenn die Facetten aus 4 fehlen |

## 7. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Ingest scheitert nach dem Schreiben der Datei | Die Datei bleibt (Original); die Freigabe meldet „nicht im Suchindex“ mit „erneut indexieren“ (Ingest ist idempotent je `fileId`) |
| Tisch-Abschluss ohne übernommene Fassung | 422 |
| Freigabe einer Fassung, die der Tisch nicht bestätigt hat | 409; ausdrückliche Übersteuerung durch die Redaktion mit Begründung (protokolliert) |
| Facette fehlt | Warnung in der Freigabe, kein Abbruch |

## 8. Tests

- `buildResultMarkdown`: Pflichtfelder, flache Listen, Fußnoten, keine
  Personennamen.
- Freigabe schreibt eine **neue** Datei je Fassung und überschreibt nie;
  `gueltige_fassung` wird gesetzt.
- Ingest-Aufruf mit `docType: ergebnis`; bei Fehler bleibt die Datei.
- Orchestrator: `sourceLabel` aus `referenceLabelKeys`; ohne Einstellung
  kein Feld (Verhalten wie heute).

## 9. Offene Fragen

1. Wird die Ergebnis-Datei vor der Redaktions-Freigabe redigiert (im
   Storage, Datei zuerst) oder in der App? Vorschlag: im Storage an der
   Entwurfsdatei. Die Freigabe übernimmt den Dateitext als Fassung.
2. Öffentliche Sicht: Die SHF-Library ist nicht öffentlich. Die
   anonymisierte öffentliche Sicht aus dem Angebot (Embed, ADR 0008) zeigt
   nur `ergebnis_stand: freigegeben`. Das ist ein eigenes späteres
   Vorhaben.
3. **Grenze redaktionell / inhaltlich (Owner 24.09., O20):** Wie weit
   darf die Redaktion eine vom Tisch bestätigte Fassung vor der Freigabe
   verändern? „Leicht redigieren“ ist keine Grenze. Vorschlag: Redaktionell
   sind Rechtschreibung, Zeichensetzung, Form, Verweise und Frontmatter;
   sie ändern den Sinn nicht. Jede Änderung am Sinn (Aussage, Reichweite,
   Zahl, Zuschreibung) ist eine **neue Fassung**, die der Tisch bestätigt,
   zur Not beim nächsten Treffen durch die Folgegruppe (D10). Die
   freigegebene Datei trägt `redigiert_von` und einen Hinweis, ob und wo
   der Text gegenüber der bestätigten Fassung abweicht; die bestätigte
   Entwurfsdatei bleibt unverändert liegen, damit der Vergleich möglich ist.

## 10. Aufwand

| Teil | PT |
|---|---|
| Ergebnis-Markdown, Tisch-Abschluss, Redaktions-Freigabe, Ingest | 1,5–2 |
| Contract-Feld `sourceLabel`, Einstellung, Anzeige in zwei Listen | 1 |
| Facetten-Prüfung in der Freigabe | 0,5 |
| **Summe D8** | **3–3,5** |
