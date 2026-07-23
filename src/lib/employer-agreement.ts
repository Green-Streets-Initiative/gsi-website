// Employer Platform Agreement — canonical text.
//
// Single source of truth rendered by: the public page at
// /shift/employers/agreement, the portal's click-through acceptance gate,
// and the acceptance-confirmation email. Any wording change REQUIRES a new
// AGREEMENT_VERSION so past acceptances stay tied to the text they accepted.
//
// Adapted 2026-07 from the Shift Sponsorship Agreement. ATTORNEY REVIEW
// REQUIRED BEFORE FIRST USE — especially "Nature of payment" (the
// sponsorship agreement's qualified-sponsorship framing under IRC §513(i)
// does not apply to a services subscription).

export const AGREEMENT_VERSION = '2026-07-EMP-1'

export const AGREEMENT_TITLE = 'Shift Employer Platform Agreement'

export const AGREEMENT_PREAMBLE =
  'This Agreement is between Green Streets Initiative ("GSI"), a Massachusetts 501(c)(3) nonprofit (EIN 26-1484405), and the employer that accepts it ("Customer"). It sets the terms for Customer\'s subscription to the Shift Employer Platform.'

export const AGREEMENT_SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: 'The service',
    body: 'GSI provides the Shift Employer Platform: an employer portal with a commute dashboard and impact reporting for Customer\'s workplace group in the Shift app, employee joining via an invite code, commute challenges, a weekly email report, and the other features included in the subscription tier Customer selects. The tier, its features, and its annual fee are as presented at gogreenstreets.org/shift/employers or on GSI\'s invoice at the time of purchase (the "Order"). GSI may improve or modify platform features over time, provided the changes do not materially reduce the core service described in the Order during a paid term.',
  },
  {
    heading: 'Term and renewal',
    body: 'The subscription runs for twelve (12) months from the access start date in the Order and renews for successive twelve-month terms through GSI\'s billing provider unless either party cancels before the renewal date. Customer may cancel renewal at any time by written notice to info@gogreenstreets.org or through the portal\'s billing page; cancellation takes effect at the end of the then-current term.',
  },
  {
    heading: 'Fees and payment',
    body: 'Customer will pay the annual fee stated in the Order, by invoice with Net-30 terms or by card checkout. Fees are non-refundable except as expressly provided in this Agreement. If an invoice remains unpaid more than thirty (30) days after its due date, GSI may suspend portal access after seven (7) days\' written notice until payment is received. Optional add-on purchases (for example, gift-card prize funds where offered) are billed separately.',
  },
  {
    heading: 'Employee participation',
    body: 'Customer\'s employees join the Shift app individually and voluntarily. Each employee\'s use of the app is governed by GSI\'s own terms of service and privacy policy, and each employee\'s account relationship is with GSI, not Customer. Customer will not require participation as a condition of employment, use the platform to penalize non-participants, or represent to employees that Customer can access their individual commute data.',
  },
  {
    heading: 'Data and reporting',
    body: 'All reporting provided to Customer is limited to aggregate participation, trip, mileage, and impact metrics for Customer\'s workplace group. GSI will not provide Customer with individual users\' trip records, precise locations, individual shift rates, or other individual-level data beyond a member\'s display name, join date, and per-member aggregate activity shown in the portal. Customer may not attempt to identify commute patterns of, re-identify, track, or profile any individual based on platform reports, and may not combine platform data with other data for that purpose. Customer may use reports only for internal program evaluation and its own sustainability, wellness, or ESG reporting.',
  },
  {
    heading: 'Acceptable use',
    body: 'Customer will provide accurate information, invite only its own workforce (and contractors or affiliates working at its sites) to its group, keep portal access limited to authorized administrators and viewers, and comply with all laws applicable to its use of the platform. Customer will not attempt to access other organizations\' data, interfere with the platform\'s operation, or use platform communication features to harass employees.',
  },
  {
    heading: 'Use of marks',
    body: 'Each party grants the other a non-exclusive, non-transferable, royalty-free license to use its name and logo solely to identify the subscription relationship (for example, Customer\'s logo on its own group pages and GSI\'s customer listings). Each party\'s use must follow any brand guidelines the mark owner provides and must not imply endorsement or a broader relationship. GSI may retain archival and reporting references to Customer for up to twelve (12) months after the subscription ends. Either party may request correction or removal of a non-compliant use, and the other party will address the request promptly.',
  },
  {
    heading: "GSI's independence",
    body: 'GSI retains full editorial, operational, technical, and administrative control over the Shift app, the participant experience, winner-selection processes, data practices, and its mission-related activities. Customer\'s configuration choices are limited to the controls provided in the employer portal.',
  },
  {
    heading: 'Nature of payment',
    body: 'The subscription fee is payment for the platform services described in this Agreement. It is not a charitable contribution, and GSI will not issue a charitable donation receipt for it. Any tax or accounting treatment of the fee is solely for Customer and its advisors to determine; GSI provides no tax advice.',
  },
  {
    heading: 'No guarantee of outcomes',
    body: 'GSI makes no representations or warranties regarding employee sign-up rates, participation, engagement, commute behavior change, emissions reductions, or other outcomes. The platform is provided "as is" to the fullest extent permitted by law. GSI is not responsible for delays or non-performance caused by events beyond its reasonable control, including platform or vendor outages, app-store actions, public-health events, governmental action, or other force majeure events.',
  },
  {
    heading: 'Termination',
    body: 'Either party may terminate this Agreement immediately on written notice if the other party materially breaches it and fails to cure within ten (10) days of written notice, or engages in conduct that reasonably creates legal, reputational, safety, privacy, or mission-integrity concerns. If GSI discontinues the Employer Platform during a paid term, GSI will refund the pro-rated unused portion of the fee. Upon termination, Customer\'s portal access ends; employees\' individual app accounts are unaffected. Sections concerning fees, data, marks, nature of payment, indemnification, limitation of liability, governing law, and general terms survive termination.',
  },
  {
    heading: 'Indemnification',
    body: 'Customer will defend, indemnify, and hold harmless GSI and its officers, directors, employees, volunteers, and agents from third-party claims arising out of: (a) Customer\'s breach of this Agreement; (b) Customer-provided materials, including claims that they infringe or violate any rights; (c) Customer\'s employment practices or internal use of platform reports; or (d) Customer\'s violation of law. GSI will defend, indemnify, and hold harmless Customer and its officers, directors, employees, and agents from third-party claims arising out of: (a) GSI\'s breach of this Agreement; (b) GSI\'s unauthorized use of Customer\'s marks; or (c) GSI\'s violation of law. The indemnified party must promptly notify the indemnifying party, cooperate reasonably, and allow it to control the defense, provided no settlement imposes non-monetary obligations on the indemnified party without its consent.',
  },
  {
    heading: 'Limitation of liability',
    body: 'To the fullest extent permitted by law, neither party is liable to the other for indirect, incidental, consequential, special, exemplary, or punitive damages, including lost profits or business interruption, under any legal theory, even if advised of the possibility. Except for payment obligations, indemnification obligations, misuse of the other party\'s intellectual property, fraud, willful misconduct, or violations of law, each party\'s total liability under this Agreement will not exceed the fees paid or payable by Customer in the twelve (12) months preceding the event giving rise to the claim.',
  },
  {
    heading: 'Notices and governing law',
    body: 'Legal notices must be sent by email to info@gogreenstreets.org and keith@gogreenstreets.org (for GSI) and to Customer\'s accepting administrator\'s email (for Customer), with a copy by nationally recognized courier or certified mail on request. This Agreement is governed by the laws of the Commonwealth of Massachusetts, and the parties consent to the state and federal courts located in Massachusetts.',
  },
  {
    heading: 'General',
    body: 'This Agreement, together with the Order, is the entire agreement between the parties regarding the Employer Platform and supersedes prior discussions on that subject. It may be amended only in writing signed or accepted by both parties, except that GSI may update these terms for a renewal term by notice at least thirty (30) days before renewal. Neither party may assign this Agreement without the other\'s consent, except GSI may assign it in connection with a reorganization or transfer of the program. The parties are independent contractors. If any provision is unenforceable, the rest remains in effect.',
  },
  {
    heading: 'Electronic acceptance',
    body: 'This Agreement is accepted electronically in the Shift employer portal by a Customer representative who confirms they are authorized to bind Customer. The recorded name, title, email, agreement version, and timestamp of acceptance constitute Customer\'s signature, and the parties agree such acceptance satisfies any signature requirement under applicable law, including the federal E-SIGN Act and the Massachusetts Uniform Electronic Transactions Act.',
  },
]
