# Analyse: Structured Output – Schema-Entschärfung + serverseitige Normalisierung (suggestedQuestions)

## Problem
Im Chat-Flow wird Structured Output (JSON) zusätzlich durch ein Zod-Schema validiert. Das ist als letzte Sicherheitsstufe sinnvoll, führt aber bei einigen LLM-Modellen regelmäßig zu **SchemaValidationError**, wenn die Ausgabe „fast korrekt“ ist (z.B. `suggestedQuestions` nicht exakt 7 Items, Duplikate, Leerstrings).

Das Feld `suggestedQuestions` ist primär **UX-orientiert** (UI erwartet stabile Vorschläge), während `usedReferences` zur Quellenanzeige genutzt wird, aber downstream bereits ein Fallback existiert (bei leer/fehlend können alle References angezeigt werden).

## Lösungsvarianten (3 Optionen)
- **Variante A: Retries bei SchemaValidationError**  
  Bei Validierungsfehlern 1–2x erneut anfragen (idealerweise ohne Cache, ggf. mit niedrigerer Temperature).  
  Pro: schnell, robust gegen Transients. Contra: höhere Kosten/Latenz.

- **Variante B: Schema entschärfen + serverseitig normalisieren (gewählt)**  
  Validierung nur für „harte“ Anforderungen nutzen, UX-Felder weniger strikt validieren und danach deterministisch normalisieren (z.B. immer 7 `suggestedQuestions`).  
  Pro: weniger fragil, stabilere UI, geringe Mehrkosten. Contra: etwas mehr Serverlogik.

- **Variante C: Repair-Pass**  
  Bei Schemafehlern die fehlerhafte JSON + Validierungsfehler zurück an das Modell geben und nur „reparieren“ lassen.  
  Pro: sehr robust. Contra: mehr Implementationsaufwand.

## Entscheidung
Wir setzen **Variante B** um und ergänzen zusätzlich eine leichte Form von **Variante A** (Retry):
- `suggestedQuestions`: nicht mehr exakt 7 validieren, sondern **min(1)** und **max(12)**; danach serverseitig auf **genau 7** normalisieren.
- `usedReferences`: optional machen und serverseitig auf `[]` defaulten, weil downstream bereits ein Fallback existiert.

Zusätzlich:
- **Retry bei `SchemaValidationError`** in `callLlmJson()` (1–2 Versuche):
  - Retries laufen **ohne Cache** (`useCache: false`)
  - Temperature wird für Retries auf **≤ 0.2** gesenkt (stabileres Structured Output)

Diese Lösung reduziert Schema-Fehler erfahrungsgemäß deutlich, ohne die UI-Anforderungen aufzugeben.


