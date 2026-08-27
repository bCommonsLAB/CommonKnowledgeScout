export { md } from './md-renderer'
// Logger-Injection (Welle M2b): Die Anwendung reicht ihre Implementierung
// einmal beim Start herein. Ohne Aufruf loggt das Paket nicht.
export { setViewerLogger, type ViewerLogger } from './logger'
export {
  injectPageAnchors,
  getYouTubeId,
  resolveImageUrl,
  encodeSpacesInRelativeMarkdownHrefs,
  processObsidianContent,
} from './markdown-helpers'
