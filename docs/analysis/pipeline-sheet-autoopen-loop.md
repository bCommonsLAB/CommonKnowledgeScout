## Problem
Im Flow View öffnet sich das Panel **„Aufbereiten & Publizieren“** automatisch, wenn keine Shadow‑Twin Artefakte vorhanden sind. Wenn der Nutzer den Dialog schließt, geht er **sofort wieder auf**.

## Beobachtung (Root Cause)
Die Auto‑Open‑Logik hängt aktuell an `shouldPromptPipeline`. Solange keine Artefakte existieren, bleibt dieses Flag `true`.  
Beim Schließen setzt die UI `pipeline=0` (oder vorher implizit „closed“), der Effekt erkennt „nicht offen“ und öffnet erneut.

## Lösungskandidaten
### Variante A (URL-Param als Zustandsmaschine)
- Verwende drei Zustände über `pipeline`:
  - `''` (nicht gesetzt) = Initialzustand → Auto‑Open darf greifen
  - `'1'` = offen
  - `'0'` = vom Nutzer geschlossen → **Auto‑Open darf nicht mehr greifen**
- Vorteil: Deep-Linking bleibt möglich, Verhalten ist deterministisch.
- Nachteil: Minimal mehr Zustandslogik im URL‑Param.

### Variante B (lokales „dismissed“ Flag)
- Lokalen State/Ref `hasDismissedAutoOpen` setzen, wenn User schließt.
- Vorteil: URL bleibt sauber.
- Nachteil: State geht bei Refresh verloren und ist schlechter debugbar.

### Variante C (SessionStorage Persistenz)
- `dismissed` in `sessionStorage` speichern, solange Tab offen ist.
- Vorteil: wirkt „stabil“ über Navigation innerhalb der App.
- Nachteil: mehr IO/Edge Cases; URL bleibt uneindeutig.

## Entscheidung
Wir wählen **Variante A**, weil sie minimal-invasiv ist, keinen zusätzlichen Persistenz-State braucht und gut debuggbar bleibt.


