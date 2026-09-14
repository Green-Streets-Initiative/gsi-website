import ShiftWordmark, { PacesetterIcon } from '@/components/brand/ShiftWordmark'
import {
  Bell,
  Bicycle,
  Bus,
  Car,
  CaretRight,
  Check,
  Flame,
  Gift,
  MapPin,
  PersonSimpleWalk,
  TrainSimple,
} from '@phosphor-icons/react/dist/ssr'

/*
 * The shipped Shift home screen, block by block, at the app's native 402px
 * width. Ported from docs/specs/home-rerank-canvas/OptionB.dc.html in the
 * app repo (the accepted re-rank), with colors corrected to the shipped
 * components: AroundYouCard, RealtimeCommuteAdvisorCard, HomeStatusBar.
 *
 * Everything a person reads stays at ≥ 75% white (site contrast rule).
 */

const LIME = '#BAF14D'
const BLUE = '#2966E5'
const AMBER = '#F5A524'

const card = 'rounded-2xl border border-white/[0.07] bg-[#242538]'
const slab = 'font-ui text-[12px] font-semibold uppercase tracking-[1px] text-white/75'

export function ShiftHeader() {
  return (
    <div className="flex h-[44px] items-center justify-center gap-[7px] border-b border-white/[0.07]">
      <ShiftWordmark tone="white" height={19} />
      <span
        className="text-[11px] text-white"
        style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}
      >
        by Green Streets Initiative
      </span>
    </div>
  )
}

export function Greeting({ name }: { name: string }) {
  return (
    <div className="flex h-[56px] items-center justify-between">
      <span className="font-display text-[24px] font-bold tracking-[-0.5px] text-[#F4F8EE]">Good morning, {name}</span>
      <span className="relative">
        <Bell size={24} color="#F4F8EE" />
        <span className="absolute -right-[2px] -top-[2px] h-[10px] w-[10px] rounded-full border-2 border-[#191A2E] bg-[#BAF14D]" />
      </span>
    </div>
  )
}

function Badge({ children, bg, fg = '#FFFFFF' }: { children: string; bg: string; fg?: string }) {
  return (
    <span className="font-ui rounded-[6px] px-2 py-[3px] text-[12px] font-extrabold leading-none" style={{ background: bg, color: fg }}>
      {children}
    </span>
  )
}

export function AroundYouCard() {
  return (
    <div className={`${card} flex h-[180px] flex-col border-l-[3px] border-l-[#BAF14D] px-4 py-3`}>
      <div className="mb-1 flex items-center gap-[7px]">
        <MapPin size={15} color={LIME} weight="fill" />
        <span className="font-display text-[13px] font-bold text-[#F4F8EE]">Around you</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(186,241,77,0.14)] px-2 py-[2px]">
          <span className="h-[5px] w-[5px] rounded-full bg-[#BAF14D] motion-safe:animate-live-pulse" />
          <span className="font-ui text-[9px] font-bold tracking-[0.8px] text-[#BAF14D]">LIVE</span>
        </span>
        <span className="flex-1" />
        <span className="font-ui text-[11.5px] text-white/75">Edit ›</span>
      </div>
      <div className="flex flex-1 items-center gap-[9px] border-b border-white/[0.07]">
        <Badge bg="#00843D">E</Badge>
        <span className="flex-1">
          <span className="font-ui block text-[14px] font-bold text-[#F4F8EE]">Medford/Tufts</span>
          <span className="font-ui mt-px flex items-center gap-1 text-[11px] font-semibold text-[#BAF14D]">
            <PersonSimpleWalk size={12} color={LIME} /> 4 min walk · you&rsquo;ll make this one
          </span>
        </span>
        <span className="text-right">
          <span className="font-display text-[20px] font-extrabold text-white">6</span>{' '}
          <span className="font-ui text-[11px] text-white/75">min</span>
        </span>
      </div>
      <div className="flex flex-1 items-center gap-[9px] border-b border-white/[0.07]">
        <Badge bg="#FFC72C" fg="#191A2E">87</Badge>
        <span className="font-ui flex-1 text-[14px] font-bold text-[#F4F8EE]">Somerville Ave</span>
        <span className="text-right">
          <span className="font-display text-[20px] font-extrabold text-white">4</span>{' '}
          <span className="font-ui text-[11px] text-white/75">min</span>
        </span>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Bicycle size={15} color={LIME} />
        <span className="font-ui text-[12px] text-white/80">
          <b className="text-[#BAF14D]">7 bikes</b> at Elm St · 2 trains · 5 buses nearby
        </span>
      </div>
    </div>
  )
}

function ModeChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-[6px] rounded-[10px] border border-white/25 px-[11px] py-[7px]">
      {icon}
      <span className="font-ui text-[12px] font-semibold text-[#F4F8EE]">{label}</span>
    </span>
  )
}

