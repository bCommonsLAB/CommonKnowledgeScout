'use client'

import { useLayoutEffect } from 'react'
import { Provider, useSetAtom } from 'jotai'
import { localeAtom } from './locale-atom'
import { LocaleProvider } from './locale-provider'
import type { Locale } from '../core'

interface JotaiLocaleProviderProps {
	serverLocale: Locale
	children: React.ReactNode
}

// Innere Komponente, die den initialen Wert setzt
function LocaleInitializer({ serverLocale }: { serverLocale: Locale }) {
	const setLocale = useSetAtom(localeAtom)
	
	useLayoutEffect(() => {
		setLocale(serverLocale)
	}, [serverLocale, setLocale])
	
	return null
}

export function JotaiLocaleProvider({ serverLocale, children }: JotaiLocaleProviderProps) {
	return (
		<Provider>
			<LocaleInitializer serverLocale={serverLocale} />
			{/* Hält localeAtom bei URL-/Cookie-Änderungen aktuell */}
			<LocaleProvider>
				{children}
			</LocaleProvider>
		</Provider>
	)
}
