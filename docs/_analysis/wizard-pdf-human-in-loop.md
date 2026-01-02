---
title: Wizard PDF – Human-in-the-loop Ablauf (Upload → OCR → Markdown Review → Metadata)
date: 2026-01-02
status: draft
---

## Problem (Beobachtung)

Im aktuellen Wizard-Flow passiert nach PDF-Auswahl „hintenrum“ sehr viel:

- Job startet sofort im Hintergrund
- Quelle erscheint „plötzlich“
- Klick „Weiter“ springt direkt zu „Metadaten prüfen“, obwohl der Nutzer keine bewusste Bestätigung/Review gegeben hat

Das ist aus Anwendersicht verwirrend, weil OCR/Markdown-Erzeugung und Metadaten-Extraktion **zwei getrennte Schritte** sind.

## Ziel (UX)

Der Wizard soll den Nutzer linear führen („keep the human in the loop“):

1) **PDF auswählen**
2) **Weiter** startet **OCR/Extract** (Progress sichtbar)
3) **Markdown prüfen & ggf. korrigieren**
4) **Weiter** startet **Metadaten/Template (+ Ingest)** (Progress sichtbar)
5) **Metadaten prüfen**
6) Vorschau / Speichern

## Varianten (3)

### Variante A (empfohlen): Zwei Jobs + Review-Step (pipeline-konform)

- **Job 1**: Extract-only (mistral_ocr, pages/images), Policies: `extract=do`, `metadata=ignore`, `ingest=ignore`
- Review-Step: Nutzer editiert Transcript-Markdown
- **Job 2**: Template+Ingest-only, Policies: `extract=ignore`, `metadata=do`, `ingest=do`

**Vorteile**
- 1:1 Abbildung der Pipeline-Phasen
- Kein zusätzlicher LLM-Call für Metadaten (Template-Phase liefert Frontmatter)
- Nutzer kann vor Metadaten-Extraktion korrigieren

**Risiken**
- Update/Overwrite des Transcript-Files (Storage API hat kein „overwrite by id“ → delete+upload)

### Variante B: Ein Job (voll), aber UI-gated

- Job läuft sofort durch (extract+template+ingest)
- Review-Step zeigt Markdown erst nach completion, Metadaten sind aber bereits erstellt

**Vorteile**
- Kein zweiter Job

**Nachteile**
- Nutzer-Review beeinflusst Metadaten nicht mehr (zu spät)

### Variante C: Client-only Metadaten (neuer Secretary Call)

- Job 1: Extract-only
- Review-Step
- Metadaten via `/api/secretary/process-text` auf Basis des korrigierten Textes

**Vorteile**
- Keine zweite Job-Iteration

**Nachteile**
- Wieder ein paralleler Flow (wir wollten das vermeiden)
- Extra LLM-Kosten/Timeout-Risiko

## Entscheidung (v0)

Wir implementieren **Variante A** (zwei Jobs + Review-Step), weil sie am besten zur artefakt-zentrierten Pipeline passt und den Nutzer wirklich „in the loop“ hält.


