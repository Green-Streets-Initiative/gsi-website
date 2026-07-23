-- ============================================================
-- Append-only archive of Employer Platform Agreement acceptances
-- ============================================================
-- The groups.* agreement columns hold only the LATEST acceptance and
-- the confirmation email is best-effort — neither is a durable record
-- of exactly what text was accepted. This table is: one row per
-- acceptance, with a full plain-text snapshot of the accepted version,
-- written server-side by api/employer/agreement/accept. Never updated
-- or deleted; a future re-acceptance adds a new row.

CREATE TABLE IF NOT EXISTS public.agreement_acceptances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES public.groups(id),
  accepted_by_email text NOT NULL,
  accepted_name  text NOT NULL,
  accepted_title text NOT NULL,
  version        text NOT NULL,
  text_snapshot  text NOT NULL,
  ip_address     text,
  user_agent     text,
  accepted_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreement_acceptances_group
  ON public.agreement_acceptances (group_id, accepted_at DESC);

-- Service-role only: no client reads or writes.
ALTER TABLE public.agreement_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agreement_acceptances FROM anon, authenticated;

COMMENT ON TABLE public.agreement_acceptances IS
  'Append-only evidentiary record of click-wrap acceptances (full accepted text per row). Written only by the accept API route with the service role.';
