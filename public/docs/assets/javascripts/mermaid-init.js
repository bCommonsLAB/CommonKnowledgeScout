// Initialisiert Mermaid und rendert bei Seitenwechseln (Material Instant-Loading)
;(function () {
  if (typeof window === 'undefined') return

  function render() {
    if (window.mermaid && typeof window.mermaid.init === 'function') {
      window.mermaid.init(undefined, document.querySelectorAll('.mermaid'))
    }
  }

  function init() {
    if (window.mermaid && typeof window.mermaid.initialize === 'function') {
      window.mermaid.initialize({ startOnLoad: false, theme: 'default' })
      render()
      if (window.document$ && typeof window.document$.subscribe === 'function') {
        window.document$.subscribe(render)
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()


