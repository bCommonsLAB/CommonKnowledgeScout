# Paper-Gerüst: Dimensionen-Faktormodell für Klimamaßnahmen-Portfolios

> **Zweck dieses Dokuments.** Gerüst für ein wissenschaftliches Paper, das mit
> Ko-Autor:innen abgestimmt und in Claude-Chat abschnittsweise ausgearbeitet
> werden soll. Es enthält (a) einen Abstract-Entwurf, (b) eine IMRaD-Gliederung
> mit Abschnitts-Zielen, (c) Related-Work-Platzhalter mit **Zitat-Lücken**
> `[ZITAT: …]` (nicht erfunden), (d) je Abschnitt einen kopierbaren
> **Arbeitsauftrag für Claude-Chat**, (e) einen Kasten „Was noch fehlt".
>
> Fachliche Grundlage:
> [`massnahmen-dimensionen-wirkungssimulation-zielbild.md`](../architecture/massnahmen-dimensionen-wirkungssimulation-zielbild.md).

---

## Arbeitstitel

**„Ein interpretierbares Faktormodell für Wechselwirkungen, Kipppunkte und
Kosten-Wirkungs-Simulation kommunaler Klimamaßnahmen-Portfolios"**

Alternativtitel zur Auswahl:
- „Von paarweiser LLM-Bewertung zu einer Dimensions-Zerlegung: skalierbare
  Wirkungsanalyse großer Maßnahmenkataloge."
- „Provides/Requires-Profile als Low-Rank-Modell für Politik-Portfolio-Simulation."

---

## Abstract (Entwurf, ~200 Wörter)

Kommunale Klimaschutzkataloge umfassen hunderte Einzelmaßnahmen, deren
Wechselwirkungen — welche Maßnahme welche andere ermöglicht, verstärkt oder mit ihr
konkurriert — über den Gesamterfolg entscheiden. Der naive paarweise Vergleich
skaliert quadratisch und ist mit Sprachmodellen weder bezahlbar noch stabil. Wir
schlagen ein **interpretierbares Faktormodell** vor: Aus dem Katalog wird einmalig
ein kompaktes, benanntes **Dimensionsschema** abgeleitet (Emissions-, Enabler- und
Verhaltensdimensionen); jede Maßnahme wird durch zwei signierte Vektoren
beschrieben — *worauf sie wirkt* und *wovon sie abhängt*. Die gerichtete
Einflussmatrix ergibt sich als **Low-Rank-Produkt `W = E·Sᵀ`** in linearer statt
quadratischer Komplexität und bleibt vollständig nachvollziehbar (welche Dimension
eine Kante trägt). Auf den Abhängigkeitsschwellen baut ein
**Linear-Threshold-Kaskadenmodell** auf, das Kipppunkte sichtbar macht. Wir koppeln
das Modell an eine **annualisierte Kosten-Wirkungs-Rechnung** (Annuitätenmethode,
15-Jahres-Horizont) und eine **Jahres-Simulation** budgetbeschränkter Szenarien.
Am Beispiel des Südtiroler Klimaplan-Katalogs (~600 Maßnahmen) [ZITAT: Datenquelle
Klimaplan Südtirol] diskutieren wir Ableitung, Validierung gegen die teure
LLM-Baseline und Grenzen. Der Ansatz überführt qualitative Politikkataloge in ein
quantitativ simulierbares, auditierbares Systemmodell.

> **Arbeitsauftrag für Claude-Chat (Abstract):**
> „Hier ist mein Abstract-Entwurf und das Konzeptdokument. Kürze auf 180–200
> Wörter, schärfe den *einen* Kernbeitrag heraus, und formuliere zwei Varianten:
> eine für ein Klimapolitik-Journal, eine für ein Computational-Sustainability/
> KI-Venue. Nenne pro Variante das Ziel-Publikum."

---

## 1. Einleitung / Problemstellung

**Ziel des Abschnitts:** Motivation (Kataloge sind groß, Wechselwirkungen
entscheidend), Lücke (paarweise LLM-Bewertung skaliert nicht), Beitrag (4 Punkte:
Dimensionsmodell, Low-Rank-Einfluss, Kaskaden/Kipppunkte, annualisierte
Simulation), Beitragsliste + Aufbau des Papers.

Kernpunkte:
- Klimaschutz-Governance arbeitet mit großen Maßnahmenkatalogen (Bürgerräte,
  Fachpläne) [ZITAT: Klimabürgerrat / Klimaplan Südtirol].
- Wirkung ist **systemisch**, nicht additiv: Enabler-Maßnahmen (Rechtsrahmen,
  Infrastruktur) haben selbst kaum CO₂-Wirkung, ermöglichen aber die großen Hebel.
