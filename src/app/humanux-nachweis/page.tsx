import "@humanux/player/styles.css"
import { HumanUxNachweis } from "@/components/humanux-nachweis/humanux-nachweis"

/**
 * Nachweis M2: eine Aufführung aus dem Bündel `@humanux/player` (vendor/humanux-player-*.tgz),
 * gebaut im Repo commoning-methods. Das Spiegelbild von `ks-embed-nachweis` dort.
 *
 * Die Route ist nicht öffentlich (Middleware unverändert): Wer sie sieht, ist angemeldet.
 */
export default function HumanUxNachweisPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Bühne aus HumanUX</h1>
        <p className="text-sm text-muted-foreground">
          Eine kleine Aufführung, abgespielt vom HumanUX Player. Ein Klick auf „Wissen als Gemeingut“ wechselt
          die Bühne; die Quellen und die beiden anderen Themen öffnen ein Medium.
        </p>
      </header>
      <HumanUxNachweis />
    </main>
  )
}
