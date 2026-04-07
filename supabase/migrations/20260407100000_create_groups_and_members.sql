-- ============================================================
-- Shift Employer Platform — ALTER groups + group_members
-- Phase 1: add employer portal columns to existing tables
--
-- Existing schema (from Shift app):
--   groups: id, name, description, type (enum), visibility (enum),
--           created_by, invite_code, created_at, neighborhood_id
--   group_members: group_id, user_id, role (enum), joined_at
-- ============================================================

-- ── Add employer portal columns to groups ───────────────────

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS slug                    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS logo_url                TEXT,
  ADD COLUMN IF NOT EXISTS website_url             TEXT,
  ADD COLUMN IF NOT EXISTS city                    TEXT,
  ADD COLUMN IF NOT EXISTS state                   TEXT DEFAULT 'MA',

  ADD COLUMN IF NOT EXISTS admin_name              TEXT,
  ADD COLUMN IF NOT EXISTS admin_email             TEXT,
  ADD COLUMN IF NOT EXISTS admin_phone             TEXT,

  ADD COLUMN IF NOT EXISTS public_leaderboard      BOOLEAN DEFAULT false,

  ADD COLUMN IF NOT EXISTS tier                    TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS access_starts_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status                  TEXT DEFAULT 'pending',

  -- Supabase Auth link (employer admin who logs into the portal)
  ADD COLUMN IF NOT EXISTS user_id                 UUID REFERENCES auth.users(id),

  -- Stripe (populated in Phase 5)
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_status           TEXT,

  ADD COLUMN IF NOT EXISTS notes                   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT now();

COMMENT ON TABLE groups IS 'Employer/school/neighborhood groups for Shift challenges';
COMMENT ON COLUMN groups.invite_code IS '6-char alphanumeric code employees use to join';
COMMENT ON COLUMN groups.public_leaderboard IS 'When true, group appears on the SYS Corporate Challenge tab';
COMMENT ON COLUMN groups.user_id IS 'FK to auth.users — the employer admin who logs into the portal';


-- ── Add id column to group_members (existing PK is composite) ──

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Add unique constraint on (group_id, user_id) if not already present
-- The existing table may already enforce this via PK or unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_members'::regclass
    AND contype IN ('p', 'u')
    AND array_length(conkey, 1) = 2
  ) THEN
    ALTER TABLE group_members ADD CONSTRAINT group_members_group_user_unique UNIQUE (group_id, user_id);
  END IF;
END $$;


-- ── Invite code auto-generation trigger ─────────────────────
-- Only generates if invite_code is NULL or empty on INSERT

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS set_invite_code ON groups;
CREATE TRIGGER set_invite_code
  BEFORE INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION generate_invite_code();


-- ── updated_at auto-update trigger ──────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS groups_updated_at ON groups;
CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── RLS: groups ─────────────────────────────────────────────

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Employer admin can read/write their own group
DO $$ BEGIN
  CREATE POLICY "employer_own_group" ON groups
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GSI admin can manage all groups (uses existing is_gsi_admin() function)
DO $$ BEGIN
  CREATE POLICY "gsiadmin_all_groups" ON groups
    FOR ALL USING (is_gsi_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public leaderboard page needs to read groups that opted in
DO $$ BEGIN
  CREATE POLICY "anon_read_public_groups" ON groups
    FOR SELECT USING (public_leaderboard = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── RLS: group_members ──────────────────────────────────────

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own_memberships" ON group_members
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "group_admin_members" ON group_members
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM groups
        WHERE groups.id = group_members.group_id
        AND groups.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_join_group" ON group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_leave_group" ON group_members
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "gsiadmin_all_members" ON group_members
    FOR ALL USING (is_gsi_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── Indexes (IF NOT EXISTS) ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_groups_admin_email ON groups (admin_email);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups (invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups (status);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members (group_id);
