import { HeroSection } from "@/components/hero-section"
import { LibraryGrid } from "@/components/library-grid"
import { HowItWorks } from "@/components/how-it-works"
import { PhilosophySection } from "@/components/philosophy-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <LibraryGrid />
      <HowItWorks />
      <PhilosophySection />
      <CTASection />
      <Footer />
    </main>
  )
}
