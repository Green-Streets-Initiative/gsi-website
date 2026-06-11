'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

interface PortalContextValue {
  group: Group | null
  role: 'admin' | 'viewer'
  admins: GroupAdmin[]
  challenges: Challenge[]
  memberCount: number
  dashboard: DashboardData | null
  members: EmployerMember[]
  rewardPool: RewardPool | null
  challengePrizes: ChallengePrize[]
  prizeWinnersMap: Record<string, PrizeWinner[]>
  benefitsForm: EmployerBenefits

  loading: boolean
  loadingMembers: boolean
  authenticated: boolean

  isAdmin: boolean

  tierAtLeast: (tier: 'starter' | 'basic' | 'standard' | 'premium') => boolean

  setGroup: (g: Group) => void
  setChallenges: (c: Challenge[]) => void
  setMemberCount: (n: number) => void
  setDashboard: (d: DashboardData | null) => void
  setMembers: (m: EmployerMember[]) => void
  setRewardPool: (p: RewardPool | null) => void
  setChallengePrizes: (p: ChallengePrize[]) => void
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

export function PortalProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [group, setGroup] = useState<Group | null>(null)
  const [role, setRole] = useState<'admin' | 'viewer'>('admin')
  const [admins, setAdmins] = useState<GroupAdmin[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [members, setMembers] = useState<EmployerMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [rewardPool, setRewardPool] = useState<RewardPool | null>(null)
  const [challengePrizes, setChallengePrizes] = useState<ChallengePrize[]>([])
  const [prizeWinnersMap, setPrizeWinnersMap] = useState<Record<string, PrizeWinner[]>>({})
  const [benefitsForm, setBenefitsForm] = useState<EmployerBenefits>({})

  const tierAtLeast = useCallback(
    (tier: 'starter' | 'basic' | 'standard' | 'premium') => isTierAtLeast(group, tier),
    [group],
  )

  const fetchData = useCallback(
    async (email: string) => {
      try {
        await supabase.rpc('link_employer_on_login')
      } catch {}

      const { data: adminRow } = await supabase
        .from('group_admins')
        .select('group_id, role')
        .eq('email', email)
        .limit(1)
        .maybeSingle()

      if (!adminRow) {
        router.push('/shift/employers')
        return
      }

      setRole(adminRow.role as 'admin' | 'viewer')

      const { data: groupData } = await supabase
        .from('groups')
        .select(
          'id, name, slug, status, admin_name, admin_email, admin_phone, website_url, logo_url, invite_code, tier, access_starts_at, access_ends_at, public_leaderboard, employer_benefits',
        )
        .eq('id', adminRow.group_id)
        .maybeSingle()

      if (!groupData) {
        router.push('/shift/employers')
        return
      }

      setGroup(groupData)
      const eb = (groupData.employer_benefits || {}) as EmployerBenefits
      setBenefitsForm(eb)

      const now = new Date().toISOString()
      const poolPromise =
        groupData.tier === 'premium'
          ? supabase
              .from('reward_pools')
              .select('id, name, balance_cents, lifetime_funded_cents, lifetime_spent_cents, active')
              .eq('owner_type', 'employer')
              .eq('owner_group_id', groupData.id)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const)

      const [challengeRes, memberRes, dashboardRes, membersRes, poolRes, adminsRes] = await Promise.all([
        supabase
          .from('competitions')
          .select('id, name, metric, starts_at, ends_at, prize_description')
          .eq('group_id', groupData.id)
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
        supabase
          .from('group_admins')
          .select('id, group_id, email, role, name, created_at')
          .eq('group_id', groupData.id)
          .order('created_at'),
      ])

      if (challengeRes.data && challengeRes.data.length > 0) {
        const allChallenges = challengeRes.data.map((c) => ({
          ...c,
          public_leaderboard: groupData.public_leaderboard ?? false,
        })) as Challenge[]
        setChallenges(allChallenges)

        const challengeIds = allChallenges.map((c) => c.id)
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
    [router],
  )

  useEffect(() => {
    async function checkAuth() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (tokenHash && type === 'magiclink') {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        })
        if (error) {
          console.error('Magic link verification failed:', error.message)
          router.push('/shift/employers')
          return
        }
        window.history.replaceState({}, '', window.location.pathname)
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user?.email) {
        router.push('/shift/employers')
        return
      }

      setAuthenticated(true)
      fetchData(session.user.email)
    }
    checkAuth()
  }, [fetchData, router, searchParams])

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

      const { data } = await supabase.rpc('get_employer_dashboard_data', rpcParams)
      if (data && !(data as { error?: string }).error) {
        setDashboard(data as DashboardData)
      }
    },
    [group],
  )

  const refreshPool = useCallback(async () => {
    if (!group || !rewardPool) return
    const { data } = await supabase
      .from('reward_pools')
      .select('id, name, balance_cents, lifetime_funded_cents, lifetime_spent_cents, active')
      .eq('id', rewardPool.id)
      .single()
    if (data) setRewardPool(data as RewardPool)
  }, [group, rewardPool])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/shift/employers')
  }, [router])

  const isAdmin = role === 'admin'

  const value: PortalContextValue = {
    group,
    role,
    admins,
    challenges,
    memberCount,
    dashboard,
    members,
    rewardPool,
    challengePrizes,
    prizeWinnersMap,
    benefitsForm,
    loading,
    loadingMembers,
    authenticated,
    isAdmin,
    tierAtLeast,
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
