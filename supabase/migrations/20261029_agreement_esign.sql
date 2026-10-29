-- ============================================================
-- Employer Platform Agreement: e-signature through SignWell
-- ============================================================
-- Keith 2026-10-28: the agreement is signed as a one-page order form
-- (with the full agreement attached in the same PDF) through SignWell,
-- the customer first and GSI second. The portal opens when the customer
-- signs; GSI's countersignature completes the record. The click-through
-- stays as another way to accept.
--
-- agreement_envelopes: one row per signature request, written only by
-- gsi-website server code (service role). The full text sent is kept on
-- the row, so a request is provable on its own; when the customer signs,
-- an agreement_acceptances row (method 'esign') is added as with a click.

CREATE TABLE IF NOT EXISTS public.agreement_envelopes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id             uuid NOT NULL REFERENCES public.groups(id),
  provider             text NOT NULL DEFAULT 'signwell',
  provider_document_id text UNIQUE,
  test_mode            boolean NOT NULL DEFAULT false,
  version              text NOT NULL,
  text_snapshot        text NOT NULL,
  -- What the order form said: company, plan, fee, dates, billing.
  order_terms          jsonb NOT NULL,
  signer_name          text NOT NULL,
  signer_title         text NOT NULL,
  signer_email         text NOT NULL,
  countersigner_name   text NOT NULL,
  countersigner_title  text NOT NULL,
  countersigner_email  text NOT NULL,
  status               text NOT NULL DEFAULT 'sending'
    CHECK (status IN ('sending', 'sent', 'viewed', 'customer_signed', 'completed', 'declined', 'expired', 'canceled', 'error')),
  error                text,
  requested_by_email   text NOT NULL,
  sent_at              timestamptz,
  viewed_at            timestamptz,
  customer_signed_at   timestamptz,
  completed_at         timestamptz,
  declined_at          timestamptz,
  decline_reason       text,
  stalled_notified_at  timestamptz,
  signed_pdf_path      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreement_envelopes_group
  ON public.agreement_envelopes (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agreement_envelopes_open
  ON public.agreement_envelopes (status)
  WHERE status IN ('sent', 'viewed', 'customer_signed');

-- Service-role only: the portal reads status through the API.
ALTER TABLE public.agreement_envelopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agreement_envelopes FROM anon, authenticated;

COMMENT ON TABLE public.agreement_envelopes IS
  'Employer Platform Agreement e-signature requests (SignWell). Written only by gsi-website server code.';

-- How each archived acceptance was given.
ALTER TABLE public.agreement_acceptances
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'click'
    CHECK (method IN ('click', 'esign')),
  ADD COLUMN IF NOT EXISTS envelope_id uuid REFERENCES public.agreement_envelopes(id);

-- Signed PDFs (customer- and countersigned copies from SignWell). Private:
-- no policies, so only the service role reads or writes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('employer-agreements', 'employer-agreements', false)
ON CONFLICT (id) DO NOTHING;
