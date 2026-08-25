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
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[640px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Newsletter
            </div>
            <h1 className="mb-6 font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Stories worth the trip.
            </h1>
            <p className="mb-10 max-w-[520px] text-[1.0625rem] leading-relaxed text-white/80">
              Occasional stories and impact updates from Green Streets Initiative —
              how communities across Massachusetts are walking, biking, and riding
              more, and how you can join them.
            </p>
            <NewsletterSignupForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
