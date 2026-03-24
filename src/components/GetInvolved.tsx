import Link from 'next/link'

export default function GetInvolved() {
  return (
    <section className="bg-[#F4F8EE] px-8 py-12">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">
          Get involved
        </div>
        <h2 className="mb-12 font-display text-4xl font-extrabold leading-tight tracking-tighter text-navy md:text-5xl">
          Let&apos;s move
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-navy/[0.09] bg-white p-8 transition-all hover:border-blue/25 hover:shadow-[0_2px_16px_rgba(25,26,46,0.08)]">
            <h3 className="mb-2 font-display text-[1.1875rem] font-extrabold tracking-tight text-navy">
              Donate to Green Streets Initiative
            </h3>
            <p className="mb-6 text-[15px] leading-relaxed text-[#4A4D68]">
              Your support funds Shift, our community data projects, and the
              next chapter of active mobility programming across Massachusetts.
              Green Streets Initiative is a 501(c)(3) nonprofit — all donations
              are tax-deductible.
            </p>
            <Link
              href="/donate"
              className="inline-block rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
            >
              Donate now
            </Link>
          </div>

          <div className="rounded-2xl border border-navy/[0.09] bg-white p-8 transition-all hover:border-blue/25 hover:shadow-[0_2px_16px_rgba(25,26,46,0.08)]">
            <h3 className="mb-2 font-display text-[1.1875rem] font-extrabold tracking-tight text-navy">
              Partner with us
            </h3>
            <p className="mb-6 text-[15px] leading-relaxed text-[#4A4D68]">
              Sponsor a Shift flagship event, run a workplace challenge, or
              bring our K–12 program to your school district. Let&apos;s build
              something together.
            </p>
            <Link
              href="/get-involved/partner"
              className="inline-block rounded-full border-[1.5px] border-navy px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
