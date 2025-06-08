'use client';

// Registriere Custom Element für Audio Player
if (typeof window !== 'undefined') {
  if (!customElements.get('markdown-audio')) {
    class AudioPlayerElement extends HTMLElement {
      static observedAttributes = ['file-id', 'file-name', 'mime-type', 'library-id'];
      
      connectedCallback() {
        const fileId = this.getAttribute('file-id');
        const fileName = this.getAttribute('file-name');
        const mimeType = this.getAttribute('mime-type');
        let libraryId = this.getAttribute('library-id');
        
        if (!fileId || !fileName) return;

        // Versuche die libraryId aus dem aktiven Library State zu holen, falls nicht als Attribut übergeben
        if (!libraryId) {
          // Suche nach der aktiven Library ID im DOM (z.B. aus einem data-Attribut)
          const libraryElement = document.querySelector('[data-active-library-id]');
          if (libraryElement) {
            libraryId = libraryElement.getAttribute('data-active-library-id');
          }
        }

        // Nutze dieselbe Struktur wie AudioPlayer Komponente
        this.innerHTML = `
          <div class="my-4">
            <div class="text-xs text-muted-foreground mb-2">${fileName}</div>
            <audio controls class="w-full" preload="none">
              <source src="/api/storage?action=binary&fileId=${fileId}&libraryId=${libraryId || ''}" type="${mimeType || 'audio/mpeg'}">
              Ihr Browser unterstützt das Audio-Element nicht.
            </audio>
          </div>
        `;
      }
    }
    
    customElements.define('markdown-audio', AudioPlayerElement);
  }
} 