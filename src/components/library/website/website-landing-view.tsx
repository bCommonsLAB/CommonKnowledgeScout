/**
 * Landingpage-Renderer (detailViewType: website) — Phase-0-Pilot.
 *
 * Komponiert Menue, Hero, Inhalts-Sektionen, Video und Side-Banner. Bewusst
 * Server-Component (kein 'use client', kein Daten-Fetch), damit der Pilot die
 * Best-Case-Ladezeit ohne Client-JS/Clerk-Block zeigt.
 */

import * as React from 'react'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'
import type { WebsiteLandingData } from '@/lib/website/types'
import { SectionBlock, VideoEmbed } from './website-landing-blocks'

function MenuBar({ data }: { data: WebsiteLandingData }): React.ReactElement {
  return (
    <nav className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 overflow-x-auto px-6">
        <span className="whitespace-nowrap font-bold">{data.title}</span>
        <div className="flex items-center gap-4 text-sm">
          {data.menu.map((m) => (
            <a key={m.label} href={m.href} className="whitespace-nowrap hover:underline">
              {m.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}

function Hero({ data }: { data: WebsiteLandingData }): React.ReactElement {
  return (
    <header className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.heroImageUrl}
        alt={data.heroImageAlt ?? ''}
        className="h-[60vh] w-full object-cover"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-6 text-center text-white">
        <h1 className="text-5xl font-bold md:text-6xl">{data.title}</h1>
        <p className="mt-4 max-w-2xl text-lg md:text-xl">{data.heroSubtitle}</p>
        {data.ctaLabel && data.ctaUrl && (
          <a
            href={data.ctaUrl}
            className="mt-6 inline-block rounded-full bg-emerald-600 px-6 py-3 font-medium hover:bg-emerald-500"
          >
            {data.ctaLabel}
          </a>
        )}
      </div>
    </header>
  )
}

function SideBanner({ data }: { data: WebsiteLandingData }): React.ReactElement {
  return (
    <section className="bg-muted px-6 py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{data.bannerTitle}</h2>
          <a
            href={data.galleryHref}
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            mehr Inhalte →
          </a>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {data.bannerItems.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className="block overflow-hidden rounded-xl border bg-background transition hover:shadow-md"
            >
              {it.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.imageUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              )}
              <div className="p-4 font-medium">{it.title}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export function WebsiteLandingView({ data }: { data: WebsiteLandingData }): React.ReactElement {
  const sections = parseWebsiteSections(data.body)
  return (
    <div className="min-h-screen">
      <MenuBar data={data} />
      <Hero data={data} />
      {sections.map((s, i) => (
        <SectionBlock key={i} section={s} />
      ))}
      {data.videoUrl && <VideoEmbed url={data.videoUrl} />}
      <SideBanner data={data} />
    </div>
  )
}
