# Analyse: Build-Fehler `folderItems` in `library.tsx`

Der aktuelle Produktions-Build bricht nicht an einem Laufzeitfehler ab, sondern an ESLint.
In `src/components/library/library.tsx` wird `folderItems` aus dem Atom gelesen, aber in der
Komponente nirgends verwendet. Das ist ein klarer statischer Fehler und kein Hinweis auf
fehlende Fachlogik, solange keine spätere Verwendung im Render-Pfad existiert.

Variante 1 wäre, `folderItems` wieder aktiv zu verwenden. Das wäre nur sinnvoll, wenn die
Komponente den Wert tatsächlich für Rendering oder Seiteneffekte braucht. Dafür gibt es im
aktuellen Code keinen belastbaren Hinweis. Variante 2 wäre, die Variable per Umbenennung auf
`_folderItems` künstlich zu behalten. Das würde den Build beruhigen, aber die tote Abhängigkeit
im Code konservieren. Variante 3 ist, die unbenutzte Variable zu entfernen und nur den Setter
beizubehalten. Das ist die kleinste und sauberste Änderung.

Entscheidung: Variante 3. Sie reduziert toten Code, verändert kein Verhalten und adressiert
genau die Ursache des fehlgeschlagenen Builds. Verifikation erfolgt durch erneuten Lint-/Type-
Check über `pnpm build`.
