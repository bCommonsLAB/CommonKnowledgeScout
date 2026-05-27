---
name: diva-texture-liefersystem-integration
overview: "Anreicherung der DIVA-Texturanalyse mit deterministischen Stammdaten aus dem Liefersystem (api2_GetJsonOptionValues.json) und Umstellung des Templates auf ein FLACHES, Obsidian-kompatibles Preprocess-Frontmatter (snake_case, KI-Kernfelder + diva-Block). WICHTIG: Das Template ist NICHT Leas verschachteltes Material-Digital-Twin-Modell — dieses nested MongoDB-Objekt entsteht erst downstream aus den flachen Feldern + Cache-/Bitmap-Daten. Im 1. LLM-Pass wird pro Stoffgruppe (nicht pro Muster!) nur Class+Type+Confidence bestimmt; im 2. Pass die visuellen Properties + Farbe pro Muster. aiGenerationHints werden in jedem Lauf neu erzeugt und beziehen sich auf den zuletzt gelaufenen Pass (Pipeline-Feld last_pass). Der Anwender entscheidet manuell welches Quellbild (Basecolor vs. Liefersystem-Preview) verwendet wird. Quellen: docs/diva-texture-analysen/{material-digital-twin.md, besprechung-lea-materialien.md, api2_GetJsonOptionValues_sample.json}."
todos:
  - id: stufe-1-anzeige
    content: "Stufe 1 - Anzeige (umgesetzt & nach master gemergt): Library-Setting analyzeDivaTextureInfo, Sidecar-Loader, heuristischer Matcher, API-Route, neuer Tab 'DIVA-Info'. Tab wird im View-Modul image-view.tsx gerendert (NICHT file-preview.tsx; Welle-3-II hat Tabs in views/*-view.tsx verlagert). Tab zeigt Sidecar-Metadaten + beide Bilder nebeneinander (Basecolor vom Filesystem + Preview vom Sidecar-Image-URL) + Bildwahl-Toggle 'Quellbild fuer Analyse: [basecolor] [supplier-preview]'. Wahl wird im generischen Archiv-Property-Store (MongoDB archive_item_properties__<libraryId>) persistiert, gebunden an stabile Material-ID VCodex (analysisSourceImage) - NICHT im Frontmatter. Logging via FileLogger (kein Pino). Rein deterministisch, kein LLM-Call. Akzeptanz erfuellt: Flag setzbar, Tab erscheint bei Treffer, beide Bilder sichtbar, Bildwahl persistiert, Unit-Tests fuer Matcher, pnpm lint + pnpm test gruen."
    status: completed
  - id: stufe-2-template-refactor
    content: "Stufe 2 - FLACHES Preprocess-Template (PR feature/diva-texture-template-digital-twin): template-samples/Diva-Texture-Analysis.md ist ein flaches, Obsidian-kompatibles Frontmatter (snake_case, eine Ebene, KEINE Dot-Notation, KEINE nested Objekte). LLM-Felder: material_class, material_type (leer fuer ceramic/glass/plastic), confidence_class, confidence_type, needs_human_review (Pass 1); dominant_color_hex, color_family, color_description, surface_finish/surface_relief/pattern_scale/directionality/perceived_softness/color_variation, confidence_visual (Pass 2); ai_prompt_positive/ai_prompt_negative/ai_realism_notes (immer letzter Pass). Extraktiv aus dem Pfad: iln_nummer, textur_code, availability_scope, retailer_iln. Pipeline-/System-verwaltet (auskommentiert, NICHT im Schema): last_pass, pass1_status, pass2_status, analysisSourceImage, lieferSystemSnapshot, groupClassificationId, analysisRuns + technische Bild-Metadaten. Quellen-Map src/lib/diva-texture/material-field-sources.ts dokumentiert die Herkunft je Feld (Leas Legende, Lea-Regel #4) und liefert llmFieldsForPass(). materialSpecificProperties + color.rgb sind NICHT im Template (downstream). Akzeptanz: flaches Schema wird via template-service-mongodb.ts generiert (keine nested Container), Quellen-Map deckt alle LLM-Felder ab, pnpm lint + test gruen."
    status: completed
  - id: stufe-3-pipeline-erster-lauf
    content: "Stufe 3 - 1. LLM-Lauf NUR Class+Type+Confidence (PR feature/diva-texture-pipeline-first-pass): Pipeline-Job liest Sidecar + Bildwahl aus Stufe 1 und gibt Sidecar als LIEFERSYSTEM-Block ans LLM. Felder via llmFieldsForPass(1) aus der Quellen-Map: material_class, material_type, confidence_class, confidence_type, needs_human_review + ai_prompt_positive/ai_prompt_negative/ai_realism_notes (Hints laufen in jedem Pass mit). Pipeline setzt last_pass=1 + pass1_status. Regel: Liefersystem-Treffer = Class-Vorschlag = high-confidence (>=0.9); LLM darf nur material_type verfeinern; ceramic/glass/plastic erhalten keinen material_type. availability_scope/retailer_iln deterministisch aus Pfad. Mapping DE->EN (STOFF->fabric etc.) als Code-Tabelle (src/lib/diva-texture/material-class-mapping.ts). Akzeptanz: Lauf liefert valides Class+Type+Confidence-JSON, Sidecar-Treffer fuehrt zu Confidence >=0.9, Lauf ist idempotent."
    status: pending
  - id: stufe-4-gruppen-klassifikation
    content: "Stufe 4 - Stoffgruppen-Klassifikation in Galerie (PR feature/diva-texture-group-classification): Galerie-Ansicht gruppiert Texturen nach GroupName (Sidecar) bzw. groupIds (Material). Pro Gruppe ein Klassifikations-Dialog mit LLM-Vorschlag aus Stufe 3 (1x repraesentatives Bild, das beste Quellbild der Gruppe) + Confidence-Anzeige + 'Uebernehmen fuer X Mitglieder'-Button. Auto-Apply-Modus: bei Confidence >= Schwellwert (Library-Setting, default 0.9) kann User 'Alle ueber Schwelle automatisch uebernehmen' triggern. Single-Material-Override-Mechanismus, der nicht von Gruppen-Klassifikation ueberschrieben wird. Akzeptanz: Pro Gruppe nur 1 LLM-Call statt N, Bulk-Apply funktioniert, Override-Schutz funktioniert, Galerie zeigt Class+Type+Confidence pro Material."
    status: pending
  - id: stufe-5-pipeline-zweiter-lauf
    content: "Stufe 5 - 2. LLM-Lauf fuer visuelle Properties (PR feature/diva-texture-pipeline-second-pass): pro Muster (nicht pro Gruppe, weil visuelle Details variieren), nur nach Class+Type-Bestaetigung. Felder via llmFieldsForPass(2): dominant_color_hex, color_family, color_description, surface_finish, surface_relief, pattern_scale, directionality, perceived_softness, color_variation, confidence_visual + ai_prompt_*/ai_realism_notes (neu erzeugt). Pipeline setzt last_pass=2 + pass2_status. Liefersystem-Block weiterhin als Kontext (z.B. 'Eiche geoelt' aus Stammdaten). HINWEIS: materialSpecificProperties (klassenabhaengig, z.B. fabricProperties.fiberType, wood.grainType) gehoeren NICHT ins flache Template, sondern erst ins downstream MongoDB-Digital-Twin-Objekt. Akzeptanz: 2. Lauf produziert valide flache visuelle Felder, Confidence plausibel."
    status: pending
  - id: stufe-6-persistenz-am-material
    content: "Stufe 6 - Persistenz Liefersystem-Snapshot + Lauf-Historie (PR feature/diva-texture-persist-supplier-snapshot): Sidecar-Snapshot beim 1. Lauf in Material-Markdown-Frontmatter (lieferSystemSnapshot mit Timestamp + RawData) + Lauf-Historie (analysisRuns: Array mit Timestamp, passNumber, sourceImage, confidence, fieldsEvaluated, classifier (group|individual), groupClassificationId). Re-Analyse nutzt persistierten Snapshot ohne neuen Sidecar-Lookup. Akzeptanz: Historie nachvollziehbar im Frontmatter, idempotente Re-Analyse, Snapshot nicht verloren bei Sidecar-Aenderung."
    status: pending
  - id: stufe-7-migration-alter-analysen
    content: "Stufe 7 (optional) - Migration bestehender Texturanalysen (PR chore/diva-texture-migration): einmaliger Migrations-Script oder alte als deprecated markieren. Akzeptanz: Entscheidung explizit getroffen + dokumentiert."
    status: pending
  - id: rendering-integration-langfristig
    content: "Langfristig (out-of-scope dieser Welle): erzeugtes visualProperties + aiGenerationHints in Bild-Render-Pipeline (Stories, KI-Generierung) als Prompt-Bausteine nutzen. Voraussetzung: Welle abgeschlossen + Material-DB stabil."
    status: pending