- Bestehende LLM-gestützte paarweise Bewertung ist O(n²) und intransparent.

> **Arbeitsauftrag für Claude-Chat (Einleitung):**
> „Schreibe die Einleitung (~1,5 Seiten) auf Basis des Konzeptdokuments. Beginne mit
> dem konkreten Governance-Problem, leite die Skalierungslücke her, und ende mit
> einer nummerierten Beitragsliste. Markiere jede empirische Aussage, die eine
> Quelle braucht, mit `[ZITAT: …]`."

## 2. Related Work

**Ziel des Abschnitts:** den Beitrag in fünf Literatursträngen verorten. Alle
Zitate sind **Platzhalter** und vor Einreichung zu belegen.

- **Marginal Abatement Cost Curves (MACC)** — Kosten-Wirkungs-Reihung von
  Klimamaßnahmen. [ZITAT: McKinsey MACC; Kesicki & Ekins zu MACC-Grenzen]
- **Policy-Overlap / Doppelzählung** — warum naive Summen überschätzen. [ZITAT:
  UNEP Emissions Gap Report; ICAT Policy Assessment Guidance]
- **Diffusions-/Schwellenmodelle** — Linear-Threshold, Kaskaden in Netzwerken.
  [ZITAT: Granovetter 1978 Threshold Models; Watts 2002 Cascades; Kempe/Kleinberg/
  Tardos 2003 Influence Maximization]
- **Submodulare Coverage / Maximal Marginal Relevance** — Greedy-Auswahl mit
  abnehmendem Grenznutzen (Grundlage der Overlap-Bereinigung). [ZITAT: Nemhauser/
  Wolsey/Fisher 1978; Carbonell & Goldstein 1998 MMR]
- **Bedürfnis-/Angebot-Nachfrage-Taxonomien** — konzeptuelle Nähe der
  Provides/Requires-Trennung. [ZITAT: Max-Neef Human Scale Development]
- **LLM-gestützte Wissens-/Politikstrukturierung** — Einordnung des Klassifikations-
  Ansatzes. [ZITAT: aktuelle LLM-for-classification / knowledge-graph-Arbeiten]

