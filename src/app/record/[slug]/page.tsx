import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { FieldRecorderCampaign, FieldRecorderPrompt } from '@/lib/field-recorder-types'
import FieldRecorder from './FieldRecorder'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServerSupabaseClient()

  const { data: campaign } = await supabase
    .from('wmu_campaigns')
    .select('name, funder_name')
    .eq('campaign_slug', slug)
    .eq('status', 'active')
    .or('field_recorder_enabled.eq.true,upload_enabled.eq.true')
    .single()

  if (!campaign) {
    return { title: 'Campaign Not Available | Green Streets Initiative' }
  }

  return {
    title: `${campaign.name} | Green Streets Initiative`,
    description: `Share your story for ${campaign.funder_name ?? 'Green Streets Initiative'} — record a short video response.`,
  }
}

export default async function RecordPage({ params }: Props) {
  const { slug } = await params
  const supabase = createServerSupabaseClient()

  // Fetch campaign and prompts in parallel
  const [campRes, promptsRes] = await Promise.all([
    supabase
      .from('wmu_campaigns')
      .select(
        'id, name, campaign_slug, funder_name, consent_copy, confirmation_copy, field_recorder_enabled, field_recorder_collect_email, upload_enabled, supported_languages',
      )
      .eq('campaign_slug', slug)
      .eq('status', 'active')
      .or('field_recorder_enabled.eq.true,upload_enabled.eq.true')
      .single(),
    supabase
      .from('wmu_campaigns')
      .select('id')
      .eq('campaign_slug', slug)
      .eq('status', 'active')
      .single()
      .then(async (res) => {
        if (!res.data) return { data: null }
        return supabase
          .from('wmu_prompts')
          .select(
            'id, campaign_id, sort_order, prompt_text, hint_text, prompt_text_i18n, hint_text_i18n, max_duration_seconds, is_optional',
          )
          .eq('campaign_id', res.data.id)
          .order('sort_order', { ascending: true })
      }),
  ])

  if (!campRes.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191A2E]">
        <div className="max-w-md text-center px-6">
          <h1 className="font-display text-2xl font-bold text-white mb-3">
            Campaign Not Available
          </h1>
          <p className="text-[#8A8DA8]">
            This campaign is not currently open for responses. If you believe
            this is an error, please contact{' '}
            <a
              href="mailto:info@gogreenstreets.org"
              className="text-[#BAF14D] underline"
            >
              info@gogreenstreets.org
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  const campaign = campRes.data as FieldRecorderCampaign
  const prompts = (promptsRes.data ?? []) as FieldRecorderPrompt[]

  return <FieldRecorder campaign={campaign} prompts={prompts} />
}
