## Ziel

Wir wollen für Testimonials einen Flow, der **Transkription ermöglicht**, aber den Nutzer zwingt, den Text **vor dem finalen Speichern zu korrigieren**. Gleichzeitig soll möglichst **keine neue, eigenständige Logik** (neue Pipelines/Worker/Jobs) erfunden werden, sondern vorhandene Komponenten aus dem Wizard wiederverwendet werden.

## Ausgangslage (Ist-Zustand)

Der anonyme Public-Endpoint `/api/public/testimonials` speichert derzeit nur Dateien (Audio + `meta.json`) in einem Event-Unterordner. Es gibt keine automatische Transkriptions-/Review-Phase. Der Wizard besitzt jedoch bereits eine UX-Komponente pro Feld: **Textarea + Mikrofon-Icon**, die Audio aufnimmt und die bestehende Route `/api/secretary/process-audio` nutzt, um eine Transkription zurückzuliefern.

## Varianten

- **Variante A (rein manuell)**: Nur Audio speichern; Transkription/Review wird später manuell durch Owner/Moderator ausgelöst.
- **Variante B (Review vor finalem Speichern)**: Nutzer diktiert in ein Textfeld, bekommt Transkript, korrigiert es und speichert dann final. Optional wird das Roh-Audio mitgespeichert.
- **Variante C (vollautomatisch + Ingest)**: Nach Upload Background-Job, Statusanzeige, Transkript entsteht automatisch und wird als Dokument ingestiert.

## Entscheidung

Wir implementieren **Variante B** ohne neue Orchestrierungslogik: Wir nutzen die bereits vorhandene Transkriptions-Route `/api/secretary/process-audio` und dieselbe Diktier-UX aus dem Wizard (extrahiert als kleine Komponente). Dadurch entsteht ein sauberer Review-Schritt: Der Nutzer sieht den Text sofort, kann ihn korrigieren und erst dann final speichern.

## Konsequenzen / Grenzen

Diese Variante ist **kein Background-Processing** (kein Job-Queue-Status). Die Transkription passiert synchron im UI nach dem Diktat. Später kann man, falls nötig, auf Variante C erweitern (z.B. Jobs erst nach finalem Speichern).

