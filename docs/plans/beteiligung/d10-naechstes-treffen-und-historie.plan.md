---
name: d10-naechstes-treffen-und-historie
overview: "Detailkonzept D10: Vom Ergebnis eines Treffens zum nächsten — gültige Fassung je Textstelle, Historie je Gruppe statt Änderungskaskade, Vision der ersten Gruppe (Foto → KI-Text → Stimme des Tisches), Folgegruppen mit passt · passt nicht · ergänzen, Druck je Gruppe über die Druckansicht."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D10 · Nächstes Treffen, Vision und Historie je Gruppe

**Grundlage:** [D1](d01-veranstaltung-aufsetzen.plan.md) (`gueltige_fassung`,
`gruppe`, `baut_auf`), [D3](d03-beitragen.plan.md) (Foto → Text),
[D7](d07-messen.plan.md) (Skala `followup3`),
[D8](d08-ergebnis-und-ingest.plan.md) (Ergebnis-Dateien). Entscheidungen
vom 21.09.: Historie je Gruppe statt Änderungskaskade; Vision nur von
Gruppe 1; Folgegruppen prüfen mit passt · passt nicht · ergänzen.
Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| M-S4.0 Vision erfassen | Foto des Flipcharts → KI-Text (bearbeitbar) → Abgleich mit der Vision der Textstelle → „Als Stimme des Tisches erfassen“ |
| T-S3.1 Themen am Tisch (Folgegruppe) | je Textstelle: Stand und das Ergebnis der Vorgruppe, aufklappbar |
| E-S6.1 / T-S6.1 (Folgegruppe) | Antwort passt · passt nicht · ergänzen zum Ergebnis der Vorgruppe |
| R-S12 Nächstes Treffen vorbereiten | Historie je Gruppe; Vision der Gruppe 1; „Als PDF je Gruppe drucken“ |

## 2. Gültige Fassung je Textstelle

- **Original** ist die Textstelle-Datei (D1). Ihr Body ist der
  **Ausgangstext** und wird nie überschrieben.
- Gibt die Redaktion eine Fassung frei (D8), wird in der Textstelle
  `gueltige_fassung: "[[… Fassung k.md]]"` gesetzt. Das ist ein
  Frontmatter-Patch mit `ersetzeTextDatei`, Datei zuerst (E1).
- Welche Fassung gilt, entscheidet die Redaktion, wenn mehrere Tische
  dieselbe Textstelle bearbeitet haben. Eine automatische Wahl gibt es
  nicht.
- Die **nächste Treffen-Freigabe** (D1) friert für die Agenda den Text
  der gültigen Fassung ein, sonst den Ausgangstext. `textHash` und
  `sourceRef` zeigen, woher er kam.
- In der Datenbank hält `text_passages.validVersionRef` den Verweis als
  Kopie (Klasse P).

## 3. Historie je Gruppe (berechnet, Klasse A)

`buildPassageHistory(libraryId, passageId): History` liest:
- die Ergebnis-Dateien mit `textstelle_id` (über den Index bzw. die
  Galerie-Liste mit Filter `textstelle_id`; bei Entwürfen, die nicht im
  Index stehen, über den Ordner `Ergebnisse/`);
- `syntheses` (Fassungskette, Bestätigung, Freigabe);
- die Auswertung der Messungen (`evaluate`, D7).

Daraus entsteht je Gruppe (in der Reihenfolge `gruppe` 1, 2, …) ein
Eintrag:

| Gruppe | Treffen | Stand | Konsens-Stufe | Ergebnistext | Belege |
|---|---|---|---|---|---|

Es gibt keine farbige Änderungskaskade im Text (Owner 21.09.: „zu
kompliziert“). Folgegruppen sehen den Text der Vorgruppe und klappen die
Historie auf. Nichts davon wird gespeichert; die Historie wird aus den
Originalen gerechnet.

## 4. Vision (Gruppe 1)

1. Der Agendapunkt der Art `vision` (D1) mit `textstelle_id` der Vision
   des Handlungsfelds.
2. **Foto:** Die Moderation nimmt das Flipchart im Composer auf (D3),
   `channel: 'note'`. Die Zuschreibung ist **der Tisch**:
   `attribution.participantId: 'tisch:<tableId>'`, `displayName: "Tisch
   2, Gruppe 1"`, `interestGroup: 'tisch'`. Das ist eine eigene Art von
   Teilnahme: Der Tisch spricht als Ganzes.
3. **KI-Text:** Foto → Text über den Bildweg aus D3 mit einer eigenen
   Vorlage `vision-foto-text-de`. Sie beschreibt Bildelemente und
   Stichworte, formuliert daraus eine Vision in wenigen Sätzen und
   erfindet nichts.
4. **Abgleich:** Neben dem KI-Text zeigt die Seite die Vision der
   Textstelle, ohne Diff (Wellen-Plan W3-E2). Die Moderation bearbeitet
   den Text mit dem Tisch.
5. **„Als Stimme des Tisches erfassen“** gibt den Beitrag ab (D3). Beim
   Fensterschluss wird er wie jeder Beitrag Datei (D5). Ordner ist der
   Tisch statt einer Organisation:
   `Veranstaltungen/{Reihe}/{Treffen}/Tisch {n}/Vision.md` mit dem Foto
   daneben. Das regelt eine eigene Pfadvorlage für `attribution` =
   Tisch.
