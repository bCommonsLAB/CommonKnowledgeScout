'use client';

// Registriere Custom Element für Audio Player
if (typeof window !== 'undefined') {
  if (!customElements.get('markdown-audio')) {
    class AudioPlayerElement extends HTMLElement {
      static observedAttributes = ['file-id', 'file-name', 'mime-type'];
      
      connectedCallback() {
        const fileId = this.getAttribute('file-id');
        const fileName = this.getAttribute('file-name');
        const mimeType = this.getAttribute('mime-type');
        
        if (!fileId || !fileName) return;

        // Nutze dieselbe Struktur wie AudioPlayer Komponente
        this.innerHTML = `
          <div class="my-4">
            <div class="text-xs text-muted-foreground mb-2">${fileName}</div>
            <audio controls class="w-full" preload="none">
              <source src="/api/storage/filesystem?action=binary&fileId=${fileId}" type="${mimeType || 'audio/mpeg'}">
              Ihr Browser unterstützt das Audio-Element nicht.
            </audio>
          </div>
        `;
      }
    }
    
    customElements.define('markdown-audio', AudioPlayerElement);
  }
} 