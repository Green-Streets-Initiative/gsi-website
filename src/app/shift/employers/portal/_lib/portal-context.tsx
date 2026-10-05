'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type {
  Group,
  GroupAdmin,
  Challenge,
  DashboardData,
  EmployerMember,
  RewardPool,
  ChallengePrize,
  PrizeWinner,
  EmployerBenefits,
} from './portal-types'
import { hasAccess, isTierAtLeast } from './portal-utils'
import { isOwnerRow, normalizeRole, type PortalRole } from './portal-roles'

export type { PortalRole }

const LOGIN_PATH = '/shift/employers/login'

const LOAD_ERROR_MESSAGE =
  "We couldn't load your portal. Check your connection and try again — if this keeps happening, email info@gogreenstreets.org."

interface PortalContextValue {
  group: Group | null
  /** null until the sign-in check has read the admin row; nothing role-gated should show before then. */
  role: PortalRole | null
  sessionEmail: string | null
  admins: GroupAdmin[]
  challenges: Challenge[]
  memberCount: number
  dashboard: DashboardData | null
  dashboardError: string | null
  members: EmployerMember[]
  rewardPool: RewardPool | null
  challengePrizes: ChallengePrize[]
  prizeWinnersMap: Record<string, PrizeWinner[]>
  benefitsForm: EmployerBenefits

  loading: boolean
  loadingMembers: boolean
  authenticated: boolean
  /** Set when the first load threw or a query failed outright; the layout shows a retry card. */
  loadError: string | null
  /** Re-runs the sign-in check and the first load after a loadError. */
  retry: () => void
  /** The signed-in email is on no workplace portal; the layout shows NoWorkplace instead of the shell. */
  noWorkplace: boolean
  /** When the portal's data was last fetched (first load and every refreshDashboard). */
  dataFetchedAt: Date | null
  /** How many other workplace portals this email is on (the oldest one is shown). */
  otherWorkplaces: number
  /** A one-time notice from sign-in (a re-used magic link); the layout shows it as a toast and clears it. */
  authNotice: string | null
  clearAuthNotice: () => void

  /** role === 'admin'. Unchanged meaning; admin-only checks keep using it. */
  isAdmin: boolean
  /** role === 'manager' (Shift migration 01081). */
  isManager: boolean
  isGsiAdmin: boolean
  /** The signed-in person is the account owner (always an admin). */
  isOwner: boolean
  /**
   * What a Manager can do, as well as admins and GSI staff: run challenges
   * and prizes (create, edit, publish, draw, hand out), invite employees
   * (invitations, join requests, nudges), and edit the Commute Advisor page
   * and the Setup success plan.
   */
  canManageChallenges: boolean
  canInviteEmployees: boolean
  canEditAdvisor: boolean
  /** Admins and GSI staff only: who is on the team and their roles. */
  canManageTeam: boolean
  /** Admins and GSI staff only: top-ups, Stripe, the plan. */
  canManageBilling: boolean
  /** Admins and GSI staff only: account details, branding, email domains, who can join, public listing. */
  canManageAccount: boolean
  /** The Employer Platform Agreement still has to be accepted; AgreementGate is up and setup prompts stay hidden. */
  agreementGated: boolean

  tierAtLeast: (tier: 'starter' | 'basic' | 'standard' | 'premium') => boolean
  /**
   * Whether the org's platform access window is currently open. Reads still
   * work when this is false — the server allows a lapsed team to sign in and
   * see their history — but every create/edit is refused by RLS, so the UI
   * should offer renewal rather than a form that will fail.
   */
  accessActive: boolean

  setGroup: (g: Group) => void
  setChallenges: (c: Challenge[]) => void
  setMemberCount: (n: number) => void
  setDashboard: (d: DashboardData | null) => void
  setMembers: (m: EmployerMember[]) => void
  setRewardPool: (p: RewardPool | null) => void
  setChallengePrizes: React.Dispatch<React.SetStateAction<ChallengePrize[]>>
  setPrizeWinnersMap: (m: Record<string, PrizeWinner[]>) => void
  setBenefitsForm: (b: EmployerBenefits) => void
  setAdmins: (a: GroupAdmin[]) => void

  refreshMembers: (days: number) => Promise<void>
  refreshDashboard: (params: {
    startDate?: string
    endDate?: string
    days?: number
  }) => Promise<void>
  refreshPool: () => Promise<void>
  signOut: () => Promise<void>
}

const PortalContext = createContext<PortalContextValue | null>(null)

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortal must be used within PortalProvider')
  return ctx
}