6. Die Vision der Gruppe 1 wird dann **wie ein Ergebnis** bestätigt und
   freigegeben (D8). Folgegruppen sehen sie als gültige Fassung der
   Vision.

## 5. Folgegruppen

- Tische mit `gruppe` > 1 und `baut_auf` (D1) sehen je Textstelle die
  gültige Fassung und die Historie (3).
- **Antwort passt · passt nicht · ergänzen** ist eine Messung (D7) mit
  `scale: 'followup3'`. Ihre einzige Option ist die gültige Fassung
  (`origin: previous_group`).
- **„Ergänzen“** öffnet den Composer (D3) für dieses Thema. Die Ergänzung
  ist ein normaler Beitrag, der in die Synthese dieser Gruppe eingeht
  (D6).
- Auswertung: Mit überwiegend „passt“ und ohne Ergänzungen schlägt die
  App vor, die Fassung der Vorgruppe zu bestätigen. Das bestätigt der
  Tisch (D8) ohne neue Synthese.
- Variante „von 0“ (Wellen-Plan 4.2): Ein Feld `baut_auf_zeigen: false`
  am Tisch (D1) blendet die Historie aus. Die Daten bleiben. Etwa 0,5 PT.

## 6. Druck je Gruppe

- Einen PDF-Erzeuger auf dem Server gibt es im Bestand nicht (keine
  Bibliothek dafür in den Abhängigkeiten).
- Es gibt die Druckansicht mit `@media print` und `[data-print-flow]`
  (`src/styles/globals.css:203-231`, genutzt in
  `src/app/library/agent-view/page.tsx:38-41`).
- **Vorschlag:** eine Druckseite `/redaktion/[seriesId]/druck?gruppe=…`.
  Sie rendert die Historie je Textstelle und nutzt die Druckfunktion des
  Browsers („Als PDF speichern“). Es kommt keine neue Abhängigkeit dazu.

## 7. Schnittstellen

### 7.1 Bestand

| Zweck | Bestand |
|---|---|
| Datei-Feld versioniert setzen | `ersetzeTextDatei` |
| Foto → Text | Bildweg aus D3, `callImageAnalyzerTemplate` |
| Ergebnis-Dateien finden | `GET /api/chat/[libraryId]/docs` mit Facette `textstelle_id` bzw. Ordner-Listing |
| Druck | `[data-print-flow]`-Druckregeln |

### 7.2 Neu

| Baustein | Signatur |
|---|---|
| Gültige Fassung setzen | `setValidVersion(provider, passageFile, resultFileName)` (Teil der Redaktions-Freigabe, D8) |
| Historie (rein + Laden) | `buildPassageHistory(libraryId, passageId): History` |
| Tisch-Zuschreibung | `attribution.participantId: 'tisch:<tableId>'`; Pfadvorlage für Tisch-Stimmen |
| Vorlage | `vision-foto-text-de` |
| Skala | `followup3` in D7 |
| Seiten | Historie-Bereich in T-S3.1; Druckseite |

## 8. Tests

- `buildPassageHistory`: zwei Gruppen, eine ohne Freigabe (nur
  bestätigt), eine ohne Messung.
- Gültige Fassung: Die Treffen-Freigabe nimmt den Text der Fassung, sonst
  den Ausgangstext; `sourceRef` stimmt.
- Vision als Tisch-Stimme: Pfad beim Tisch, keine Organisation nötig.
- Folgegruppe: Messung `followup3` mit einer Option; „ergänzen“ führt zum
  Composer mit richtigem Kontext.

## 9. Offene Fragen

1. Wenn zwei Tische dieselbe Textstelle in einem Treffen bearbeiten: Wie
   führt die Redaktion zwei Fassungen zusammen? Das ist eine
   Redaktionsaufgabe (Datei zuerst); das Modell hält beide.
2. Soll der Druck je Gruppe auch die Einzelstimmen zeigen? Bei V1 nein.

**„Passt nicht“ ohne Fortsetzung (Owner 24.09., O19):** Für „passt
nicht“ ist nicht beschrieben, was folgt. Vorschlag: Begründung ist
Pflicht; die Antwort wird ein Beitrag mit `kind: einwand` auf die
gültige Fassung und geht in die Historie dieser Gruppe ein. Überwiegt
„passt nicht“ oder gibt es Ergänzungen, läuft der Punkt wie eine
normale Textstelle: Ernte, Verdichtung (D6), Messung (D7) und eine neue
Fassung der Folgegruppe; die Fassung der Vorgruppe bleibt in der
Historie sichtbar. Die Schwelle für „überwiegend“ ist festzulegen
(Prüfbericht §3, stille Fallbacks).

## 10. Aufwand

| Teil | PT |
|---|---|
| Gültige Fassung, Freigabe-Anbindung | 0,5 |
| Historie mit Tests | 1 |
| Vision als Tisch-Stimme, Vorlage | 1 |
| Folgegruppen (`followup3`, Ergänzen) | 0,5–1 |
| Druckseite | 0,5 |
| **Summe D10** | **3,5–4** |
