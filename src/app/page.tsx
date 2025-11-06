import { HeroSection } from "@/components/home/hero-section"
import { LibraryGrid } from "@/components/home/library-grid"
import { HowItWorks } from "@/components/home/how-it-works"
import { PhilosophySection } from "@/components/home/philosophy-section"
import { CTASection } from "@/components/home/cta-section"

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <LibraryGrid />
      <HowItWorks />
      <PhilosophySection />
      <CTASection />
    </main>
  )
}