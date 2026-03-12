---
sidebar_position: 3
title: Features Excel-Import
---

# Schema-Spec: Features Excel-Import

Schema-Spec für den **Excel-Import von Features** (Konfigurationsmerkmale). Eine Zeile pro Feature. Dient als **LLM-Kontext** für die Transformation unstrukturierter Daten ins Excel-Format.

**Referenz im Code:** `idm-model/Dtos/Features/FeatureBase.cs`, `FeatureIdmBase.cs`, `FeatureWithId.cs`, `diva-common/Excel/ExcelIn.cs`

**Bedeutung laut IDML-Schema (DCC):** Im Element **FEATURE_DEFINITION** werden variantenabhängige Informationen hinterlegt. **FEATURE** definiert eine Variantenart. **FEATURE_NO** identifiziert die Variantenart; **FEATURE_TEXT** enthält die mehrsprachigen Texte; **SEQUENCE_NO** ist die herstellerspezifische Sortierung. Siehe [Referenz IDML (DCC)](./referenz-idml-dcc) und [DCC IDML 4.1.1 Dokumentation](https://www.dcc-moebel.org/dochtml/IDML_4_1_1_XML-Schema_Dokumentation/index.html).

---

## Tabellenstruktur

- **Eine Zeile pro Feature** – ab Zeile 2.
- **Zeile 1:** Spaltenüberschriften (Header) exakt wie in der Spalten-Spezifikation.
- Dictionary-Felder: pro Sprache eine Spalte mit Header `FeatureText_de`, `FeatureText_en` usw.

---

## Spalten-Spezifikation (Excel-Header)

| Excel-Header (Zeile 1) | Bedeutung | Datentyp | Mapping | Beispiel | Pflicht |
|------------------------|-----------|----------|---------|----------|--------|
| FeatureNo | Feature-Nummer | string | FeatureBase.FeatureNo | F-01 | ja |
| FeatureText_* | Feature-Text (pro Sprache) | string | `FeatureBase.FeatureText[Sprachcode]` | FeatureText_de, FeatureText_en | ja |
| OrganizationId | Organisations-ID | string | FeatureBase.OrganizationId | org-123 | nein |
| SequenceNo | Reihenfolge | int | FeatureIdmBase.SequenceNo | 1 | ja (IDM) |
| HeaderPosVariationType | Header-Positions-Variationstyp | string | FeatureIdmBase.HeaderPosVariationType | — | nein |
| FeatureT | Feature-Typ | string | FeatureIdmBase.FeatureT | — | nein |
| MeasureUnit | Maßeinheit | string | FeatureIdmBase.MeasureUnit | mm | nein |
| MeasureParameter | Maß-Parameter | string | FeatureIdmBase.MeasureParameter | — | nein |

**Hinweis zu FeatureText:** Pro Sprache eine Spalte mit Header `FeatureText_de`, `FeatureText_en` usw. (Sprachcode = Key im Dictionary).

---

## Beispiel: Excel-Tabelle (Header + eine Datenzeile)

| FeatureNo | FeatureText_de | FeatureText_en | OrganizationId | SequenceNo |
|-----------|----------------|----------------|----------------|------------|
| F-01 | Breite | Width | org-123 | 1 |

---

## Beispiel Markdown (LLM-Output zur Prüfung)

```markdown
| FeatureNo | FeatureText_de | FeatureText_en | OrganizationId | SequenceNo |
|-----------|----------------|----------------|----------------|------------|
| F-01 | Breite | Width | org-123 | 1 |
```
