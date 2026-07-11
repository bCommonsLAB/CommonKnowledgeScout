---
title: {{title|Kurzer, sachlicher Titel des Berichts (max. 80 Zeichen), beginnend mit "Wirkungsbericht"}}
themenfelder: {{themenfelder|Markdown-Abschnitt: welche inhaltlichen Cluster/Themenfelder es gibt, wo sie sich ueberschneiden und welche Massnahmen (Nr) dazugehoeren. 2-5 Absaetze.}}
groessenordnungen: {{groessenordnungen|Markdown-Abschnitt: welche Cluster/Massnahmen wie viel beitragen (kt CO2, EUR), wo die grossen Hebel liegen, wie weit naive und bereinigte Summe auseinanderliegen und warum. Zahlen NUR aus der Vorlage uebernehmen, nicht selbst rechnen.}}
handlungsempfehlungen: {{handlungsempfehlungen|Markdown-Abschnitt: konkrete, priorisierte Empfehlungen — welche Massnahmen-Buendel zuerst, wo Buendelung Kosten spart, wo Daten fehlen ("was waere jetzt zu tun").}}
---
# {{title}}

*Stand: {{stand}} · Modell: {{modell}} · Alle bereinigten Werte sind SCHAETZUNGEN; die naive Summe ist die Obergrenze.*

## Wie dieser Bericht gerechnet wird

Naive Summen ueberschaetzen, weil sich Massnahmen dieselben Emissionen bzw.
Kosten teilen koennen (Doppelzaehlung/Policy Overlap). Ein LLM vergibt pro
Massnahme zwei Korrekturfaktoren in [0..1] — greedy, absteigend nach Wirkung:
jede Massnahme wird relativ zu den bereits gezaehlten bewertet. Faktor CO2
korrigiert Doppelzaehlung geteilter Emissionen; Faktor Kosten schaetzt
Synergien durch Buendelung (gemeinsame Infrastruktur/Beschaffung). Die Summen
der Ergebnis-Tabelle rechnet anschliessend deterministischer Code — nie das LLM.

## Kennzahlen

{{kennzahlen}}

## Themenfelder

{{themenfelder}}

## Groessenordnungen

{{groessenordnungen}}

## Was jetzt zu tun waere

{{handlungsempfehlungen}}

## Ergebnis-Tabelle

{{ergebnis_tabelle}}

{{ohne_angabe}}

## Methodik und Grenzen

Auch LLM-Urteile sind Schaetzungen — jede Zeile der Ergebnis-Tabelle traegt
eine Begruendung und sollte stichprobenartig geprueft werden. Massnahmen ohne
LLM-Faktor zaehlen voll (die naive Summe bleibt die Obergrenze) und sind in
den Kennzahlen ausgewiesen.

--- systemprompt
Du schreibst die Management-Zusammenfassung eines Klimamassnahmen-Wirkungsberichts auf Deutsch.
Grundlage sind eine fertig gerechnete Ergebnis-Tabelle (Korrekturfaktoren fuer
Doppelzaehlung der CO2-Wirkung und Kosten-Synergien) sowie Kennzahlen; beides steht im
Quelltext, die Rohdaten zusaetzlich strukturiert im Kontext. Rechne NICHT selbst —
uebernimm Zahlen ausschliesslich aus der Vorlage. Nuechtern, praezise, keine Floskeln.
Kennzeichne Schaetzungen als solche: die naive Summe ist die Obergrenze, die bereinigte
eine konservative Schaetzung auf Basis von LLM-Faktoren.
