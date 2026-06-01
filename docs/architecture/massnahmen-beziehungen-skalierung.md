# Skalierung der Maßnahmen-Beziehungen (10.000+ Maßnahmen)

> Architektur-Empfehlung (noch nicht umgesetzt) für die Berechnung gerichteter
> „unterstützt"-Beziehungen zwischen Maßnahmen bei großen Katalogen.
> Schließt an [`massnahmen-bewertung-und-graph-zielbild.md`](massnahmen-bewertung-und-graph-zielbild.md)
> (Quelle A = LLM-Beziehungen, Quelle C = Ähnlichkeit) an.
>
> Status: **Empfehlung / Designvorschlag** — keine verbindliche Entscheidung, kein Code.
> Kandidat für eine spätere Optimierungswelle.

## Problem

Die heutige „Quelle A" berechnet gerichtete Beziehungen
(`doc_relations`-Repo, `phase-doc-relations.ts`, `doc-relations-prompt.ts`) über
einen LLM-Pass. Der naive Ansatz „jede Maßnahme gegen jede" ist **O(n²)**:

- 1.000 Maßnahmen → ~1.000.000 Paare
- 10.000 Maßnahmen → ~100.000.000 Paare

Das ist als paarweiser LLM-Vergleich weder bezahlbar noch latenz-/stabil-tauglich.

## Warum reine Embedding-Ähnlichkeit (Quelle C) nicht reicht

Vektor-Nähe (Quelle C) findet **ähnliche** Maßnahmen. „Unterstützt" ist aber

- **gerichtet** (A ermöglicht B ≠ B ermöglicht A) und
- oft **cross-domain**: eine Gesetzes-/Rahmenmaßnahme ermöglicht eine konkrete
  Wirkungsmaßnahme, obwohl beide semantisch unähnlich sind.

Nearest-Neighbor über Embeddings verfehlt genau diese Stützbeziehungen und liefert
stattdessen „thematisch verwandt". Ähnlichkeit ist also kein Ersatz für Unterstützung.

## Empfohlene Methode: „Provides/Requires"-Profile (Max-Neef-Analogie)

Kerngedanke: **einmal klassifizieren statt paarweise vergleichen.**

### 1. Einmalige Klassifizierung pro Maßnahme (O(n))

Jede Maßnahme wird per LLM **genau einmal** in zwei Vektoren über eine *feste
Taxonomie* eingeordnet:

- `provides` — was die Maßnahme ermöglicht / liefert / bereitstellt
- `requires` — worauf sie aufbaut / was sie voraussetzt

Die Taxonomie-Achsen sind frei wählbar, z. B.:

- die 17 **SDGs** (siehe SDG-Profil-Feature — ein erster konkreter Klassifikations-Vektor),
- Handlungsfelder,
- eine Bedürfnis-Taxonomie (Max-Neef: Angebot/Nachfrage von Bedürfnissen).

Diese Klassifizierung ist parallelisierbar und cachebar — Kosten wachsen **linear**.

### 2. Match per Vektorprodukt statt LLM

```
Support(A → B) ≈ dot(A.provides, B.requires)
```

Berechnung wahlweise:

- als **Matrixprodukt** (billige Rechnung statt O(n²) LLM-Calls), oder
- skalierbar per **Vektorsuche**: `requires`-Vektoren indexieren (vorhandene
  Atlas-Vector-Search, `vector-repo.queryDocuments`), und je Maßnahme die Top-k
  Treffer ihres `provides`-Vektors suchen → **O(n·k)**.

### 3. Optionaler LLM-Feinschliff nur für Top-k

LLM wird – wenn überhaupt – nur noch zur Feinbewertung/Begründung der wenigen
Top-k-Kandidaten je Maßnahme eingesetzt. Damit kollabiert der Aufwand von
O(n²) LLM-Calls auf O(n·k) oder ganz ohne LLM im Match-Schritt.

## Kostenvergleich

| Ansatz | LLM-Calls | Bei 10.000 Maßnahmen |
| --- | --- | --- |
| Paarweiser Vergleich (heute, naiv) | O(n²) | ~100 Mio. |
| Provides/Requires-Klassifizierung | O(n) | 10.000 |
| Match per Matrix/Vektorsuche | 0 (reine Rechnung) | — |
| Optionaler Top-k-Feinschliff | O(n·k) | z. B. k=20 → 200.000 |

## Bezug zum bestehenden System

- Das **SDG-Profil** (`sdg_1..sdg_17`) ist bereits ein konkreter
  Klassifikations-Vektor pro Maßnahme — ein erster Baustein dieser Idee.
- `dominant_perspektive` (Welle-1-Bewertung) ist ein grober Richtungs-Prior.
- **Quelle C** liefert die Vektorsuch-Infrastruktur, die der Match-Schritt nutzen würde.
- Die fehlende Zutat ist die **Provides/Requires-Trennung**, die aus „ähnlich" ein
  gerichtetes „unterstützt" macht.

## Empfehlung für die Umsetzung

In einer späteren Optimierungswelle eine skalierende Quelle-A-Variante
**`relationsByProfile`** ergänzen:

1. Klassifizierungs-Phase (LLM, O(n), cachebar) → `provides`/`requires` je Maßnahme.
2. Match-Phase (Matrix bzw. Vektorsuche, O(n·k)) → Kandidaten-Beziehungen.
3. Optionaler LLM-Feinschliff der Top-k.

Den heutigen katalogweiten LLM-Pass als Variante für **kleine** Kataloge behalten;
bei großen Katalogen automatisch auf `relationsByProfile` umschalten.

## Offene Punkte

- Wahl/Stabilität der festen Taxonomie (SDGs vs. Handlungsfelder vs. Bedürfnisse).
- Schwellwerte für die Aufnahme einer Kante (`dot`-Score-Cutoff, Top-k).
- Umgang mit Staleness (Re-Klassifizierung bei Maßnahmen-Änderung) — analog zur
  bestehenden Relations-Staleness (`relations-staleness.ts`).