const DASHBOARD_FORBIDDEN =
  "This account doesn't have access to this dashboard. Ask a teammate with admin access to re-invite you, or contact info@gogreenstreets.org."
const DASHBOARD_FAILED =
  "We couldn't load your dashboard data. Try refreshing — if this keeps happening, contact info@gogreenstreets.org."

export function PortalProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [noWorkplace, setNoWorkplace] = useState(false)
  const [dataFetchedAt, setDataFetchedAt] = useState<Date | null>(null)
  const [otherWorkplaces, setOtherWorkplaces] = useState(0)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [group, setGroup] = useState<Group | null>(null)
  const [role, setRole] = useState<PortalRole | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [admins, setAdmins] = useState<GroupAdmin[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [members, setMembers] = useState<EmployerMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [rewardPool, setRewardPool] = useState<RewardPool | null>(null)
  const [challengePrizes, setChallengePrizes] = useState<ChallengePrize[]>([])
  const [prizeWinnersMap, setPrizeWinnersMap] = useState<Record<string, PrizeWinner[]>>({})
  const [benefitsForm, setBenefitsForm] = useState<EmployerBenefits>({})
  const [isGsiAdmin, setIsGsiAdmin] = useState(false)

  const tierAtLeast = useCallback(
    (tier: 'starter' | 'basic' | 'standard' | 'premium') => isTierAtLeast(group, tier),
    [group],
  )

  // hasAccess() has existed since the platform shipped and was never called,
  // so a lapsed org kept a fully working portal. GSI admins bypass it.
  const accessActive = isGsiAdmin || (group ? hasAccess(group) : false)

  const agreementGated =
    !loading &&
    !!group &&
    !!group.agreement_required &&
    !group.agreement_accepted_at &&
    !isGsiAdmin

  const fetchData = useCallback(
    async (email: string, userId: string) => {
      try {
        await supabase.rpc('link_employer_on_login')
      } catch {}

      // Oldest membership first, so an email on several portals lands on the
      // same one every time; the count says how many more there are.
      const [adminRes, gsiRes] = await Promise.all([
        supabase
          .from('group_admins')
          .select('group_id, role', { count: 'exact' })
          .eq('email', email)
          .order('created_at', { ascending: true })
          .limit(1),
        supabase
          .from('school_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'gsi_admin')
          .maybeSingle(),
      ])

      if (adminRes.error) throw adminRes.error
      const adminRow = adminRes.data?.[0] ?? null
      setIsGsiAdmin(!!gsiRes.data)
      setOtherWorkplaces(Math.max(0, (adminRes.count ?? (adminRow ? 1 : 0)) - 1))

      if (!adminRow) {
        setNoWorkplace(true)
        setLoading(false)
        return
      }

      setRole(normalizeRole(adminRow.role))

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(
          'id, name, slug, status, admin_name, admin_email, admin_phone, website_url, logo_url, invite_code, tier, access_starts_at, access_ends_at, public_leaderboard, employer_benefits, onboarding, agreement_required, agreement_version, agreement_accepted_at, agreement_accepted_by_email',
        )
        .eq('id', adminRow.group_id)
        .maybeSingle()

      if (groupError) throw groupError
      if (!groupData) {
        setNoWorkplace(true)
        setLoading(false)
        return
      }

      // join_policy arrives with migration 01045. Until it is applied the
      // column does not exist, so it is read on its own and defaults to
      // 'open' rather than failing the whole portal load.
      let joinPolicy: Group['join_policy'] = 'open'
      try {
        const { data: jp } = await supabase.from('groups').select('join_policy').eq('id', adminRow.group_id).maybeSingle()
        const v = (jp as { join_policy?: string } | null)?.join_policy
        if (v === 'open' || v === 'work_email' || v === 'approval') joinPolicy = v
      } catch {
        /* column not there yet */
      }
      const groupRow: Group = { ...(groupData as Omit<Group, 'join_policy'>), join_policy: joinPolicy }
      setGroup(groupRow)
      const eb = (groupData.employer_benefits || {}) as EmployerBenefits
      setBenefitsForm(eb)

      const now = new Date().toISOString()
      const poolPromise =
        groupData.tier === 'standard' || groupData.tier === 'premium'
          ? supabase
              .from('reward_pools')
              .select('id, name, balance_cents, lifetime_funded_cents, lifetime_spent_cents, held_cents, active')
              .eq('owner_type', 'employer')
              .eq('owner_group_id', groupData.id)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const)

      const [challengeRes, flagshipRes, memberRes, dashboardRes, membersRes, poolRes, adminsRes] = await Promise.all([
        supabase
          .from('competitions')
          .select('id, name, metric, starts_at, ends_at, prize_description, counting_rules, contact_name, contact_email')
          .eq('group_id', groupData.id)
          .order('starts_at', { ascending: false }),
        supabase
          .from('competitions')
          .select('id, name, metric, starts_at, ends_at, prize_description')
          .eq('is_public', true)
          .is('group_id', null)
          .gte('ends_at', now)
          .contains('matchup_group_ids', [groupData.id])
          .order('starts_at', { ascending: false }),
        supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupData.id),
        supabase.rpc('get_employer_dashboard_data', {
          p_group_id: groupData.id,
          p_days: 30,
        }),
        supabase.rpc('get_employer_members', {
          p_group_id: groupData.id,
          p_days: 30,
        }),
        poolPromise,
        // '*' so is_owner comes along once Shift migration 01081 adds it,
        // without breaking this query before then.
        supabase
          .from('group_admins')
          .select('*')
          .eq('group_id', groupData.id)
          .order('created_at'),
      ])

      setDataFetchedAt(new Date())

      const groupChallenges = (challengeRes.data ?? []).map((c) => ({
        ...c,
        public_leaderboard: groupData.public_leaderboard ?? false,
      })) as Challenge[]
      const flagships = (flagshipRes.data ?? []).map((c) => ({
        ...c,
        public_leaderboard: true,
        is_flagship: true,
      })) as Challenge[]
      const existingIds = new Set(groupChallenges.map((c) => c.id))
      const uniqueFlagships = flagships.filter((c) => !existingIds.has(c.id))
      const allChallenges = [...groupChallenges, ...uniqueFlagships]
      setChallenges(allChallenges)

      if (groupChallenges.length > 0) {
        const challengeIds = groupChallenges.map((c) => c.id)
        const { data: prizesData } = await supabase
          .from('employer_challenge_prizes')
          .select('*')
          .in('competition_id', challengeIds)
          .order('display_order')

        if (prizesData && prizesData.length > 0) {
          const prizes = prizesData as ChallengePrize[]
          setChallengePrizes(prizes)

          const drawnIds = prizes
            .filter((p) => p.draw_status === 'drawn' || p.draw_status === 'fulfilled')
            .map((p) => p.id)

          if (drawnIds.length > 0) {
            const { data: winners } = await supabase
              .from('employer_prize_winners')
              .select('*')
              .in('prize_id', drawnIds)

            if (winners) {
              const map: Record<string, PrizeWinner[]> = {}
              for (const w of winners as PrizeWinner[]) {
                ;(map[w.prize_id] ??= []).push(w)
              }
              setPrizeWinnersMap(map)
            }
          }
        }
      }

      setMemberCount(memberRes.count ?? 0)

      if (dashboardRes.data && !(dashboardRes.data as { error?: string }).error) {
        setDashboard(dashboardRes.data as DashboardData)
        setDashboardError(null)
      } else {
        const code =
          (dashboardRes.data as { error?: string } | null)?.error ??
          dashboardRes.error?.message ??
          'unknown'
        setDashboardError(code === 'forbidden' ? DASHBOARD_FORBIDDEN : DASHBOARD_FAILED)
      }

      if (membersRes.data) {
        setMembers(membersRes.data as EmployerMember[])
      }

      if (poolRes && 'data' in poolRes && poolRes.data) {
        setRewardPool(poolRes.data as RewardPool)
      }

      if (adminsRes.data) {
        setAdmins(adminsRes.data as GroupAdmin[])
      }

      setLoading(false)
    },
    [],
  )

  // One run per attempt. The guard keeps React's development double-invoke
  // (and any re-render of the deps) from starting a second sign-in check.
  const ranAttempt = useRef(-1)

  useEffect(() => {
    if (ranAttempt.current === attempt) return
    ranAttempt.current = attempt

    async function checkAuth() {
      try {
        const params = new URLSearchParams(window.location.search)
        const tokenHash = params.get('token_hash')
        const type = params.get('type')

        if (tokenHash && (type === 'magiclink' || type === 'email')) {
          // Verify with the universal 'email' type: a brand-new admin's first
          // link carries a signup CONFIRMATION token (generateLink creates the
          // user), not a magiclink token — verifying strictly as 'magiclink'
          // rejected every first-ever login.
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email',
          })
          if (error) {
            // The token may already be consumed (double-click, second tab,
            // email-scanner prefetch). If a session exists anyway, proceed
            // and say so; otherwise send them for a fresh link.
            const { data: { session: existingSession } } = await supabase.auth.getSession()
            if (!existingSession?.user?.email) {
              router.replace(`${LOGIN_PATH}?error=expired`)
              return
            }
            setAuthNotice(
              `That sign-in link was already used. You're signed in as ${existingSession.user.email.toLowerCase()}.`,
            )
          }
          window.history.replaceState({}, '', window.location.pathname)
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user?.email) {
          router.replace(LOGIN_PATH)
          return
        }

        setAuthenticated(true)
        setSessionEmail(session.user.email.toLowerCase())
        await fetchData(session.user.email, session.user.id)
      } catch (err) {
        console.error('Portal load failed:', err)
        setLoadError(LOAD_ERROR_MESSAGE)
        setLoading(false)
      }
    }
    checkAuth()
  }, [attempt, fetchData, router])

  const retry = useCallback(() => {
    setLoadError(null)
    setNoWorkplace(false)
    setLoading(true)
    setAttempt((a) => a + 1)
  }, [])

  const clearAuthNotice = useCallback(() => setAuthNotice(null), [])

  const refreshMembers = useCallback(
    async (days: number) => {
      if (!group) return
      setLoadingMembers(true)
      const { data } = await supabase.rpc('get_employer_members', {
        p_group_id: group.id,
        p_days: days,
      })
      if (data) setMembers(data as EmployerMember[])
      setLoadingMembers(false)
    },
    [group],
  )

  const refreshDashboard = useCallback(
    async (params: { startDate?: string; endDate?: string; days?: number }) => {
      if (!group) return
      const rpcParams: Record<string, unknown> = {
        p_group_id: group.id,
        p_days: params.days ?? 30,
      }
      if (params.startDate) rpcParams.p_starts_at = params.startDate
      if (params.endDate) rpcParams.p_ends_at = params.endDate

      const { data, error } = await supabase.rpc('get_employer_dashboard_data', rpcParams)
      if (data && !(data as { error?: string }).error) {
        setDashboard(data as DashboardData)
        setDashboardError(null)
        setDataFetchedAt(new Date())
      } else {
        const code = (data as { error?: string } | null)?.error ?? error?.message ?? 'unknown'
        setDashboardError(code === 'forbidden' ? DASHBOARD_FORBIDDEN : DASHBOARD_FAILED)
      }
    },
    [group],
  )

  const refreshPool = useCallback(async () => {
    if (!group || !rewardPool) return
    const { data } = await supabase
      .from('reward_pools')
      .select('id, name, balance_cents, lifetime_funded_cents, lifetime_spent_cents, held_cents, active')
      .eq('id', rewardPool.id)
      .single()
    if (data) setRewardPool(data as RewardPool)
  }, [group, rewardPool])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push(LOGIN_PATH)
  }, [router])

  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const me = admins.find((a) => a.email.toLowerCase() === (sessionEmail ?? ''))
  const isOwner = !!me && isOwnerRow(me, group?.admin_email)
  const canRunPrograms = isAdmin || isManager || isGsiAdmin
  const canAdminister = isAdmin || isGsiAdmin

  const value: PortalContextValue = {
    group,
    role,
    sessionEmail,
    admins,
    challenges,
    memberCount,
    dashboard,
    dashboardError,
    members,
    rewardPool,
    challengePrizes,
    prizeWinnersMap,
    benefitsForm,
    loading,
    loadingMembers,
    authenticated,
    loadError,
    retry,
    noWorkplace,
    dataFetchedAt,
    otherWorkplaces,
    authNotice,
    clearAuthNotice,
    isAdmin,
    isManager,
    isGsiAdmin,
    isOwner,
    canManageChallenges: canRunPrograms,
    canInviteEmployees: canRunPrograms,
    canEditAdvisor: canRunPrograms,
    canManageTeam: canAdminister,
    canManageBilling: canAdminister,
    canManageAccount: canAdminister,
    agreementGated,
    tierAtLeast,
    accessActive,
    setGroup,
    setChallenges,
    setMemberCount,
    setDashboard,
    setMembers,
    setRewardPool,
    setChallengePrizes,
    setPrizeWinnersMap,
    setBenefitsForm,
    setAdmins,
    refreshMembers,
    refreshDashboard,
    refreshPool,
    signOut,
  }

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}
