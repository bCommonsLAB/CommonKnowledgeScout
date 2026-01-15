---
title: Event-Kontext im Finalize-Wizard
status: draft
date: 2026-01-11
---

# Fragestellung

Soll im Finalize-Wizard der komplette Event‑Markdown inklusive Frontmatter als Kontext an den Secretary‑Service gesendet werden? Oder nur der Body?

# Beobachtungen

- Das Frontmatter kann sensible Felder enthalten (z.B. `testimonialWriteKey`, interne IDs, Tracking‑Felder).
- Der Body ist für die inhaltliche Zusammenfassung zwingend relevant.
- Der Wizard nutzt den Kontext ausschließlich zur Template‑Transformation (kein UI‑Output aus dem Rohkontext).

# Risiken

- **Sicherheitsrisiko**: Frontmatter kann Geheimnisse enthalten. Diese könnten im LLM‑Output wieder auftauchen.
- **Qualitätsrisiko**: LLM könnte technische Metadaten in den Text übernehmen.
- **Datenschutzrisiko**: Externe IDs/E-Mails könnten in der Zusammenfassung erscheinen.

# Varianten

**Variante A – Nur Body**
- Sende ausschließlich den Body (Markdown ohne Frontmatter).
- Vorteil: Kein Leak von Metadaten.
- Nachteil: Event‑Titel/Teaser müssen aus anderen Quellen kommen.

**Variante B – Gefiltertes Frontmatter + Body**
- Sende Body plus whitelisted Felder (z.B. `title`, `teaser`, `date`, `location`, `topics`, `tags`).
- Vorteil: Mehr Kontext, kontrolliertes Risiko.
- Nachteil: Zusätzliche Mapping‑Logik nötig.

**Variante C – Vollständiges Markdown**
- Sende Frontmatter + Body unverändert.
- Vorteil: Maximaler Kontext.
- Nachteil: Höchstes Risiko, dass Secrets/IDs im Output landen.

# Empfehlung

Variante B. Sie liefert mehr Kontext als nur der Body, ohne sensible Felder zu riskieren. Zusätzlich sollten Felder wie `testimonialWriteKey`, `creationTemplateId` oder `textSources` explizit ausgeschlossen werden.
