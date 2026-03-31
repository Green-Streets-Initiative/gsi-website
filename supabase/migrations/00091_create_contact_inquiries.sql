CREATE TABLE contact_inquiries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  inquiry_type    TEXT NOT NULL,
  message         TEXT NOT NULL,
  company_name    TEXT,
  team_size       TEXT,
  school_name     TEXT,
  grade_levels    TEXT[],
  business_name   TEXT,
  neighborhood    TEXT,
  status          TEXT DEFAULT 'new',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: no public read/write — only service role can insert, admin can read
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
