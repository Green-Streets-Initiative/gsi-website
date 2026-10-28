// Employer Platform Agreement — canonical text.
//
// Single source of truth rendered by: the public page at
// /shift/employers/agreement, the portal's click-through acceptance gate,
// the acceptance-confirmation email, and the archived acceptance snapshot.
// Any wording change REQUIRES a new AGREEMENT_VERSION so past acceptances
// stay tied to the text they accepted.
//
// v2026-07-EMP-2 (2026-07-23): applied fixes from adversarial review —
// indemnities brought under the liability cap ("violations of law" carve-out
// removed), pro-rated refund on non-breach termination, Order anchored to
// the invoice, added confidentiality / security & breach notice / license &
// IP / taxes / metrics-estimates clauses, honest two-level data wording,
// maintained notice contact, publicity by prior approval.
//
// v2026-10-EMP-3 (2026-09-30): added "Rewards to employees" (rewards Customer
// funds and its employees receive are Customer's compensation for tax
// purposes; GSI does not withhold, report or advise; annual statement in the
// portal) and listed it among the surviving sections.
//
// v2026-11-EMP-4 (2026-10-28, Keith approved): added "The setup assistant"
// (optional, admin off switch, approval before actions, what it sees, service
// providers incl. Anthropic's commercial terms as checked 2026-10-22, owner-only
// conversations, 12-month deletion, answers can be wrong / no advice, warranty
// not on answer content) and "Employees and the Shift assistant" (employers
// never see employees' conversations or use; employer-entered benefits may be
// used to answer employees). Service list names the setup assistant;
// Employee participation adds conversations. Keep in step with
// lib/employer-assistant/data-note.ts.
//
// ATTORNEY REVIEW STILL PENDING — planned as fixed-fee review before
// customer #2-3; "Nature of payment" UBIT question flagged for counsel.

export const AGREEMENT_VERSION = '2026-11-EMP-4'

export const AGREEMENT_TITLE = 'Shift Employer Platform Agreement'

export const AGREEMENT_PREAMBLE =
  'This Agreement is between Green Streets Initiative ("GSI"), a Massachusetts 501(c)(3) nonprofit (EIN 26-1484405), and the employer that accepts it ("Customer"). It sets the terms for Customer\'s subscription to the Shift Employer Platform.'

