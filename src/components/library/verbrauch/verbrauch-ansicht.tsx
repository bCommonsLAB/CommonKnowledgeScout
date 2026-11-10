'use client'

/**
 * Verbrauchsseite einer Library (Konzept 10.11.2026, Figma „v2"): was die
 * Fragen an dieses Archiv kosten und wie viel Energie sie hoechstens brauchen.
 * Oeffentlich, nur Zahlen. Umschalter „Alle Fragen / Meine Sitzung", je Monat.
 */

import Link from 'next/link'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { aktuellerMonat } from '@/lib/verbrauch/rechnen'
import { energie, energieVergleich, euro, monatsName, monatVerschieben, zahl } from '@/lib/verbrauch/format'
import { useVerbrauch, type VerbrauchSicht } from './use-verbrauch'
import { VerbrauchKachel } from './verbrauch-kachel'
import { VerbrauchListe } from './verbrauch-liste'

const SICHTEN = ['all', 'session'] as const

export function VerbrauchAnsicht({ slug }: { slug: string }) {
  const { t, locale } = useTranslation()
  const heute = aktuellerMonat()
  const [sicht, setSicht] = useQueryState('sicht', parseAsStringLiteral(SICHTEN).withDefault('all'))
  const [monat, setMonat] = useQueryState('monat', parseAsString.withDefault(heute))
  const { library, verbrauch } = useVerbrauch(slug, monat, sicht)
  const d = verbrauch.data
  const s = d?.summen
  const fehler = library.error ?? verbrauch.error

  const vergleich = s ? energieVergleich(s.energieWh) : null
  const energieHinweis = !vergleich
    ? t('verbrauch.energieKeine')
    : vergleich.art === 'auto'
      ? t('verbrauch.energieAuto', { km: zahl(vergleich.km, locale) })
      : t('verbrauch.energieLampe', { stunden: zahl(vergleich.stunden, locale) })
  const mitPreis = s ? s.neuBerechnet - s.ohnePreis : 0
  const kostenHinweis = !s || !d?.kostenVerfuegbar || s.kostenEur === null
    ? t('verbrauch.kostenFehlen')
    : [
        mitPreis > 0 ? t('verbrauch.kostenHinweis', { anzahl: zahl(mitPreis, locale), schnitt: euro(s.kostenEur / mitPreis, locale) }) : null,
        s.ohnePreis > 0 ? t('verbrauch.kostenUntergrenze', { anzahl: zahl(s.ohnePreis, locale) }) : null,
      ].filter(Boolean).join(' · ')

  const knopf = (wert: VerbrauchSicht, text: string) => (
    <button
      type="button"
      onClick={() => void setSicht(wert)}
      aria-pressed={sicht === wert}
      className={`rounded-md px-4 py-2 text-sm font-medium ${sicht === wert ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
    >
      {text}
    </button>
  )

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8" data-verbrauch>
      <Link href={`/explore/${slug}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('verbrauch.zurueck', { name: library.data?.label ?? slug })}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t('verbrauch.titel')}</h1>
      <p className="mt-3 max-w-2xl text-neutral-500">{t('verbrauch.intro')}</p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg bg-neutral-100 p-1">
          {knopf('all', t('verbrauch.alle'))}
          {knopf('session', t('verbrauch.sitzung'))}
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5">
          <button type="button" onClick={() => void setMonat(monatVerschieben(monat, -1))} aria-label={t('verbrauch.monatVor')} className="rounded p-1 text-neutral-500 hover:text-neutral-900">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium" data-verbrauch-monat>{monatsName(monat, locale)}</span>
          <button type="button" onClick={() => void setMonat(monatVerschieben(monat, 1))} disabled={monat >= heute} aria-label={t('verbrauch.monatNach')} className="rounded p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {fehler && (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {t('verbrauch.fehler')} ({fehler.message})
        </p>
      )}
      {!fehler && !d && <p className="mt-6 text-sm text-neutral-500" role="status">{t('verbrauch.laden')}</p>}

      {d && s && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <VerbrauchKachel
              label={sicht === 'session' ? t('verbrauch.kostenSitzung') : t('verbrauch.kostenMonat', { monat: monatsName(monat, locale) })}
              wert={s.kostenEur === null ? '–' : euro(s.kostenEur, locale)}
              hinweis={kostenHinweis}
            />
            <VerbrauchKachel label={t('verbrauch.energie')} wert={s.energieWh > 0 ? energie(s.energieWh, locale) : '–'} hinweis={energieHinweis} betont />
            <VerbrauchKachel
              label={t('verbrauch.fragen')}
              wert={zahl(s.fragen, locale)}
              hinweis={s.ausSpeicher > 0 ? t('verbrauch.fragenHinweis', { anzahl: zahl(s.ausSpeicher, locale) }) : `${zahl(s.tokens, locale)} ${t('verbrauch.tokens')}`}
            />
          </div>
          <VerbrauchListe eintraege={d.eintraege} sicht={sicht} begrenzt={s.fragen > d.eintraege.length || d.abgeschnitten} />
          <section className="mt-6 rounded-xl bg-neutral-100 p-5">
            <h2 className="text-sm font-semibold">{t('verbrauch.rechnenTitel')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">{t('verbrauch.rechnenText', { faktor: zahl(d.whPro1000Tokens, locale) })}</p>
          </section>
        </>
      )}
    </main>
  )
}
