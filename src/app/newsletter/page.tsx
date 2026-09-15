import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import NewsletterSignupForm from '@/components/NewsletterSignupForm'

export const metadata = {
  title: 'Newsletter — Green Streets Initiative',
  description:
    'Get occasional stories and impact updates from Green Streets Initiative — how Massachusetts communities are walking, biking, and riding more.',
}

export default function NewsletterPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <section className="bg-cream px-6 pb-20 pt-12 md:pt-16 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[640px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Newsletter
            </div>
            <h1 className="mb-6 font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Stories worth the trip.
            </h1>
            <p className="mb-10 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Occasional stories and impact updates from Green Streets Initiative —
              how communities across Massachusetts are walking, biking, and riding
              more, and how you can join them.
            </p>
            <NewsletterSignupForm variant="light" />
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
