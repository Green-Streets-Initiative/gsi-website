-- Add notification preferences to group_admins (per-admin)
-- and milestone tracking to groups (per-group).

ALTER TABLE public.group_admins
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  DEFAULT '{"weekly_impact": true, "new_employee": true, "challenge_milestones": false}'::jsonb;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS milestone_last_notified INTEGER DEFAULT 0;
