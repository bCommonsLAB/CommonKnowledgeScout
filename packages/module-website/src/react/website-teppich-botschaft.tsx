'use client'

/**
 * Die Botschaft der Teppich-Animation als Baustein (aus `website-teppich.tsx` herausgeloest,
 * 24.11.2026, Dateigrenze): Titel und wachsende Liste der Schritte. Am Rechner frei ueber der
 * Wolke, auf dem Telefon ein Statusblatt fest am unteren Bildschirmrand (R3).
 */

import * as React from 'react'
import type { TeppichBotschaft } from './use-teppich-botschaft'

/** Neue Zeilen der Botschaft gleiten weich herein. */
const EIN = '@keyframes ks-teppich-ein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'

export function TeppichBotschaftBlatt({ botschaft, schmal, links }: { botschaft: TeppichBotschaft; schmal: boolean; links: number }): React.ReactElement {
  return (
    <div
      className={schmal
        ? 'pointer-events-none fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-black/10 bg-white px-5 pt-4 text-neutral-900 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] pb-[max(1.5rem,env(safe-area-inset-bottom))]'
        : 'pointer-events-none absolute top-10 max-w-xs'}
      style={schmal ? undefined : { left: links }}
      aria-live="polite"
      data-teppich-botschaft={schmal ? 'blatt' : 'frei'}
    >
      <style>{EIN}</style>
      <p className={schmal ? 'text-base font-semibold' : 'text-sm font-semibold'}>{botschaft.titel}</p>
      <ol className="mt-2 space-y-1 text-sm">
        {botschaft.schritte.map((schritt, k, alle) => (
          <li key={k} className={k === alle.length - 1 ? 'transition-opacity duration-500' : 'opacity-50 transition-opacity duration-500'} style={{ animation: 'ks-teppich-ein 600ms ease backwards' }}>
            {schritt}
          </li>
        ))}
      </ol>
    </div>
  )
}
