---
title: Umbau von pdfanalyse-Template für Commoning & Sozialwissenschaften
date: 2025-12-16
status: draft
---

## Ausgangslage

Das bestehende Template `templates/pdfanalyse.md` ist inhaltlich auf Biodiversitäts-Dokumente ausgerichtet. Es kombiniert mehrere Quellen (Dokumenttext, Dateiname, Verzeichnispfad, Akronym-Mapping) und nutzt eine domänenspezifische Themen-Taxonomie.  
Für das neue Thema **Commoning / sozialwissenschaftliche Dokumente** ist die zentrale Anforderung: **Metadaten sollen primär aus dem Dokument selbst (v. a. Impressum/Colophon) extrahiert werden – nicht aus der Verzeichnisstruktur**.

Zusätzlich gibt es technische Rahmenbedingungen im Projekt:

- In mehreren Stellen ist `pdfanalyse` als Default-Template hinterlegt (Fallback-Logik).  
- UI/Mapper (`src/lib/mappers/doc-meta-mappers.ts`) lesen nur einen festen Satz Felder aus `docMetaJson` (z. B. `title`, `authors`, `year`, `topics`, `summary`, `source`, `issue`, `docType`, `commercialStatus`, `chapters`).
- Einige UI-Views erwarten technische Felder wie `filename`, `path`, `pathHints`, `isScan`.

Damit ist ein “radikaler” Schema-Bruch riskant, wenn er ohne zusätzliche Code-Anpassungen erfolgt.

## Drei Umbau-Varianten

### Variante A — Minimal kompatibel (empfohlen)

**Idee:** Neues Template mit identischem Feldschema wie `pdfanalyse.md`, aber mit:

- **Impressum-first Policy** (doc.meta > doc.heading > doc.toc > doc.text).  
- Pfad/Dateiname werden **nur** für technische Felder verwendet (`filename`, `path`, `isScan`), nicht zur inhaltlichen Ableitung von Autoren/Jahr/Topics.
- Austausch der kontrollierten `topics`-Vokabeln auf Commoning/Sozialwissenschaften.

**Vorteile:**

- Keine Änderungen an Mappers/UI erforderlich (geringes Risiko).
- Dokumentorientierte Extraktion wird durch Prompt-Policy erzwungen.
- Schnell iterierbar: Taxonomie/Regeln lassen sich im Template anpassen.

**Nachteile:**

- Einige sozialwissenschaftlich sinnvolle Felder (z. B. DOI/ISBN, Methoden, Forschungsfragen) werden nicht “erstklassig” in der UI abgebildet, solange Code-Mapping nicht erweitert wird.

### Variante B — Moderat erweitert (zusätzliche Felder, aber kompatibel gehalten)

**Idee:** Wie A, aber ergänzt um zusätzliche Felder im JSON (z. B. `doi`, `isbn`, `publisher`, `place`, `license`, `methodology`, `theoreticalFrameworks`, `caseStudies`).  
Die bestehenden Felder bleiben unverändert.

**Vorteile:**

- Höherer inhaltlicher Nutzen für sozialwissenschaftliche Arbeit.
- Zusätzliche Felder sind für RAG/Filter später wertvoll.

**Nachteile/Risiko:**

- UI/Mapper zeigen diese Felder derzeit nicht an; je nach weiterer Verarbeitung könnten unbekannte Keys an einzelnen Stellen “wegvalidiert” werden (z. B. bei Übersetzungsfunktionen mit Zod).
- Erfordert mittelfristig Code-Änderungen, wenn diese Felder sichtbar/benutzbar sein sollen.

### Variante C — Radikaler Umbau (bibliografisch/analytisch, Break-Change)

**Idee:** Komplett neues Schema nach bibliografischen Standards (Dublin Core / CSL-orientiert) plus qualitative Codes (z. B. “Governance-Mechanismen”, “Akteure”, “Commons-Typ”).  
Alte Felder würden entfallen oder umbenannt.

**Vorteile:**

- Beste Passung für sozialwissenschaftliche Metadaten + qualitative Analyse.

**Nachteile/Risiko:**

- Bricht bestehende UI/Mapper/Erwartungen.  
- Erfordert breite Code-Anpassungen und Migration von bestehendem Content.

## Entscheidung

Wir wählen **Variante A (minimal kompatibel)** als ersten Schritt. Begründung:

- Sie erfüllt die Kernanforderung (**Impressum-first, kein Pfad-Scoring**) ohne Code-Risiko.
- Sie ist reversibel und erlaubt schnelle Iteration am Prompt/Taxonomie-Teil.

Wenn sich zeigt, dass DOI/ISBN/Methoden etc. im Alltag nötig sind, ist Variante B der nächste sinnvolle Schritt – dann aber bewusst mit UI/Mapper-Erweiterung.