export function UpNextCard() {
  return (
    <div className="flex h-[160px] flex-col gap-[7px] rounded-[14px] border border-white/[0.07] border-l-[4px] border-l-[#BAF14D] bg-[#1A2438] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className={slab}>Up next</span>
        <span className="font-mono text-[9px] tracking-[0.8px] text-white/75">YOUR COMMUTE · 11:29 AM</span>
      </div>
      <div className="font-display text-[18px] font-bold leading-[1.15] tracking-[-0.3px] text-[#F4F8EE]">
        Beautiful day to head to school
      </div>
      <div className="font-ui text-[12.5px] text-white/80">76°F, partly sunny</div>
      <div className="flex items-center gap-2">
        <ModeChip icon={<Bicycle size={13} color="#F4F8EE" />} label="Bike 5 min" />
        <ModeChip icon={<Car size={13} color="#F4F8EE" />} label="Drive 5 min" />
        <ModeChip icon={<TrainSimple size={13} color="#F4F8EE" />} label="Transit 9 min" />
        <span className="flex-1" />
        <span className="font-ui text-[12.5px] font-bold text-[#BAF14D]">Details ›</span>
      </div>
    </div>
  )
}

export function ConfirmTripsCard() {
  return (
    <div className={`${card} flex h-[116px] flex-col gap-2 border-l-[3px] border-l-[#F5A524] px-[14px] py-3`}>
      <span className={slab}>Confirm your trips · 1</span>
      <div className="flex items-center gap-2">
        <Bus size={18} color="#F4F8EE" />
        <span className="font-ui flex-1 text-[14px] font-bold text-[#F4F8EE]">Vehicular trip · 3.2 mi · 8:14 AM</span>
      </div>
      <div className="flex gap-2">
        <span className="font-ui inline-flex h-[44px] flex-1 items-center justify-center rounded-[10px] bg-[#BAF14D] text-[13px] font-bold text-[#191A2E]">
          Set travel mode
        </span>
        <span className="font-ui inline-flex h-[44px] items-center rounded-[10px] border border-white/25 px-[14px] text-[13px] font-semibold text-white/80">
          Dismiss
        </span>
      </div>
    </div>
  )
}

export function StatusBar() {
  return (
    <div className={`${card} flex h-[88px] flex-col justify-between px-[14px] py-3`}>
      <div className="flex items-center gap-[10px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(237,185,60,0.18)]">
          <PacesetterIcon size={16} />
        </div>
        <div className="flex-1">
          <div className="font-ui text-[15px] font-bold leading-[1.1] text-white">Pacesetter</div>
          <div className="font-ui text-[11px] text-white/75">361 of 500 trips</div>
        </div>
        <div className="border-l border-white/10 pl-3 text-right">
          <div className="font-ui text-[15px] font-bold leading-[1.1] text-white">73%</div>
          <div className="font-ui text-[9.5px] tracking-[0.6px] text-white/75">SHIFT RATE · 60D</div>
        </div>
        <div className="flex items-center gap-[5px] border-l border-white/10 pl-3 text-right">
          <Flame size={16} color="#FF8C35" weight="fill" />
          <div>
            <div className="font-ui text-[15px] font-bold leading-[1.1] text-white">137</div>
            <div className="font-ui text-[9.5px] tracking-[0.6px] text-white/75">DAY STREAK</div>
          </div>
        </div>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-white/10">
        <div className="h-full w-[72%] rounded-sm" style={{ background: BLUE }} />
      </div>
    </div>
  )
}

export function NewRoutesStrip() {
  return (
    <div className={`${card} flex h-[84px] items-center gap-3 border-l-[3px] border-l-[#BAF14D] px-[14px] py-3`}>
      <Gift size={20} color={LIME} />
      <span className="flex-1">
        <span className="font-ui text-[14px] font-bold text-[#F4F8EE]">
          Your $10 gift card <span className="font-normal text-white/75">· 6 of 10 trips</span>
        </span>
        <span className="mt-2 block h-[5px] overflow-hidden rounded-[3px] bg-white/[0.12]">
          <span className="block h-full w-[60%] rounded-[3px] bg-[#BAF14D]" />
        </span>
      </span>
      <CaretRight size={14} color="rgba(255,255,255,0.75)" />
    </div>
  )
}

function TripRow({ label, meta, amount }: { label: string; meta: string; amount: string }) {
  return (
    <div className="flex flex-1 items-center gap-[10px] border-b border-white/[0.07]">
      <PersonSimpleWalk size={18} color={LIME} />
      <span className="font-ui flex-1 text-[14px] text-[#F4F8EE]">
        <b>{label}</b> <span className="text-white/75">· {meta}</span>
      </span>
      <Check size={11} color={LIME} weight="bold" />
      <span className="font-ui text-[14px] font-bold text-[#BAF14D]">{amount}</span>
    </div>
  )
}

export function RecentTripsCard() {
  return (
    <div className={`${card} flex h-[180px] flex-col px-[14px] py-3`}>
      <span className={`${slab} mb-2`}>Recent trips</span>
      <TripRow label="Walked" meta="0.4 mi · Sat" amount="$0.29" />
      <TripRow label="Walked" meta="0.7 mi · Sat" amount="$0.46" />
      <div className="flex items-center justify-between pt-[10px]">
        <span className="font-ui text-[13px] font-bold text-[#BAF14D]">See all trips →</span>
        <span className="font-ui text-[13px] font-semibold text-white/80">Log a missed trip</span>
      </div>
    </div>
  )
}

export { AMBER }
