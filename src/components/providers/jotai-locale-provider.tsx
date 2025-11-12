'use client'

import { useLayoutEffect } from 'react'
import { Provider, useSetAtom } from 'jotai'
import { localeAtom } from '@/atoms/i18n-atom'
import { LocaleProvider } from '@/components/providers/locale-provider'
import type { Locale } from '@/lib/i18n'

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
