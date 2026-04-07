-- ============================================================
-- Shift Employer Platform — groups + group_members
-- Phase 1 foundation tables for employer challenges
-- ============================================================

-- ── groups table ─────────────────────────────────────────────

CREATE TABLE groups (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT NOT NULL,
  slug                    TEXT UNIQUE NOT NULL,
  group_type              TEXT NOT NULL DEFAULT 'workplace',
                          -- 'workplace' | 'school' | 'neighborhood'

  logo_url                TEXT,
  website_url             TEXT,
  city                    TEXT,
  state                   TEXT DEFAULT 'MA',

  -- Admin contact (portal login)
  admin_name              TEXT,
  admin_email             TEXT NOT NULL,
  admin_phone             TEXT,

  -- Invite code for employee joining
  invite_code             TEXT UNIQUE NOT NULL DEFAULT '',
  -- Default '' is overwritten by trigger; NOT NULL + UNIQUE enforced

  -- Public leaderboard visibility (opt-in)
  public_leaderboard      BOOLEAN DEFAULT false,

  -- Platform access
  tier                    TEXT DEFAULT 'basic',
                          -- 'basic' | 'standard' | 'premium'
  access_starts_at        TIMESTAMPTZ,
  access_ends_at          TIMESTAMPTZ,
  status                  TEXT DEFAULT 'pending',
                          -- 'pending' | 'active' | 'inactive' | 'cancelled'

  -- Supabase Auth link
  user_id                 UUID REFERENCES auth.users(id),

  -- Stripe (populated in Phase 5)
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_status           TEXT,

  -- Metadata
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE groups IS 'Employer/school/neighborhood groups for Shift challenges';
COMMENT ON COLUMN groups.invite_code IS '6-char alphanumeric code employees use to join';
COMMENT ON COLUMN groups.public_leaderboard IS 'When true, group appears on the SYS Corporate Challenge tab';
COMMENT ON COLUMN groups.user_id IS 'FK to auth.users — the employer admin who logs into the portal';


-- ── Invite code auto-generation trigger ─────────────────────

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if no code was explicitly provided
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── group_members table ─────────────────────────────────────

CREATE TABLE group_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

COMMENT ON TABLE group_members IS 'Tracks which users belong to which employer/group';


-- ── RLS: groups ─────────────────────────────────────────────

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Employer admin can read/write their own group
CREATE POLICY "employer_own_group" ON groups
  FOR ALL USING (auth.uid() = user_id);

-- GSI admin (role set in user_metadata) can manage all groups
CREATE POLICY "gsiadmin_all_groups" ON groups
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Public leaderboard page needs to read groups that opted in
CREATE POLICY "anon_read_public_groups" ON groups
  FOR SELECT USING (public_leaderboard = true);


-- ── RLS: group_members ──────────────────────────────────────

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "own_memberships" ON group_members
  FOR SELECT USING (auth.uid() = user_id);

-- Group admin can see all members in their group
CREATE POLICY "group_admin_members" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Authenticated users can join a group (insert their own membership)
CREATE POLICY "user_join_group" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can leave a group (delete their own membership)
CREATE POLICY "user_leave_group" ON group_members
  FOR DELETE USING (auth.uid() = user_id);

-- GSI admin can manage all memberships
CREATE POLICY "gsiadmin_all_members" ON group_members
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );


-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX idx_groups_admin_email ON groups (admin_email);
CREATE INDEX idx_groups_invite_code ON groups (invite_code);
CREATE INDEX idx_groups_status ON groups (status);
CREATE INDEX idx_group_members_user_id ON group_members (user_id);
CREATE INDEX idx_group_members_group_id ON group_members (group_id);
