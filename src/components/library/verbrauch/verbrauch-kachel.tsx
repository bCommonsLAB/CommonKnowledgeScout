/** Eine Kennzahl der Verbrauchsseite; `betont` hebt die Energie-Kachel hervor. */
export function VerbrauchKachel({ label, wert, hinweis, betont }: { label: string; wert: string; hinweis: string; betont?: boolean }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${betont ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-white'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${betont ? 'text-emerald-700' : 'text-neutral-500'}`}>{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-neutral-900">{wert}</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{hinweis}</p>
    </div>
  )
}
