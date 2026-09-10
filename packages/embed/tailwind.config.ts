import type { Config } from 'tailwindcss'
import app from '../../tailwind.config'

/**
 * Tailwind fuer `@ks/embed`: dasselbe Theme wie die App, aber nur die Klassen
 * der eingebetteten Galerie. `scripts/build-css.mjs` legt danach jede Regel
 * unter den Rahmen `.ks-embed`, damit nichts auf die fremde Seite wirkt.
 */
export default {
  darkMode: app.darkMode,
  theme: app.theme,
  plugins: app.plugins,
  content: {
    relative: true,
    files: [
      './src/**/*.{ts,tsx}',
      '../module-explorer/src/**/*.{ts,tsx}',
      '../ui/src/**/*.{ts,tsx}',
      // md-renderer setzt Tailwind-Klassen in das gerenderte HTML.
      '../viewers/src/**/*.{ts,tsx}',
    ],
  },
} satisfies Config
