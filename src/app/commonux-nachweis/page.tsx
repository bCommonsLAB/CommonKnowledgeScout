import "@commonux/player/styles.css"
import { CommonUxNachweis } from "@/components/commonux-nachweis/commonux-nachweis"

/**
 * Nachweis M2: eine Aufführung aus dem Bündel `@commonux/player` (vendor/commonux-player-*.tgz),
 * gebaut im Repo commoning-methods. Das Spiegelbild von `ks-embed-nachweis` dort.
 *
 * Die Route ist nicht öffentlich (Middleware unverändert): Wer sie sieht, ist angemeldet.
 */
export default function CommonUxNachweisPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Bühne aus Common UX</h1>
        <p className="text-sm text-muted-foreground">
          Eine kleine Aufführung, abgespielt vom Common UX Player. Ein Klick auf „Wissen als Gemeingut“ wechselt
          die Bühne; die Quellen und die beiden anderen Themen öffnen ein Medium.
        </p>
      </header>
      <CommonUxNachweis />
    </main>
  )
}