> **Arbeitsauftrag für Claude-Chat (Related Work):**
> „Für jeden der sechs Stränge: nenne die 2–3 kanonischen Referenzen, fasse in 2–3
> Sätzen zusammen, und grenze meinen Beitrag ab (‚anders als X machen wir …'). Gib
> mir echte, überprüfbare Zitationen mit DOI/Jahr — wenn du unsicher bist, markiere
> es als `[PRÜFEN]`, statt zu raten."

## 3. Methodik

**Ziel des Abschnitts:** das Modell formal und reproduzierbar darstellen. Folgt
direkt den §2–§8 des Konzeptdokuments.

- **3.1 Dimensionsschema:** drei Typen (E/V/B), einmalige Ableitung, Kalibrierung
  an Abdeckung/Redundanz.
- **3.2 Faktorvektoren:** `wirkt_auf ∈ [−1,1]ᵐ`, `haengt_ab_von ∈ [0,1]ᵐ`,
  optionale Schwellen; Befüllung in O(n).
- **3.3 Einflussmatrix:** `W = E·Sᵀ`; Komplexität, Interpretierbarkeit, Vorzeichen
  (Synergie vs. Zielkonflikt).
- **3.4 Kaskaden/Kipppunkte:** Zustandsvektor, Gate-Funktion, Fixpunkt-Iteration,
  β-Dämpfung, Zyklenbehandlung.
- **3.5 Kosten-Annualisierung:** Kostenprofil (capex/opex/rampup/nutzungsdauer),
  Annuitätenformel, Vermeidungskosten (€/t).
- **3.6 Simulationsengine:** Jahresschleife, Budget, Overlap-Bereinigung,
  Auswahlstrategien.

> **Arbeitsauftrag für Claude-Chat (Methodik):**
> „Formalisiere §3 mit sauberer Notation (Matrizen, Mengen, Formeln in LaTeX).
> Schreibe zu jeder Formel einen Satz Intuition. Erzeuge einen Pseudocode-Block für
> die Simulationsengine und einen für die Kaskaden-Iteration. Achte auf konsistente
> Symbole (E, S, W, x, β, i, n)."

## 4. Fallstudie & Erwartete Ergebnisse (Validierungsplan)

**Ziel des Abschnitts:** wie am Südtirol-Katalog (~600 Maßnahmen) validiert wird.
**Achtung:** noch keine echten Zahlen — hier steht der *Plan*, keine Resultate.

- **Datensatz:** Südtiroler Klimaplan-/Bürgerrats-Katalog, ~606 Maßnahmen mit
  bestehenden Feldern (CO₂-Hypothese, Kosten, SDG-Profil). [ZITAT: Datenquelle]
- **V1 — Dimensionsableitung:** Anzahl/Verteilung der Dimensionen (E/V/B),
  Abdeckung je Maßnahme, Redundanz-Matrix.
- **V2 — Faktormodell vs. LLM-Baseline:** Korrelation / Precision@k der Top-Kanten
  aus `W` gegen die bestehenden `doc_relations`-Kanten.
- **V3 — Kaskaden-Plausibilität:** Fallbeispiele „Enabler zündet Wirkungsmaßnahme";
  Sensitivität gegenüber β und Schwellen.
- **V4 — Kosten/MACC:** annualisierte €/t-Kurve; Vergleich der Maßnahmen-Reihung
  vor/nach Annualisierung.
- **V5 — Szenarien:** 2–3 Budgetpfade, kumulative CO₂-Zeitreihen, Schwerpunkt-
  Verlagerung.

> **Arbeitsauftrag für Claude-Chat (Ergebnisse — NACH dem Prototyp):**
> „Ich hänge die Prototyp-Ergebnisse (CSV/JSON) an. Erzeuge die Ergebnis-Tabellen
> und Abbildungsbeschreibungen für V1–V5, ordne die Größenordnungen ein, und
> formuliere die Kernbefunde in je einem Satz. Erfinde keine Zahlen — nutze nur die
> angehängten Daten."

## 5. Diskussion & Grenzen

**Ziel des Abschnitts:** ehrliche Einordnung.

- Dimensionen sind LLM-abgeleitet → Schätzung, keine physikalische Bilanz;
  Begründungspflicht + Stichproben-Review.
- Schwellen/β sind Annahmen → Sensitivitätsanalyse, als Spanne berichten.
- Textuelle Ähnlichkeit ≠ kausale Überlappung (bekannte Grenze der Overlap-Rechnung).
- Generalisierbarkeit über Südtirol hinaus; Übertrag auf andere Politikfelder.

> **Arbeitsauftrag für Claude-Chat (Diskussion):**
> „Schreibe eine selbstkritische Diskussion. Liste die 5 stärksten Angriffspunkte
> eines Reviewers und je eine ehrliche Antwort/Mitigation. Trenne ‚Grenzen der
> Methode' von ‚Grenzen dieser Studie'."

## 6. Fazit & Ausblick

**Ziel des Abschnitts:** Beitrag zusammenfassen, nächste Schritte (Human-in-the-Loop-
Übersteuerung, transitive Kaskaden > 1 Hop, Übertrag auf weitere Kataloge).

> **Arbeitsauftrag für Claude-Chat (Fazit):**
> „Fasse in 150 Wörtern zusammen, ohne neue Aussagen einzuführen. Ende mit 3
> konkreten Folgearbeiten."

---

## Anhang A — Reproduzierbarkeit

Verweise auf das Konzeptdokument, die Datenmodell-Collections
(`impact_dimensions__<lib>`, `measure_dimension_vectors__<lib>`), die Formeln (§3–§6
des Zielbilds) und — sobald vorhanden — das Prototyp-Repository/Notebook.

---

## ⚠️ Kasten: Was noch fehlt für ein vollwertiges Paper

Dieses Gerüst ist **methodisch vollständig, aber empirisch leer**. Für ein
einreichbares Paper fehlt:

1. **Prototyp-Lauf** auf den echten ~606 Maßnahmen: Dimensionsschema ableiten, die
   zwei Vektoren je Maßnahme befüllen, `W = E·Sᵀ` rechnen, eine Simulation fahren.
   (Kostet LLM-Budget, braucht Prod-DB-Zugriff — bewusst nicht Teil dieses Schritts.)
2. **Validierung** gegen die teure LLM-Baseline (Precision@k der Top-Kanten;
   Stabilität der Dimensionen; Sensitivität β / Diskontsatz / Ramp-Kurve).
3. **Echte Zitationen** an allen `[ZITAT: …]`/`[PRÜFEN]`-Stellen.
4. **Abbildungen** aus realen Daten (MACC-Kurve, Kaskaden-Beispiel, Szenario-
   Zeitreihen).
5. **Venue-Entscheidung** (Klimapolitik- vs. Computational-Sustainability-Journal)
   → bestimmt Länge, Formatvorlage, Betonung.

> Keine dieser Lücken darf mit erfundenen Zahlen/Quellen gefüllt werden
> (no-silent-fallbacks). Platzhalter sichtbar lassen, bis reale Belege vorliegen.