export const AGREEMENT_SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: 'The service and the Order',
    body: 'GSI provides the Shift Employer Platform: an employer portal with a commute dashboard and impact reporting for Customer\'s workplace group in the Shift app, employee joining via an invite code, commute challenges, a weekly email report, where GSI makes it available, the setup assistant, and the other features included in Customer\'s subscription tier. The subscription tier, annual fee, and access start date are as stated on GSI\'s invoice or checkout receipt for the subscription (the "Order"); if the Order is silent on the access start date, the term starts when Customer\'s portal access is activated. Each tier\'s features are as described at gogreenstreets.org/shift/employers at the time of the Order. GSI may improve or modify platform features over time, provided the changes do not materially reduce the core service described in this section during a paid term.',
  },
  {
    heading: 'License and intellectual property',
    body: 'GSI grants Customer a non-exclusive, non-transferable right, for the subscription term, for Customer\'s authorized administrators and viewers to access and use the employer portal, and for Customer\'s employees to join Customer\'s workplace group, in each case as contemplated by this Agreement. GSI and its licensors retain all right, title, and interest in the platform, the Shift app, and all related software, designs, and content. Customer retains all rights in materials it provides (such as its logo). Customer may provide feedback voluntarily, and GSI may use it without obligation.',
  },
  {
    heading: 'Term and renewal',
    body: 'The subscription runs for twelve (12) months from the access start date and renews for successive twelve-month terms unless either party declines renewal before the renewal date. GSI will send Customer a renewal reminder, including the renewal fee, at least thirty (30) days before each renewal date. For invoice-billed customers, each renewal term is contingent on payment of the renewal invoice. Customer may decline renewal at any time by written notice to info@gogreenstreets.org or through the portal\'s billing page; the subscription then ends at the end of the current term.',
  },
  {
    heading: 'Fees, payment, and taxes',
    body: 'Customer will pay the annual fee stated in the Order, by invoice with Net-30 terms or by card checkout. Fees are exclusive of taxes; Customer is responsible for any applicable sales, use, or similar taxes (other than taxes on GSI\'s income). If an invoice remains unpaid more than thirty (30) days after its due date, GSI may suspend portal access after seven (7) days\' written notice until payment is received. Optional add-on purchases (for example, gift-card prize funds where offered) are billed separately; any unspent prize-fund balance is refunded to Customer if the subscription ends. Except as expressly provided in this Agreement, fees are non-refundable.',
  },
  {
    heading: 'Employee participation',
    body: 'Customer\'s employees join the Shift app individually and voluntarily. Each employee\'s use of the app is governed by GSI\'s own terms of service and privacy policy, and each employee\'s account relationship is with GSI, not Customer. Customer will not require participation as a condition of employment, use the platform to penalize non-participants, or represent to employees that Customer can access their individual commute records or their conversations with the Shift assistant.',
  },
  {
    heading: 'Data and reporting',
    body: 'Reporting provided to Customer consists of (a) aggregate participation, trip, mileage, and impact metrics for Customer\'s workplace group, and (b) limited per-member activity shown in the portal: a member\'s display name, join date, and summary activity totals. GSI will not provide Customer with individual trip records, routes, locations, or timestamps. Customer may not attempt to infer, re-identify, track, or profile any individual\'s commute patterns from platform reports, and may not combine platform data with other data for that purpose. Customer may use reports only for internal program evaluation and its own sustainability, wellness, or ESG reporting. Platform metrics, including mileage and emissions figures, are good-faith estimates derived from self-reported and automatically detected activity; they are not audited or independently verified, and Customer is solely responsible for its own public and regulatory disclosures.',
  },
  {
    heading: 'The setup assistant',
    body: "The platform may include an optional setup assistant: an AI tool in the employer portal that helps Customer's portal team set up and run the program by conversation. It is available only where GSI has turned it on. Any Customer administrator may turn it off for Customer's workplace at any time in the portal's Settings; while it is off, no one can use it for Customer's workplace, including GSI staff. The assistant acts with the permissions of the person using it and can do only what that person could do in the portal. Before it sends invitations, changes settings, publishes anything employees will see, or sets aside Customer funds, the person must approve the action in the portal. It never takes payments. The portal lists every approved action, with who approved it and when. Customer is responsible for actions its portal team approves. To answer, the assistant processes the conversation, the information the portal already shows that person (such as challenges, rewards and balance, plan, portal team, employee names with their trip totals, invitation addresses, commute survey totals, offices and listed commute benefits), and files the person attaches. When someone attaches a staff list, GSI stores it and the AI model receives only a summary and a few sample rows. The assistant does not receive any employee's individual trip records or individual survey answers. GSI uses these service providers for the assistant: Anthropic, which provides the AI models through its commercial service; Supabase, which stores conversations and attached files in the United States; Vercel, which runs the website; Google Maps, which looks up office addresses; and Resend, which sends emails that follow an approved action. Under Anthropic's commercial terms as of October 22, 2026, Anthropic does not use this data to train its models and deletes it within 30 days, except content its safety systems flag (kept up to 2 years) or as the law requires. GSI keeps a current description at gogreenstreets.org/shift/employers/assistant-data and will update it before adding or replacing a provider. Each provider is a service provider under the Confidentiality section. Each conversation is visible only to the person who had it and to GSI staff, who may review it for support and to improve the assistant. Each person may delete their own conversations at any time. GSI deletes conversations automatically 12 months after their last message, together with any attached staff list. Notes the assistant passes to GSI about requests and feedback are kept separately, to answer them and plan the product. The assistant's answers are written by an AI model and may be incomplete, out of date, or wrong. Customer should check drafts, figures, and recommendations before relying on or sharing them. The assistant does not give legal, tax, accounting, employment, or benefits advice, including on the tax treatment of rewards. The warranty in the Warranty and disclaimer section covers the assistant's availability as part of the platform, not the content of its answers.",
  },
  {
    heading: 'Employees and the Shift assistant',
    body: "The Shift app includes an optional assistant for each employee. An employee's conversations with it are between that employee and GSI, under GSI's terms of service and privacy policy. Customer cannot see those conversations, the questions asked, or whether an employee uses the assistant; Customer's reporting stays as described in the Data and reporting section. If Customer lists commute benefits or offices in the portal, the employee assistant may use them to answer Customer's employees. Customer is responsible for keeping that information accurate.",
  },
  {
    heading: 'Confidentiality',
    body: 'Each party will use the other\'s non-public business information received under this Agreement (including Customer\'s group reports and the commercial terms of the Order) only to perform under this Agreement, will protect it with reasonable care, and will not disclose it to third parties except to employees, advisors, and service providers who need it and are bound to confidentiality, or as required by law. This obligation does not apply to information that is public, independently developed, or rightfully received from another source, and survives for three (3) years after the subscription ends.',
  },
  {
    heading: 'Security and incident notice',
    body: 'GSI will maintain commercially reasonable administrative, technical, and physical safeguards designed to protect platform data. If GSI confirms a security breach that affects Customer\'s group data, GSI will notify Customer\'s notice contact without undue delay and share information reasonably needed for Customer\'s own assessment, in addition to any notices required by law.',
  },
  {
    heading: 'Acceptable use',
    body: 'Customer will provide accurate information, invite only its own workforce (and contractors or affiliates working at its sites) to its group, keep portal access limited to authorized administrators and viewers, and comply with all laws applicable to its use of the platform. Customer will not attempt to access other organizations\' data, interfere with the platform\'s operation, or use platform communication features to harass employees.',
  },
  {
    heading: 'Use of marks and publicity',
    body: 'Each party grants the other a non-exclusive, non-transferable, royalty-free license to use its name and logo solely to identify the subscription relationship (for example, Customer\'s logo on its own group pages). GSI may identify Customer publicly as a customer only with Customer\'s prior written approval. Each party\'s use must follow any brand guidelines the mark owner provides and must not imply endorsement or a broader relationship. GSI may retain archival and reporting references to Customer for up to twelve (12) months after the subscription ends. Either party may request correction or removal of a non-compliant use, and the other party will address the request promptly.',
  },
  {
    heading: "GSI's independence",
    body: 'GSI retains full editorial, operational, technical, and administrative control over the Shift app, the participant experience, winner-selection processes, data practices, and its mission-related activities. Customer\'s configuration choices are limited to the controls provided in the employer portal. GSI administers any prize drawings offered through the platform and is responsible for their lawful operation.',
  },
  {
    heading: 'Nature of payment',
    body: 'The subscription fee is payment for the platform services described in this Agreement. It is not a charitable contribution, and GSI will not issue a charitable donation receipt for it. Any tax or accounting treatment of the fee is solely for Customer and its advisors to determine; GSI provides no tax advice.',
  },
  {
    heading: 'Rewards to employees',
    body: 'Rewards funded by Customer and delivered to its employees through the platform, including gift cards paid from a prize fund Customer tops up and any prize Customer hands out itself, are Customer\'s compensation to its employees for tax purposes. GSI does not withhold, report, or advise on the tax treatment of rewards; it provides Customer an annual statement in the portal listing who received what, and Customer is responsible for any reporting and withholding.',
  },
  {
    heading: 'Warranty and disclaimer',
    body: 'GSI warrants that the platform will materially conform to the service description in this Agreement during a paid term; Customer\'s exclusive remedy for breach of this warranty is GSI\'s re-performance or, if GSI cannot re-perform within a reasonable time, a pro-rated refund of the unused portion of the fee. EXCEPT AS STATED IN THIS SECTION, THE PLATFORM IS PROVIDED "AS IS" TO THE FULLEST EXTENT PERMITTED BY LAW, AND GSI MAKES NO OTHER WARRANTIES, EXPRESS OR IMPLIED. GSI makes no representations regarding employee sign-up rates, participation, engagement, commute behavior change, or emissions outcomes. GSI is not responsible for delays or non-performance caused by events beyond its reasonable control, including outages of third-party vendors or infrastructure, app-store actions, public-health events, or governmental action.',
  },
  {
    heading: 'Termination',
    body: 'Either party may terminate this Agreement immediately on written notice if the other party materially breaches it and fails to cure within ten (10) days of written notice, or engages in unlawful conduct or conduct that causes material harm to the other party, its reputation, or program participants. If this Agreement is terminated for any reason other than Customer\'s uncured breach — including termination by GSI under this section or discontinuation of the Employer Platform — GSI will refund the pro-rated unused portion of the fee for the current term. Upon termination, Customer\'s portal access ends; employees\' individual app accounts are unaffected. Sections concerning fees, data, confidentiality, marks, nature of payment, rewards to employees, indemnification, limitation of liability, governing law, and general terms survive termination.',
  },
  {
    heading: 'Indemnification',
    body: 'Customer will defend, indemnify, and hold harmless GSI and its officers, directors, employees, volunteers, and agents from third-party claims arising out of: (a) Customer-provided materials, including claims that they infringe or violate any rights; (b) Customer\'s use of platform reports in violation of the Data and reporting section; or (c) Customer\'s violation of law in its use of the platform. GSI will defend, indemnify, and hold harmless Customer and its officers, directors, employees, and agents from third-party claims arising out of: (a) GSI\'s unauthorized use of Customer\'s marks; or (b) a claim that the platform, as provided by GSI, infringes a third party\'s intellectual property rights. The indemnified party must promptly notify the indemnifying party, cooperate reasonably, and allow it to control the defense, provided no settlement imposes non-monetary obligations on the indemnified party without its consent.',
  },
  {
    heading: 'Limitation of liability',
    body: 'To the fullest extent permitted by law, neither party is liable to the other for indirect, incidental, consequential, special, exemplary, or punitive damages, including lost profits or business interruption, under any legal theory, even if advised of the possibility. EXCEPT FOR CUSTOMER\'S PAYMENT OBLIGATIONS, A PARTY\'S FRAUD OR WILLFUL MISCONDUCT, OR A PARTY\'S INFRINGEMENT OR MISAPPROPRIATION OF THE OTHER PARTY\'S INTELLECTUAL PROPERTY, EACH PARTY\'S TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT — INCLUDING INDEMNIFICATION OBLIGATIONS — WILL NOT EXCEED TWO TIMES (2X) THE FEES PAID OR PAYABLE BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.',
  },
  {
    heading: 'Notices and governing law',
    body: 'Legal notices must be sent by email: to GSI at info@gogreenstreets.org and keith@gogreenstreets.org; to Customer at the notice contact designated in the portal (or, if none is designated, the administrator who accepted this Agreement). Each party will keep its notice contact current. This Agreement is governed by the laws of the Commonwealth of Massachusetts, and the parties consent to the state and federal courts located in Massachusetts. Before filing suit, the parties will attempt in good faith to resolve any dispute through discussion between their designated representatives.',
  },
  {
    heading: 'General',
    body: 'This Agreement, together with the Order, is the entire agreement between the parties regarding the Employer Platform and supersedes prior discussions on that subject; if the Order and this Agreement conflict, the Order controls. It may be amended only in writing signed or accepted by both parties, except that GSI may update these terms effective at a renewal term by notice at least thirty (30) days before renewal. Neither party may assign this Agreement without the other\'s consent, except GSI may assign it, with notice to Customer, in connection with a reorganization or transfer of the program. The parties are independent contractors. If any provision is unenforceable, the rest remains in effect.',
  },
  {
    heading: 'Electronic acceptance',
    body: 'This Agreement is accepted electronically in the Shift employer portal by a Customer representative who confirms they are authorized to bind Customer. The recorded name, title, email, agreement version, and timestamp of acceptance constitute Customer\'s signature, and the parties agree such acceptance satisfies any signature requirement under applicable law, including the federal E-SIGN Act and the Massachusetts Uniform Electronic Transactions Act.',
  },
]

// Plain-text rendering used for the archived acceptance snapshot — the
// provable record of exactly what was accepted, independent of email
// delivery or later code changes.
export function agreementPlainText(): string {
  return [
    `${AGREEMENT_TITLE} — Version ${AGREEMENT_VERSION}`,
    '',
    AGREEMENT_PREAMBLE,
    '',
    ...AGREEMENT_SECTIONS.flatMap((s) => [s.heading.toUpperCase(), s.body, '']),
  ].join('\n')
}
