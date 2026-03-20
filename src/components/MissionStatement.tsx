export default function MissionStatement() {
  return (
    <section className="bg-[#F4F8EE] px-8 py-24">
      <div className="mx-auto max-w-[820px]">
        <p className="mb-8 font-display text-xs font-bold uppercase tracking-[0.15em] text-[#8A8DA8]">
          Every trip counts.
        </p>
        <p className="mb-10 font-display text-[clamp(1.375rem,2.5vw,1.875rem)] font-bold leading-[1.3] tracking-tight text-navy">
          Green Streets Initiative helps people{' '}
          <em className="not-italic text-[#7DB82E]">shift trips</em> to healthier,
          cheaper, cleaner alternatives — and measures the impact,{' '}
          <em className="not-italic text-[#7DB82E]">trip by trip</em>, community by
          community.
        </p>

        <div className="grid gap-6 border-t border-navy/[0.09] pt-8 md:grid-cols-3">
          <div>
            <div className="font-display text-[2rem] font-extrabold leading-none tracking-tighter text-navy">
              20<span className="text-[#7DB82E]">+</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[#4A4D68]">
              Years supporting active commuters across Massachusetts
            </p>
          </div>
          <div>
            <div className="font-display text-[2rem] font-extrabold leading-none tracking-tighter text-navy">
              30<span className="text-[#7DB82E]">k+</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[#4A4D68]">
              People reached through Walk/Ride Days and challenges
            </p>
          </div>
          <div>
            <div className="font-display text-[2rem] font-extrabold leading-none tracking-tighter text-navy">
              12
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[#4A4D68]">
              Communities with active What Moves Us data projects
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
