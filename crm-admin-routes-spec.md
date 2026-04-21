# CRM Admin Dashboard — Route Spec
_Next.js App Router · Supabase · gogreenstreets.org admin dashboard_

---

## Context

This spec adds a `/admin/crm` section to the existing GSI admin dashboard. It should match the existing admin layout, navigation, and component patterns exactly. All data fetching follows the existing Supabase SSR pattern used elsewhere in the admin.

The CRM schema is already live in Supabase. Refer to the existing table definitions for `contacts`, `organizations`, `contact_relationships`, `pipeline_stages`, `relationship_types`, `interactions`, `drafts`, and the views `v_contact_pipeline` and `v_pending_drafts`.

---

## Route Structure

```
app/
  admin/
    crm/
      page.tsx                          # CRM home — redirect to /admin/crm/contacts
      layout.tsx                        # CRM sub-nav (tabs: Contacts, Pipeline, Drafts, Interactions)
      contacts/
        page.tsx                        # Contact list
        [id]/
          page.tsx                      # Contact detail
      pipeline/
        page.tsx                        # Pipeline board
      drafts/
        page.tsx                        # Draft queue
      interactions/
        page.tsx                        # Interaction log
```

---

## Shared CRM Layout (`crm/layout.tsx`)

Wraps all CRM routes in a sub-navigation bar with four tabs:

- Contacts
- Pipeline
- Drafts (show count badge of `pending_review` drafts)
- Interactions

Active tab is highlighted. Layout sits inside the existing admin layout — do not recreate the outer shell.

---

## 1. Contacts List (`crm/contacts/page.tsx`)

### Purpose
The primary view for browsing, searching, and filtering all 1,900+ imported contacts.

### Data
Query the `contacts` table joined to `organizations`. Use server component with Supabase SSR. Support URL search params for filters so state is shareable/bookmarkable.

```typescript
// Core query shape
select * from contacts
left join organizations on organizations.id = contacts.organization_id
order by created_at desc
```

### UI

**Toolbar (above table):**
- Search input — filters on `email`, `first_name`, `last_name`, `organization.name` (debounced, updates URL param `q`)
- Filter: Classification status — dropdown: All / Unclassified / Enriched / Qualified
- Filter: Loops subscribed — dropdown: All / Subscribed / Unsubscribed
- Filter: Relationship type — dropdown: All + each relationship_type label (filters via `contact_relationships` join)
- Count label: "1,927 contacts" (updates with filters)

**Table columns:**
| Column | Source | Notes |
|---|---|---|
| Name | first_name + last_name | Fallback to email prefix if no name |
| Email | email | |
| Organization | organizations.name | — if none |
| Status | classification_status | Pill: unclassified (gray) · enriched (blue) · qualified (green) |
| Loops | loops_subscribed | Icon: subscribed (green check) · unsubscribed (gray) |
| Relationship tracks | contact_relationships count | "2 tracks" or specific label if only 1 |
| Added | created_at | Relative date |

- Clicking a row navigates to `/admin/crm/contacts/[id]`
- Pagination: 50 per page, offset-based, page number in URL param

### Empty state
"No contacts match your filters." with a clear filters link.

---

## 2. Contact Detail (`crm/contacts/[id]/page.tsx`)

### Purpose
Full view of a single contact — all relationship tracks, full interaction history, and any pending drafts.

### Data
Fetch contact by `id` with:
- Organization (if any)
- All `contact_relationships` with their `pipeline_stages` and `relationship_types`
- All `interactions` ordered by `occurred_at desc`
- All `drafts` for this contact ordered by `created_at desc`
- `contact_enrichment` record if exists

### Layout

**Header:**
- Full name (or email if no name)
- Email (mailto link)
- Organization name + title if present
- Classification status pill
- Loops subscribed status
- Edit button (opens inline edit form for name, title, notes, organization, classification_status)

**Three-column or tabbed layout (match existing admin detail page pattern):**

_Left/main: Relationship Tracks_
- One card per `contact_relationship`
- Shows: relationship type label, current pipeline stage, status, started date
- Stage shown as a simple step indicator (all stages for that type, current highlighted)
- "Add track" button → modal to select relationship_type and initial stage

_Center/main: Interaction History_
- Chronological list of all interactions
- Each item shows: type icon (email/call/meeting/note), direction (inbound/outbound), subject, occurred_at
- Expandable body text on click
- "Log interaction" button → inline form: type, direction, subject, body, occurred_at

_Right/sidebar: Drafts & Notes_
- Any drafts for this contact (status pill, subject, generated_by, created_at)
- Contact notes field (editable inline)
- Enrichment data if present (LinkedIn URL, seniority, department)
- Source + created_at metadata

---

## 3. Pipeline Board (`crm/pipeline/page.tsx`)

### Purpose
Kanban-style view of contacts moving through pipeline stages, scoped to one relationship type at a time.

### Data
Query `v_contact_pipeline`. Filter by selected `relationship_type_id`. Group by `current_stage`.

### UI

**Relationship type selector:**
Segmented control or tab row across the top: Rewards Partner · School · Funder · Flagship Sponsor · Employer · Donor · Institutional · Board

