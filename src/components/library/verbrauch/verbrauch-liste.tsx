'use client'

/** Die Fragen als Zahlenzeilen: Zeit, Tokens, Kosten, Energie — kein Fragetext. */

import { useTranslation } from '@ks/i18n/react'
import type { VerbrauchEintrag } from '@/lib/verbrauch/rechnen'
import { energie, euro, zahl, zeitpunkt } from '@/lib/verbrauch/format'
import type { VerbrauchSicht } from './use-verbrauch'

export function VerbrauchListe({ eintraege, sicht, begrenzt }: { eintraege: VerbrauchEintrag[]; sicht: VerbrauchSicht; begrenzt: boolean }) {
  const { t, locale } = useTranslation()
  const hinweis = (e: VerbrauchEintrag): string => {
    if (e.ausSpeicher) return t('verbrauch.ausSpeicher')
    if (e.kostenEur === null && e.tokens !== null) return t('verbrauch.ohnePreis')
    return sicht === 'all' && e.eigen ? t('verbrauch.deineSitzung') : ''
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="font-semibold">{sicht === 'session' ? t('verbrauch.listeSitzung') : t('verbrauch.listeAlle')}</h2>
        <span className="text-xs text-neutral-500">{t('verbrauch.neuesteZuerst')}</span>
      </div>
      {eintraege.length === 0 ? (
        <p className="border-t border-neutral-200 px-5 py-6 text-sm text-neutral-500">{sicht === 'session' ? t('verbrauch.leerSitzung') : t('verbrauch.leer')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-2 font-medium">{t('verbrauch.zeit')}</th>
                <th className="px-5 py-2 text-right font-medium">{t('verbrauch.tokens')}</th>
                <th className="px-5 py-2 text-right font-medium">{t('verbrauch.kosten')}</th>
                <th className="px-5 py-2 text-right font-medium">{t('verbrauch.energieSpalte')}</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {eintraege.map((e, i) => (
                <tr key={`${e.zeit}-${i}`} className="border-b border-neutral-100 last:border-b-0" data-verbrauch-zeile>
                  <td className="whitespace-nowrap px-5 py-3">{zeitpunkt(e.zeit, locale)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{e.tokens === null ? '–' : zahl(e.tokens, locale)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{e.kostenEur === null ? '–' : euro(e.kostenEur, locale)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-emerald-700">{e.energieWh === null ? '–' : energie(e.energieWh, locale)}</td>
                  <td className={`whitespace-nowrap px-5 py-3 text-xs ${e.eigen && !e.ausSpeicher ? 'text-sky-700' : 'text-neutral-500'}`}>{hinweis(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {begrenzt && <p className="border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500">{t('verbrauch.begrenzt', { anzahl: zahl(eintraege.length, locale) })}</p>}
    </section>
  )
}
