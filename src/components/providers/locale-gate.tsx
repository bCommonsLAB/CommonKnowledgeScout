'use client'

import { useLayoutEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { localeAtom } from '@/atoms/i18n-atom'
import { getLocale, type Locale } from '@/lib/i18n'

interface LocaleGateProps {
	children: React.ReactNode
}

/**
 * Einfaches Gate: Rendert Kinder erst, wenn die gewünschte Locale
 * (aus URL > Cookie > Browser) im Jotai-State gesetzt ist.
 */
export function LocaleGate({ children }: LocaleGateProps) {
	const currentLocale = useAtomValue(localeAtom)
	const setLocale = useSetAtom(localeAtom)
	const [ready, setReady] = useState(false)

	useLayoutEffect(() => {
		const cookieValue = document.cookie
			.split('; ')
			.find(row => row.startsWith('locale='))?.split('=')[1]

		const desiredLocale = getLocale(
			window.location.search,
			cookieValue,
			navigator.language
		) as Locale

		if (currentLocale !== desiredLocale) {
			setLocale(desiredLocale)
		}
		setReady(true)
	}, [currentLocale, setLocale])

	if (!ready) return null
	return <>{children}</>
}























