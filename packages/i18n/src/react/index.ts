/**
 * `@ks/i18n/react` — Hooks und Locale-Provider (Client-Komponenten).
 *
 * `localeAtom` wird BEWUSST nicht exportiert (Entscheidung aus Landkarte §6,
 * umgesetzt in M4c): Ein exportiertes Atom bindet jeden Konsumenten an dieselbe
 * Jotai-Instanz und macht das Paket in einer Fremdanwendung unbrauchbar. Nach
 * aussen gibt es nur Hooks.
 */

export { useTranslation, useSetLocale, useApplyLocale } from './hooks'
export { JotaiLocaleProvider } from './jotai-locale-provider'
export { LocaleProvider } from './locale-provider'
export { LocaleGate } from './locale-gate'
