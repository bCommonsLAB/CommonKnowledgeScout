---
title: {{title|Kurzer, sachlicher Titel des Berichts (max. 80 Zeichen), beginnend mit "Enabler-Bericht"}}
cluster_analyse: {{cluster_analyse|Markdown-Abschnitt: je Cluster ein kurzer Prosa-Absatz, der die wichtigsten Hebel-Massnahmen NENNT und ERKLAERT, warum sie zentral sind — welche Massnahmen sie aktivieren, wie viel bereinigte Wirkung daran haengt, welche Abhaengigkeiten sie aufloesen. Zahlen NUR aus der Vorlage uebernehmen, nicht selbst rechnen.}}
handlungsempfehlungen: {{handlungsempfehlungen|Markdown-Abschnitt: konkrete, priorisierte Empfehlungen — welche Enabler zuerst angegangen werden sollten und warum, welche Cluster ohne ihre Enabler blockiert sind, wo Daten oder Beziehungen fehlen.}}
---
# {{title}}

*Stand: {{stand}} · Hebel-Rechnung deterministisch aus den berechneten Beziehungen · Prosa: {{modell}} · Beziehungs-Stand: {{beziehungs_stand}}*

## Was ist ein Enabler und wie wird der Hebel gerechnet

Enabler sind Massnahmen, die andere Massnahmen erst ermoeglichen (gerichtete
"unterstuetzt"-Beziehungen). Sie erben ANTEILIG die bereinigte CO2-Wirkung der
von ihnen aktivierten Massnahmen: 1 Hop, mehrere Enabler teilen sich die
Wirkung nach Kantengewicht, Daempfung beta = {{beta}}. Die Hebelwirkung ist
eine ZUSCHREIBUNGS-SCHAETZUNG und wird NIE zur eigenen Wirkung addiert —
sonst wuerde dieselbe Einsparung doppelt gezaehlt. Wo vorhanden, fliessen die
Stufe-3-Korrekturfaktoren des Wirkungsberichts ein; sonst gelten die naiven
CO2-Werte.

## Kennzahlen

{{kennzahlen}}

## Die wichtigsten Enabler je Cluster

{{cluster_analyse}}

## Hebel-Tabellen je Cluster

{{hebel_tabellen}}

## Was jetzt zu tun waere

{{handlungsempfehlungen}}

## Methodik und Grenzen

Die Hebel-Rechnung ist deterministisch, haengt aber von der Qualitaet der
berechneten Beziehungen ab (LLM-generierte Kanten, siehe Beziehungs-Stand im
Kopf). Hat sich der Katalog seither geaendert, lohnt ggf. eine Neuberechnung
der Beziehungen — sie ist teuer, die Entscheidung liegt beim Anwender.

--- systemprompt
Du schreibst die Management-Zusammenfassung eines Enabler-Berichts (Hebel-Massnahmen) auf Deutsch.
Grundlage sind fertig gerechnete Hebel-Tabellen je Cluster (Enabler mit eigener bereinigter
Wirkung, Hebelwirkung und den wichtigsten aktivierten Massnahmen) sowie Kennzahlen; beides
steht im Quelltext, die Rohdaten zusaetzlich strukturiert im Kontext. Rechne NICHT selbst —
uebernimm Zahlen ausschliesslich aus der Vorlage. Erklaere in Prosa, WARUM die genannten
Enabler zentral sind (was sie aktivieren, was ohne sie blockiert waere). Nuechtern, praezise,
keine Floskeln. Kennzeichne die Hebelwirkung stets als Zuschreibungs-Schaetzung, die nie zur
eigenen Wirkung addiert werden darf.
