'use client'

import { useState } from 'react'
import { FileSignature } from 'lucide-react'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { usePortal } from '../_lib/portal-context'
import { formatDateUTC } from '../_lib/portal-utils'
import { EsignForm, EsignSteps, downloadWordCopy, openSignedPdf, statusLine, useAgreementEsign } from '../_components/AgreementEsign'

// GSI staff only (Keith 2026-10-29): where the agreement stands for this
// workplace, and sending the order form for e-signature, with the fee,
// billing and start date set by hand for deals made outside Stripe. This
// is how a workplace with no agreement on file (Loomis) gets one, without
// locking its portal. Redlines: the agreement stays standard; what a
// customer negotiates goes in Special terms on its own order form, and the
// Word copy is what their lawyer marks up.
export default function AgreementCard() {
  const { group, sessionEmail } = usePortal()
  const { state, setState, error, reload } = useAgreementEsign(group?.id, true)
  const [composing, setComposing] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [wordBusy, setWordBusy] = useState(false)
  const [wordError, setWordError] = useState<string | null>(null)
  if (!group) return null
  const env = state?.envelope ?? null
  const open = env && ['sent', 'viewed', 'customer_signed'].includes(env.status)

  return (
    <Card id="agreement">
      <CardHead
        title="Agreement"
        sub="Green Streets staff only"
        action={
          !composing && env?.status !== 'customer_signed' ? (
            <Button variant="secondary" size="sm" icon={FileSignature} onClick={() => setComposing(true)}>
              {open ? 'Send again' : 'Send for signature'}
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-3">
            {state?.accepted ? (
              <>
                <Badge tone="success" dot>On file</Badge>
                <span className="text-[15px] text-ink">
                  Version {state.accepted.version} · {formatDateUTC(state.accepted.at)}
                  {state.accepted.name ? ` · ${state.accepted.name}` : ''}
                </span>
              </>
            ) : (
              <>
                <Badge tone="warn" dot>None on file</Badge>
                <span className="text-[15px] text-ink-muted">No version of the agreement has been signed or accepted.</span>
              </>
            )}
            {state?.test_mode && <Badge tone="info">Test mode</Badge>}
          </div>

          {!composing && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={wordBusy}
                onClick={async () => {
                  setWordBusy(true)
                  setWordError(await downloadWordCopy(group.id, group.name))
                  setWordBusy(false)
                }}
              >
                {wordBusy ? 'Preparing...' : 'Word copy for review'}
              </Button>
              <span className="text-[14px] text-ink-muted">For the customer&apos;s lawyer to mark up. Agreed changes go in Special terms.</span>
              {wordError && <span className="text-[14px] text-ep-danger">{wordError}</span>}
            </div>
          )}

          {env && !composing && (
            <div className="grid gap-3 rounded-[12px] border border-line p-4">
              <p className="text-[15px] font-semibold text-ink">
                {env.signer_name}, {env.signer_title} · {env.order_terms.plan} · ${env.order_terms.annualFee.toLocaleString('en-US')} a year
                {env.order_terms.specialTerms ? ' · Special terms' : ''}
              </p>
              <EsignSteps env={env} />
              <p className="text-[15px] text-ink-muted">{statusLine(env)}</p>
              {env.has_signed_pdf && (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => setPdfError(await openSignedPdf(group.id))}
                  >
                    Download signed PDF
                  </Button>
                  {pdfError && <span className="ml-3 text-[14px] text-ep-danger">{pdfError}</span>}
                </div>
              )}
            </div>
          )}

          {composing && (
            <EsignForm
              groupId={group.id}
              companyName={group.name}
              defaults={state?.defaults ?? null}
              sessionEmail={sessionEmail}
              staff
              onSent={(e) => {
                setState((s) => (s ? { ...s, envelope: e } : s))
                setComposing(false)
                reload()
              }}
              onCancel={() => setComposing(false)}
            />
          )}
          {error && <p className="text-[14px] text-ep-danger">{error}</p>}
        </div>
      </CardBody>
    </Card>
  )
}