isProject: false
---

# DIVA-Texture-Liefersystem-Integration

## 1. Ausgangslage

Die DIVA-Texturanalyse-Pipeline ([template-samples/Diva-Texture-Analysis.md](../../template-samples/Diva-Texture-Analysis.md))
arbeitet aktuell ausschliesslich auf Bilddaten — typisch ein einzelnes
`_basecolor.jpg`. Das Bild allein liefert oft zu wenig Information fuer eine
qualifizierte Analyse: flache Oberflaechen, kaum sichtbare Struktur, keine
Farbtiefe. Konfidenz niedrig, Ergebnis traegt nicht.

Parallel existiert pro Lieferanten-Verzeichnis (`S:\DIVA3DARCHIV\<ILN>\textures\_tex\`)
eine Sidecar-Datei `api2_GetJsonOptionValues.json` mit den Stammdaten aus dem
Liefersystem (Materialname, Stoffgruppe, RGB, Material-Klasse) **und einer
URL zu einem hochwertigeren Preview-Bild**. Diese Datei wird heute nicht
ausgewertet.

Zusaetzlich hat Lea ein neues Datenmodell vorgestellt
([Material Digital Twin](../../docs/diva-texture-analysen/material-digital-twin.md)),
das deutlich strukturierter ist als die aktuellen Frontmatter-Felder.

## 2. Zielbild als End-to-End-User-Journey

### 2.1 Personas

- **Library-Owner** (Peter / Operator): aktiviert das Feature pro Library,
  setzt Schwellwerte, steuert grobe Konfiguration.
- **Klassifizierer** (Lea / Fachhandel-Domain-Expert): geht durch die
  Texturen, prueft LLM-Vorschlaege, korrigiert oder uebernimmt.
- **Konsument** (Endsystem / Rendering / Story-Generator): liest die
  klassifizierten Materialdaten und nutzt sie fuer Folgeprozesse.

### 2.2 End-to-End-Workflow

**Phase A — Setup (einmalig pro Library, Library-Owner)**

1. Library-Settings oeffnen → Abschnitt "Transformation"
2. Toggle `DIVA-Liefersystem-Daten auswerten` aktivieren
3. Schwellwert `Auto-Uebernahme ab Konfidenz` einstellen (default 0.9)

→ ab jetzt erscheint im Archiv-File-Preview ein zusaetzlicher Tab `DIVA-Info`,
sobald eine Sidecar-Datei im Texturverzeichnis liegt UND ein Match fuer die
Textur existiert.

**Phase B — Daten-Sichtung + Bildwahl (pro Textur, Klassifizierer)**

1. Archiv oeffnen, Filter `_basecolor` aktiv → Galerie zeigt nur die
   relevanten Texturen
2. Textur anklicken → File-Preview rechts oeffnet sich
3. Tab `DIVA-Info` waehlen → zwei Bilder werden nebeneinander angezeigt:
   - Links: das `_basecolor.jpg` vom Filesystem (was die LLM bisher gesehen
     hat)
   - Rechts: das Preview-Bild aus dem Liefersystem (URL aus
     `OptionvalueEntry.Image`)
4. Klassifizierer entscheidet visuell, **welches Bild qualitativ besser ist**
   (klare Struktur, Schaerfe, Farbe, repraesentativ fuer das Material)
5. Auswahl ueber Radio-Button `Quellbild fuer Analyse`: `basecolor` oder
   `supplier-preview`
6. Auswahl wird im Material-Frontmatter persistiert (`analysisSourceImage`)
   — kein LLM-Call, rein deterministisch

→ ohne Auswahl gilt default `basecolor` (Status quo).

**Phase C — Gruppen-Klassifikation (1. LLM-Pass, Klassifizierer)**

Erkenntnis aus Lea-Besprechung: Materialien einer Stoffgruppe sind meist
dasselbe Material (`Feincord` → alles fabric/cord, `Glattleder Cognac` →
alles leather/smooth-leather). Klassifikation 1x pro Gruppe genuegt.

1. Galerie-Ansicht gruppiert Texturen nach `GroupName` (aus Sidecar) bzw.
   `groupIds` (aus Material-Frontmatter)
2. Pro Stoffgruppe gibt es einen Button `Gruppe klassifizieren`
3. System waehlt automatisch ein repraesentatives Bild der Gruppe
   (vorzugsweise: ein Material wo der Klassifizierer das `supplier-preview`
   gewaehlt hat; sonst irgendeines)
4. LLM-Pass 1 laeuft auf diesem 1 Bild → liefert: `materialClass`,
   `materialType`, `aiGenerationHints`, `confidence`
5. Dialog zeigt:
   - Vorschlag: "fabric / cord"
   - Konfidenz: 92%
   - Begruendung: "Webstruktur sichtbar, vertikale Rippen typisch fuer Cord"
   - Mitglieder der Gruppe (N Texturen)
   - Buttons: `Uebernehmen fuer alle N` / `Korrigieren` / `Verwerfen`
6. **Bulk-Auto-Apply-Modus**: Library-Owner kann "Alle Gruppen mit
   Konfidenz >= Schwellwert automatisch uebernehmen" triggern → Klassifizierer
   muss nur die unsicheren Faelle anschauen
7. **Override-Schutz**: hat ein einzelnes Material in der Gruppe schon eine
   individuelle Klassifikation, wird es von der Gruppen-Klassifikation NICHT
   ueberschrieben (es sei denn der User bestaetigt das explizit)

→ Ergebnis: alle Materialien der Gruppe haben Class+Type+Confidence;
Frontmatter-Feld `groupClassificationId` verweist auf den Gruppen-Lauf.

**Phase D — Visuelle Properties (2. LLM-Pass, Klassifizierer + System)**

Visuelle Properties (surfaceFinish, surfaceRelief, patternScale,
directionality, perceivedSoftness, colorVariation, materialSpecific) variieren
innerhalb einer Gruppe (z.B. unterschiedliche Cord-Farben, leicht
unterschiedliche Strukturen) → muss pro Muster laufen.

1. Voraussetzung: Material hat bereits Class+Type aus Phase C
2. Pro Muster (oder Bulk-Action "Alle in dieser Gruppe analysieren") laeuft
   LLM-Pass 2 mit:
   - Quellbild (aus Phase B gewaehlt)
   - Class+Type-Kontext (kein Re-Klassifizieren)
   - Liefersystem-Block (z.B. "Eiche geoelt" -> surfaceTreatment)
3. Ergebnis wird angezeigt + uebernehmbar/korrigierbar wie in Phase C

→ Material hat jetzt vollstaendiges `visualProperties`-Objekt.

**Phase E — Wiederverwendung (Konsument)**

Material-Markdown enthaelt jetzt:
- `lieferSystemSnapshot` (Stammdaten 1:1)
- `materialClass`, `materialType`, `visualProperties` (klassifiziert)
- `aiGenerationHints` (Prompt-Bausteine)
- `analysisRuns` (Historie: was wann mit welcher Konfidenz)
- `analysisSourceImage` (welches Bild war Quelle)
- `groupClassificationId` (welche Gruppen-Klassifikation hat Class+Type
  geliefert)

→ Galerie-Filter funktionieren auf den neuen Feldern. Folgeprozesse
(Rendering, Stories) koennen die Daten lesen.

### 2.3 Ablauf-Diagramm

```mermaid
flowchart TD
  setup[Phase A: Setup<br/>Library-Owner aktiviert Feature]
  sichtung[Phase B: Sichtung<br/>Klassifizierer waehlt Quellbild pro Material]
  pass1[Phase C: 1. LLM-Pass<br/>pro Gruppe -> Class + Type]
  pass2[Phase D: 2. LLM-Pass<br/>pro Muster -> visualProperties]
  konsum[Phase E: Konsum<br/>Folgeprozesse lesen Material]

  setup --> sichtung
  sichtung --> pass1
  pass1 -- Konfidenz hoch + Auto-Apply --> pass2
  pass1 -- Konfidenz mittel/niedrig --> korr1[Klassifizierer korrigiert]
  korr1 --> pass2
  pass2 -- Konfidenz hoch + Auto-Apply --> konsum
  pass2 -- Konfidenz mittel/niedrig --> korr2[Klassifizierer korrigiert]
  korr2 --> konsum
```

## 3. Aufbau in Stufen

| Stufe | Inhalt | Branch | Abhaengig von |
|-------|--------|--------|---------------|
| 0 | Setup (Plan + Quell-Docs + AGENT-BRIEF) | `feature/diva-texture-welle-setup` | — |
| 1 | Anzeige (Setting + Sidecar-Loader + Tab mit Bildwahl) | `feature/diva-texture-info-tab` | 0 |
| 2 | Template-Refactor auf Material Digital Twin | `feature/diva-texture-template-digital-twin` | — |
| 3 | 1. LLM-Pass (Class+Type+Confidence) | `feature/diva-texture-pipeline-first-pass` | 1, 2 |
| 4 | Gruppen-Klassifikation in Galerie | `feature/diva-texture-group-classification` | 3 |
| 5 | 2. LLM-Pass (visuelle Properties) | `feature/diva-texture-pipeline-second-pass` | 4 |
| 6 | Persistenz Liefersystem-Snapshot + Lauf-Historie | `feature/diva-texture-persist-supplier-snapshot` | 3 (kann parallel zu 4/5) |
| 7 | Migration alter Analysen (optional) | `chore/diva-texture-migration` | 5 |

## 4. Lea-Regeln (verbindlich)

Aus [docs/diva-texture-analysen/besprechung-lea-materialien.md](../../docs/diva-texture-analysen/besprechung-lea-materialien.md):

1. **Zwei Paesse**, weil feine visuelle Properties nur valide bewertbar sind,
   wenn Class+Type schon stehen.
2. **Liefersystem-Treffer = hohe Konfidenz fuer Class+Type** — kein LLM darf
   das ueberschreiben.
3. **"Nichts erfinden"** — wenn Information weder im Bild noch im
   Liefersystem steht, dann darf sie nicht im Output stehen.
4. **Konfidenz pro Feld + Quelle dokumentieren** — Felder die aus dem
   Liefersystem stammen, werden als solche markiert.
5. **Liefersystem-Snapshot am Material persistieren** — sonst kann der 2.
   Pass spaeter nicht mehr darauf zugreifen (Beispiel: "Eiche geoelt" steht
   nur in den Stammdaten, nicht im Bild).
6. **Quellbild-Wahl ist manuell** — der Klassifizierer entscheidet visuell,
   ob Basecolor oder Liefersystem-Preview besser ist. **KEIN automatisches
   Quality-Assessment durch LLM oder Heuristik.**
7. **Klassifikation pro Stoffgruppe statt pro Muster** — spart LLM-Calls und
   Klick-Aufwand bei groesseren Lieferungen.
8. **Template = flaches Preprocess, NICHT das Digital-Twin-Modell** — das
   Frontmatter ist flach + Obsidian-kompatibel (snake_case, eine Ebene, keine
   Dot-Notation, keine verschachtelten Objekte). Es liefert nur die KI-Kern-
   felder + den diva-Liefer-Block. Leas verschachteltes Material-Digital-Twin
   ist ein SPAETERES MongoDB-Objekt, das downstream aus den flachen Feldern +
   Cache-/Bitmap-Daten zusammengesetzt wird. Diese Trennung darf in keiner
   Folge-Stufe wieder aufweichen (siehe AGENTS.md "Frontmatter-Format").
9. **aiGenerationHints = letzter Pass** — ai_prompt_positive/ai_prompt_negative/
   ai_realism_notes werden in jedem Lauf neu erzeugt. Auf welchen Pass sie sich
   beziehen, haelt das Pipeline-Feld `last_pass` fest. Konfidenz ist pro Pass
   getrennt (confidence_class/confidence_type = Pass 1, confidence_visual =
   Pass 2) und der Pass-Status in pass1_status/pass2_status.

### Quellen-Map (Lea-Regel #4 maschinenlesbar)

Die Herkunft jedes Feldes ist in `src/lib/diva-texture/material-field-sources.ts`
kodiert (Leas Farb-Legende): `divadata` (Liefersystem) · `ai_pass1` (Klasse/Typ)
· `ai_pass2` (Farbe + visuelle Properties) · `ai_last_pass` (Hints) · `path`
(deterministisch aus Pfad) · `pipeline` (Status). `llmFieldsForPass(1|2)` liefert
die je Pass anzufragenden LLM-Felder; Folge-Stufen filtern darueber statt die
Feldlisten zu duplizieren. Leas gruene (umgesetzt) / rote (offen) Markierungen
sind Status, keine Quelle, und stehen daher nicht in der Map.

## 5. Mapping Sidecar → Material-Digital-Twin

Aus dem Sample [api2_GetJsonOptionValues_sample.json](../../docs/diva-texture-analysen/api2_GetJsonOptionValues_sample.json):

Ziel sind die FLACHEN Preprocess-Keys (snake_case), nicht das nested Modell.

| Sidecar-Feld | Preprocess-Feld (flach) | Bemerkung |
|--------------|-------------------------|-----------|
| `Name` | `title` | direkt |
| `GroupName` | (Slug fuer Gruppierung) | als ID-Slug normalisieren ("Feincord" → `feincord`) |
| `RGB` | `dominant_color_hex` | "#" voranstellen |
| `Material` (z.B. "STOFF") | `material_class` | Mapping-Tabelle DE→EN (material-class-mapping.ts) |
| `VCodex` / `PFTFile` / `TextureName` | `textur_code` / Matching-Key | heuristisch, mehrere Strategien |
| `Image` | UI-Vergleichsbild + Quellbild-Kandidat | als HTTP-URL geladen |
| `IsTexture` | Filter: nur "True" beruecksichtigen | sonst matcht z.B. "Stuetzfuss" |
| Pfad enthaelt `DivaStandardMaterials` | `availability_scope = "basic"` + `retailer_iln = ""` | — |
| Pfad enthaelt 13-stellige ILN | `availability_scope = "basic"` + `retailer_iln = <ILN>` | — |

### DE→EN-Material-Mapping (vorlaeufig, Stufe 3 finalisieren)

| Sidecar `Material` | Digital-Twin `materialClass` |
|--------------------|------------------------------|
| `STOFF` | `fabric` |
| `LEDER` | `leather` |
| `KUNSTLEDER` | `leather` (+ `materialType: faux_leather`) |
| `HOLZ` | `wood` |
| `STEIN` / `MARMOR` / `GRANIT` | `stone` |
| `METALL` | `metal` |
| `GLAS` | `glass` |
| `KUNSTSTOFF` / `LACK` | `plastic` |
| unbekannt | `null` + Warning, LLM darf bestimmen |

## 6. Edge-Cases (was schiefgehen kann)

| # | Szenario | Auswirkung | Behandlung |
|---|----------|------------|------------|
| 1 | Sidecar-Image-URL nicht erreichbar (Auth, Internet, alter Link) | Preview-Bild laedt nicht im Tab | Fallback-Icon, Hinweis "Liefersystem-Preview nicht verfuegbar", Basecolor bleibt nutzbar |
| 2 | Kein Match in Sidecar fuer eine Textur | Tab leer / nicht sichtbar | Tab erscheint nicht; im Footer-Log/Debug-Panel sichtbar warum kein Match (welche Strategien probiert wurden) |
| 3 | `IsTexture: "False"`-Eintrag matcht heuristisch eine Bilddatei | Falsche Stammdaten | Matcher filtert `IsTexture !== "True"` vor dem Match-Versuch |
| 4 | `Material`-Wert nicht im DE→EN-Mapping | `materialClass = null` | LLM darf in Pass 1 bestimmen, Confidence wird automatisch reduziert |
| 5 | Mehrere Sidecar-Eintraege matchen die gleiche Datei | Ambiguitaet | Logging aller Treffer; ersten nehmen + Warning im Tab "X Mehrfachtreffer, erster gewaehlt" + UI zum manuellen Wechseln |
| 6 | Stoffgruppe enthaelt Ausreisser (1 Lederteil in Stoff-Gruppe) | Gruppen-Klassifikation falsch fuer Ausreisser | Single-Material-Override: Klassifizierer setzt Material individuell, Gruppen-Update ueberschreibt nicht (Flag `classificationLocked: true` im Frontmatter) |
| 7 | Material gehoert (sollte) zu mehreren Gruppen | Aus Sidecar nur `GroupName` (singular) | Stufe 4 nutzt singular `GroupName`; spaeter ggf. `groupIds`-Erweiterung wenn API es liefert |
| 8 | User aendert nach Klassifikation die Bildwahl | Alte Klassifikation eventuell ueberholt | Marker im Material: `analysisSourceImageChangedAt > lastAnalysisRun.timestamp` → UI zeigt "Quellbild geaendert, Re-Analyse empfohlen" |
| 9 | Sidecar-Datei wird aktualisiert (neue Stammdaten) | Snapshot im Material veraltet | Sidecar-Hash im Snapshot mitspeichern; bei Mismatch UI-Hinweis "Stammdaten geaendert seit Klassifikation" |
| 10 | Mehrere Libraries teilen das gleiche Liefersystem | Caching-Frage | Sidecar wird pro Library-Storage-Lookup geladen, nicht global gecacht (KISS) |
| 11 | Bild im Liefersystem unterscheidet sich substanziell vom Filesystem-Bild (anderer Crop, andere Lieferung) | Klassifikation auf falschem Bild | Bildwahl ist explizit, Klassifizierer sieht beide nebeneinander; persistierter `analysisSourceImage`-Wert macht es nachvollziehbar |
| 12 | LLM liefert `needsHumanReview: true` | Material darf nicht ohne Review uebernommen werden | UI markiert mit roter Badge, Auto-Apply uebergeht das Material |
| 13 | Gruppen-Klassifikation laeuft auf einem Material, das selbst noch keine Quellbild-Wahl hat | Default `basecolor` verwendet | OK, Verhalten dokumentiert; UI zeigt im Gruppen-Dialog welches Bild fuer welches Mitglied benutzt wurde |
| 14 | Sidecar-Datei selbst fehlt im Verzeichnis | Tab erscheint nicht, kein Lookup | Status quo bleibt, keine Pipeline-Aenderung; UI-Hinweis im Library-Settings "Keine Sidecar-Datei im Library-Root gefunden" |
| 15 | API-Antwort gross (mehrere MB JSON) | Performance / Bandwidth | API-Route gibt nur den gematchten Eintrag zurueck, nicht das ganze JSON; Sidecar wird serverseitig geparst |
| 16 | User loescht ein Material nach Gruppen-Klassifikation | Stale `groupClassificationId`-Referenz | Klassifikations-Eintrag bleibt eigenstaendig, kein Cascading-Delete; Statistik kann zeigen "N Mitglieder verwaisen" |
| 17 | Klassifizierer setzt explizit "verwerfen" auf einen Vorschlag | Material soll NICHT klassifiziert sein | Flag `classificationRejected: true` im Frontmatter; Gruppen-Klassifikation faellt zurueck auf das naechste Mitglied als Repraesentanten |
| 18 | Renaming der Textur-Datei | Bestehende Klassifikation verloren (basiert auf filePath) | Klassifikation muss an stabiler ID haengen, nicht am Pfad — vermutlich Material-Slug |

## 7. Stolperfallen (Architektur + Implementierungs-Fallstricke)

| # | Stolperfalle | Gegenmassnahme |
|---|--------------|----------------|
| 1 | **LLM "korrigiert" die Liefersystem-Klassifikation eigenmaechtig** | System-Prompt expliziter: "Wenn LIEFERSYSTEM.materialClass gesetzt ist, MUSST du diese uebernehmen. Du darfst nur den materialType verfeinern." + Code-side-Validation, dass das LLM-Ergebnis kompatibel zur Sidecar ist |
| 2 | **Konfidenz wird inflationaer hoch ausgegeben** (LLMs neigen dazu) | Confidence-Kalibrierung: Sidecar-Treffer = automatisch 0.95 (deterministisch gesetzt, nicht vom LLM), LLM-only-Klassifikation = LLM-Wert kappen bei 0.8 max |
| 3 | **Race-Condition bei Bulk-Auto-Apply**: User triggert Apply, parallel laeuft Re-Analyse | Optimistic Locking via `version`-Feld im Frontmatter; UI zeigt "X Materialien wurden waehrend Apply geaendert, neu laden" |
| 4 | **`groupClassificationId` wird vergessen zu aktualisieren** bei Group-Re-Classification | Group-Classification ist eigenstaendiges Dokument (z.B. in MongoDB-Collection oder eigenes Markdown), Material referenziert nur die ID — Re-Classification erzeugt neue ID, Material-Update triggert sich daraus |
| 5 | **Storage-Abstraktion-Verletzung**: UI laedt das Liefersystem-Preview-Bild direkt vom Liefersystem-URL (umgeht den StorageProvider) | OK fuer Preview-Anzeige, weil Liefersystem ein eigenes System ist; aber: NICHT als Quellbild fuer LLM-Call ohne explizite Speicherung im Library-Storage. Pipeline laedt das Preview-Bild ggf. serverseitig herunter, bevor es ans LLM geht. |
| 6 | **Sidecar-Parsing ist sprachabhaengig** (`Material: "STOFF"` ist deutsch) | DE→EN-Mapping als reine Code-Tabelle (siehe Section 5); Tests fuer alle bekannten Werte |
| 7 | **Setting analyzeDivaTextureInfo gilt fuer ganze Library**, aber nicht jede Datei darin ist eine DIVA-Textur | OK: Tab erscheint nur bei Sidecar-Hit. Andere Dateien sehen den Tab nicht — kein Schaden. |
| 8 | **Frontmatter-Bloat**: 10+ neue Felder pro Material | Akzeptiert; Materialien sind kleine Markdown-Dateien, nicht performance-kritisch |
| 9 | **Pipeline-Job vs. UI-On-Demand**: Wo laeuft der Klassifikations-Call? | UI-On-Demand via API-Route mit Anthropic-SDK, kein Hintergrund-Job — der Klassifizierer wartet aktiv vor dem Dialog. Bei Bulk-Apply: Pipeline-Job, parallelisiert |
| 10 | **Schema-Evolution**: Material-Digital-Twin aendert sich noch | Schema-Version im Frontmatter (`schemaVersion: "1"`); Migration in Stufe 7 |
| 11 | ~~`docs/DIVA Textur Analysen/`-Pfad enthaelt Leerzeichen + Sonderzeichen~~ | **Geloest 2026-05-26**: umbenannt zu `docs/diva-texture-analysen/`, Dateien zu kebab-case |
| 12 | **CONTEXT-Block + LIEFERSYSTEM-Block widersprechen sich** (z.B. Dateiname-Hinweis vs. Sidecar-Name) | LIEFERSYSTEM hat Vorrang; System-Prompt explizit machen |

## 8. Branch-Naming

Konvention: `feature/diva-texture-*` fuer Code-Features dieser Welle,
`chore/diva-texture-*` fuer Migrationen / Aufraeumarbeiten. Abweichung von
`cursor/refactor-welle-*` ist bewusst, weil dies kein Refactor ist sondern
ein Feature-Build.

| Stufe | Branch |
|-------|--------|
| 0 (Setup) | `feature/diva-texture-welle-setup` |
| 1 | `feature/diva-texture-info-tab` |
| 2 | `feature/diva-texture-template-digital-twin` |
| 3 | `feature/diva-texture-pipeline-first-pass` |
| 4 | `feature/diva-texture-group-classification` |
| 5 | `feature/diva-texture-pipeline-second-pass` |
| 6 | `feature/diva-texture-persist-supplier-snapshot` |
| 7 | `chore/diva-texture-migration` (optional) |

## 9. Akzeptanzkriterien fuer die ganze Welle

- Vollstaendiges Material nach Digital-Twin-Modell wird fuer 5 manuell
  ausgewaehlte Test-Texturen (Candy Classics + weitere) erzeugt
- Liefersystem-Snapshot ist am Material persistiert und im UI einsehbar
- Bildwahl (Basecolor vs. Preview) ist persistiert und nachvollziehbar
- Gruppen-Klassifikation: ein Lauf pro Gruppe genuegt, Mitglieder uebernehmen
- Lauf-Historie zeigt was wann mit welcher Konfidenz erzeugt wurde
- Override-Mechanismus funktioniert (Einzel-Material schlaegt Gruppe)
- Pipeline laeuft idempotent (Re-Analyse aendert nichts wenn Inputs gleich)
- `pnpm lint` + `pnpm test` + `bash scripts/welle-pre-merge-check.sh` gruen

## 10. Aenderungs-Log

- 2026-05-26 — Plan angelegt
- 2026-05-26 — Plan grundlegend ueberarbeitet nach User-Feedback:
  - Stufe 4 von "LLM-Quality-Assessment" auf "Stoffgruppen-Klassifikation"
    umgestellt
  - Stufe 1 um manuelle Bildwahl + Preview-Bild-Anzeige erweitert
  - Stufe 3 enger gefasst (nur Class+Type+Confidence)
  - Zielbild als 5-Phasen-User-Journey ausgearbeitet
  - Edge-Cases-Tabelle (18 Eintraege) + Stolperfallen-Tabelle (12 Eintraege)
    hinzugefuegt
  - DE→EN-Material-Mapping als Tabelle in Section 5
- 2026-05-26 — Setup-PR-Vorbereitung:
  - Aktueller Branch `feature/library-diva-supplier-tab` umbenannt zu
    `feature/diva-texture-welle-setup` (= Stufe 0)
  - Stufe 1 erhaelt eigenen Branch `feature/diva-texture-info-tab`
  - Quell-Docs eingecheckt unter `docs/diva-texture-analysen/` (kebab-case)
  - Cloud-Workflow: pro Stufe ein Cloud-Agent, beginnend mit Stufe 1 nach
    Setup-Merge
  - AGENT-BRIEF unter `docs/refactor/diva-texture-liefersystem/AGENT-BRIEF.md`
- 2026-05-27 — Stufe 2 neu ausgerichtet (User-Entscheid):
  - Template ist FLACHES Preprocess-Frontmatter (snake_case, Obsidian-kompatibel),
    NICHT das verschachtelte Digital-Twin-Modell — Trennung als Lea-Regel #8
    festgehalten + projektweite Regel in AGENTS.md "Frontmatter-Format"
  - Nested-Schema-/Dot-Notation-Aenderungen am template-parser /
    template-service-mongodb zurueckgenommen (flacher Schema-Generator bleibt)
  - aiGenerationHints = letzter Pass (Pipeline-Feld `last_pass`), Konfidenz +
    Status pro Pass (Lea-Regel #9)
  - ceramic/glass/plastic ohne material_type; color.rgb + materialSpecific-
    Properties NICHT im Template (downstream MongoDB-Objekt)
  - Quellen-Map `material-field-sources.ts` als maschinenlesbare Fassung von
    Leas Farb-Legende (Lea-Regel #4) + `llmFieldsForPass()`
