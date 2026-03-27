CREATE TABLE volunteer_inquiries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  roles         TEXT[] NOT NULL,
  about         TEXT,
  referral      TEXT,
  status        TEXT DEFAULT 'new',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS: no public read/write — only service role can insert, admin can read
ALTER TABLE volunteer_inquiries ENABLE ROW LEVEL SECURITY;
