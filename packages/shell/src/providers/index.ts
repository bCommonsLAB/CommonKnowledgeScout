/**
 * Provider-Kette der Schale (Client-Komponenten).
 *
 * Stand Welle M3 bewusst unvollstaendig: Theme und QueryClient sind
 * abhaengigkeitsfrei und daher extrahierbar. Locale-Provider/-Gate haengen an
 * `@ks/i18n` (existiert noch nicht), Storage-Context und Library-Bootstrap an
 * `ClientLibrary`/`StorageFactory` — beide bleiben bis zur jeweils zustaendigen
 * Welle in der App (Begruendung: AGENT-BRIEF-M3.md).
 */

export { ThemeProvider } from './theme-provider'
export { QueryProvider } from './query-provider'