**Kanban board:**
- One column per pipeline stage for the selected relationship type
- Each card shows: contact name, email, organization name, days in current stage
- Cards are not drag-and-drop in V1 — clicking a card opens contact detail in a slide-over or navigates to `/admin/crm/contacts/[id]`
- Column header shows stage name + count

**Stage advancement:**
On the contact detail page (not the board), a "Move to next stage" button advances `contact_relationships.stage_id` to the next stage in order. Confirm dialog for terminal stages.

### Empty state per column
Subtle dashed border card: "No contacts at this stage."

---

## 4. Draft Queue (`crm/drafts/page.tsx`)

### Purpose
Review all agent-generated drafts before or after Gmail push. The primary queue Keith uses to review outreach before it goes out.

### Data
Query `v_pending_drafts` (returns `pending_review` and `pushed_to_gmail` drafts with contact + pipeline context). Also show recently `sent` and `discarded` drafts in a secondary section.

### UI

**Two sections:**

_Pending review (primary):_
- List of drafts with status `pending_review` or `pushed_to_gmail`
- Each item shows: contact name, email, organization, relationship type, pipeline stage, subject, generated_by badge, created_at
- Expand to show full email body
- Actions:
  - "Push to Gmail" — calls edge function to create Gmail draft via MCP (only shown for `pending_review`)
  - "Mark sent" — sets status to `sent`, writes occurred_at to interactions (for manually confirmed sends)
  - "Discard" — sets status to `discarded` with confirm dialog

_Recently sent / discarded (secondary, collapsed by default):_
- Last 20 drafts with status `sent` or `discarded`
- Read-only, shows gmail_message_id if present

### Empty state
"No pending drafts. The partner pipeline agent will populate this queue when outreach is generated."

---

## 5. Interaction Log (`crm/interactions/page.tsx`)

### Purpose
Full cross-contact interaction history. Useful for reviewing all recent outreach activity.

### Data
Query `interactions` table joined to `contacts` and `organizations`, ordered by `occurred_at desc`.

### UI

**Toolbar:**
- Filter: interaction type (All / Email / Call / Meeting / Note / Event)
- Filter: direction (All / Inbound / Outbound)
- Date range picker (from / to)

**Table:**
| Column | Notes |
|---|---|
| Date | occurred_at, relative + absolute on hover |
| Contact | name + email |
| Organization | if present |
| Type | icon + label |
| Direction | Inbound / Outbound pill |
| Subject | truncated, expandable |

- Pagination: 50 per page
- Clicking a row links to the relevant contact detail page

---

## Data Mutations

All mutations use **Server Actions** (App Router pattern). Do not use API routes.

Key actions needed:

```typescript
// contacts
updateContact(id, fields)              // name, title, notes, organization_id, classification_status

// contact_relationships
addRelationshipTrack(contactId, relationshipTypeId, stageId)
advanceStage(relationshipId, newStageId)
updateRelationshipStatus(relationshipId, status)

// interactions
logInteraction(contactId, organizationId, relationshipId, type, direction, subject, body, occurredAt)

// drafts
updateDraftStatus(draftId, status)     // pushed_to_gmail | sent | discarded
pushDraftToGmail(draftId)             // calls Gmail MCP edge function — stub for now, implement in Claude Code with MCP access
```

---

## Design Notes

- Match the existing admin dashboard's color palette, typography, and component library exactly
- Classification status pills: unclassified = gray, enriched = blue, qualified = green
- Use the GSI design system colors where applicable: navy `#191A2E`, blue `#2966E5`, lime `#BAF14D`
- Relationship type labels should use consistent color coding across pipeline and contact views — define a stable color map for the 8 relationship types
- All tables should handle loading states with skeleton rows matching the existing admin skeleton pattern
- Empty states should be friendly and actionable, not just "No data"
- The draft queue is the most time-sensitive view — it should be the most visually prominent, with clear action buttons

---

## Out of Scope for V1

- Drag-and-drop stage advancement on the pipeline board
- Bulk actions on contacts (bulk classify, bulk assign relationship)
- Apollo enrichment trigger UI (will be added in V2)
- Loops sync status per contact
- Organization detail pages (organizations are referenced but don't have their own route yet)
- Search across interactions

---

## Implementation Notes for Claude Code

- Read existing admin page files before writing any new ones — match the file structure, import paths, component naming, and Supabase client instantiation pattern exactly
- Check whether the project uses a shared `AdminTable`, `AdminCard`, or similar component and use it
- The `v_contact_pipeline` and `v_pending_drafts` views are already created in Supabase and can be queried like tables
- `pipeline_stages` and `relationship_types` are relatively static — they can be fetched once in the layout and passed down, or cached aggressively
- The `pushDraftToGmail` server action should be stubbed with a `// TODO: implement via Gmail MCP` comment and return a mock success response — the actual Gmail integration will be wired up separately
- Supabase RLS is enabled on all CRM tables — the server-side Supabase client (with service role key) should be used for admin operations, consistent with the existing admin pattern
