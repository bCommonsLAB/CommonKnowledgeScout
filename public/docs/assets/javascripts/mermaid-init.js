// Rendert die ```mermaid-Bloecke der Doku-Site (siehe mkdocs.yml, custom_fences).
// Material laedt Seiten ohne Reload nach; document$ meldet jeden Seitenwechsel.
function renderMermaid() {
  mermaid.initialize({ startOnLoad: false })
  mermaid.run({ querySelector: '.mermaid' })
}
if (typeof document$ !== 'undefined') {
  document$.subscribe(renderMermaid)
} else {
  document.addEventListener('DOMContentLoaded', renderMermaid)
}
