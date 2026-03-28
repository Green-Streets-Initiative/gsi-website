import Link from 'next/link'

export default function HowItWorks() {
  return (
    <section className="bg-[#F4F8EE] px-8 py-12">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-12 grid items-end gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">
              Who it&apos;s for
            </div>
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
              Built for what<br />moves you
            </h2>
            <p className="max-w-[560px] text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
              Built for anyone ready to move better.
            </p>
          </div>
          <div className="flex flex-col gap-3.5">
            {[
              {
                icon: '💰',
                text: (
                  <>
                    <strong className="font-semibold text-[#191A2E]">Save money and time.</strong> Walking, biking, or taking transit instead of driving saves the average Boston commuter hundreds each month in gas, maintenance, and parking.
                  </>
                ),
              },
              {
                icon: '🧠',
                text: (
                  <>
                    <strong className="font-semibold text-[#191A2E]">Feel better.</strong> Regular active trips are linked to better sleep, sharper cognition, lower stress — and meaningfully lower all-cause mortality.
                  </>
                ),
              },
              {
                icon: '🏙️',
                text: (
                  <>
                    <strong className="font-semibold text-[#191A2E]">Move your community.</strong> Every active trip builds momentum — for your neighborhood, your city, and the people around you.
                  </>
                ),
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3.5 rounded-[10px] border border-[rgba(25,26,46,0.09)] bg-white px-4 py-3.5"
              >
                <span className="mt-0.5 w-9 shrink-0 text-center text-lg">{item.icon}</span>
                <p className="text-[0.9rem] leading-relaxed text-[#4A4D68]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="group flex flex-col rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-8 transition-all hover:border-[#7DB82E] hover:shadow-[0_8px_32px_rgba(186,241,77,0.12)] hover:-translate-y-0.5">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[10px] bg-[rgba(186,241,77,0.15)] text-[1.25rem]">
              🚲
            </div>
            <h3 className="mb-2 font-display text-lg font-bold tracking-tight text-[#191A2E]">
              Individual commuters
            </h3>
            <p className="mb-6 flex-1 text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
              Track your active trips, build your Shift Rate, climb the neighborhood leaderboard. Earn status, save money, and see your health improve — all without thinking about it.
            </p>
            <Link
              href="#waitlist"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#191A2E] transition-[gap] hover:gap-2.5"
            >
              Get the app
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
          <div className="group flex flex-col rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-8 transition-all hover:border-[#7DB82E] hover:shadow-[0_8px_32px_rgba(186,241,77,0.12)] hover:-translate-y-0.5">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[10px] bg-[rgba(41,102,229,0.1)] text-[1.25rem]">
              🏢
            </div>
            <h3 className="mb-2 font-display text-lg font-bold tracking-tight text-[#191A2E]">
              Employers, universities &amp; cities
            </h3>
            <p className="mb-6 flex-1 text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
              Run a workplace challenge, sponsor a flagship event like Shift Your Summer, or bring the K–12 school program to your district. Real participation data. Real impact.
            </p>
            <Link
              href="/shift/employers"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2966E5] transition-[gap] hover:gap-2.5"
            >
              Explore programs
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
