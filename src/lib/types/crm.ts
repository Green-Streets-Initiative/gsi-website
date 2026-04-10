// CRM entity types — matches Supabase schema verified 2026-04-03

export interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  organization_id: string | null
  title: string | null
  neighborhood: string | null
  classification_status: string // 'unclassified' | 'enriched' | 'qualified'
  loops_contact_id: string | null
  loops_subscribed: boolean
  loops_unsubscribed_at: string | null
  apollo_contact_id: string | null
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  website: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  type: string | null
  notes: string | null
  apollo_org_id: string | null
  created_at: string
  updated_at: string
}

export interface RelationshipType {
  id: string // text PK, e.g. "rewards_partner"
  label: string
  description: string | null
  sort_order: number
}

export interface PipelineStage {
  id: string
  relationship_type_id: string
  name: string
  sort_order: number
  is_terminal: boolean
  terminal_outcome: string | null
}

export interface ContactRelationship {
  id: string
  contact_id: string | null
  organization_id: string | null
  relationship_type_id: string
  stage_id: string | null
  status: string
  started_at: string
  updated_at: string
  notes: string | null
}

export interface Interaction {
  id: string
  contact_id: string | null
  organization_id: string | null
  contact_relationship_id: string | null
  type: string // 'email' | 'call' | 'meeting' | 'note' | 'event'
  direction: string | null // 'inbound' | 'outbound'
  subject: string | null
  body: string | null
  occurred_at: string
  gmail_message_id: string | null
  created_at: string
}

export interface Draft {
  id: string
  contact_id: string | null
  organization_id: string | null
  contact_relationship_id: string | null
  subject: string
  body: string
  status: string // 'pending_review' | 'pushed_to_gmail' | 'sent' | 'discarded'
  gmail_draft_id: string | null
  gmail_message_id: string | null
  generated_by: string
  created_at: string
  updated_at: string
}

export interface ContactEnrichment {
  id: string
  contact_id: string
  source: string
  raw_data: Record<string, unknown> | null
  enriched_at: string
  linkedin_url: string | null
  twitter_handle: string | null
  seniority: string | null
  department: string | null
}

// View types

export interface ContactPipelineRow {
  contact_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  classification_status: string
  loops_subscribed: boolean
  organization_name: string | null
  relationship_id: string
  relationship_type_id: string
  relationship_type_label: string
  current_stage: string
  relationship_status: string
  started_at: string
  relationship_updated_at: string
}

export interface PendingDraftRow {
  draft_id: string
  subject: string
  body: string
  status: string
  generated_by: string
  created_at: string
  gmail_draft_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  organization_name: string | null
  relationship_type_label: string | null
  pipeline_stage: string | null
}

// Joined types for list views

export interface ContactWithOrg extends Contact {
  organization: Pick<Organization, 'name'> | null
}

export interface ContactWithRelationships extends Contact {
  organization: Organization | null
  contact_relationships: (ContactRelationship & {
    relationship_type: RelationshipType
    pipeline_stage: PipelineStage | null
  })[]
}

export interface InteractionWithContact extends Interaction {
  contact: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'email'> | null
  organization: Pick<Organization, 'name'> | null
}
