 # Template‑Only Job Completion: savedItemId fehlt

## Kontext
Im Template‑Only Pfad der Start‑Route wird der Job als completed markiert, obwohl kein `result.savedItemId` gesetzt wird. Das verletzt den globalen Contract und führt zu Fehlern wie:
"Template‑Job ist completed, aber result.savedItemId (Transformation) fehlt oder ist ungültig."

## Beobachtung
`runTemplatePhase(...)` liefert ein `TemplatePhaseResult` mit optionalem `savedItemId`. Dieser Wert wird im Template‑Only Pfad aktuell nicht an `setJobCompleted(...)` übergeben.

## Ziel
Den Contract einhalten, indem `savedItemId` aus der Template‑Phase (falls vorhanden) an den Completion‑Schritt übergeben wird. Dadurch wird der Job nur dann als completed markiert, wenn die Transformation auch referenzierbar ist.

## Varianten
1) **Minimaler Fix (bevorzugt)**  
   `setJobCompleted(...)` im Template‑Only Pfad bekommt `result: { savedItemId: templateResult.savedItemId }`.  
   Vorteil: minimal, keine Nebenwirkungen, Contract wird erfuellt.

2) **Validierung vor Completion**  
   Wenn `savedItemId` fehlt, Job als `failed` markieren und klare Fehlermeldung setzen.  
   Vorteil: klare Diagnose, kein "silent complete".  
   Nachteil: mehr UI‑Folgen (Fehlerzustand).

3) **Deterministische Aufloesung im Start‑Pfad**  
   Wenn `savedItemId` fehlt, starte einen Resolver (wie in `complete.ts`).  
   Vorteil: selbstheilend.  
   Nachteil: zusaetzliche Storage‑Calls im Start‑Pfad.

## Entscheidung
Variante 1 wird umgesetzt, da sie den geringsten Eingriff darstellt und den Contract direkt erfuellt.
