// "How the setup assistant handles your data" (Keith 2026-10-22, Loomis
// readiness): the page a customer's security review reads, linked from
// Settings. Public at /shift/employers/assistant-data. Keep it in step with
// the code: the model (route.ts MODEL), what the tools read (tools.ts), the
// retention purge (Shift 01301) and the admin switch (Shift 01372).
// Anthropic's terms checked 2026-10-22 on privacy.claude.com (articles
// 7996866 "How long do you store my organization's data", 7996868 "Is my
// data used for model training", 15425996 Covered Models).

export const DATA_NOTE_TITLE = 'The setup assistant and your data'
export const DATA_NOTE_UPDATED = 'October 22, 2026'

export const DATA_NOTE_SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'What it is',
    body: [
      "The setup assistant is an optional part of the Shift employer portal. A person on your portal team asks for something in their own words (set up a challenge, invite staff, explain results) and the assistant does the work with them.",
      "It acts with that person's own permissions: it can do only what they could do in the portal themselves. Every change your team or employees would see waits for that person to approve it on a card the portal writes, and a few changes (removing a teammate, adding an admin, cancelling a reward, deleting a survey) also need a name typed to confirm. The assistant never moves money: payments happen on Stripe's page, by your team.",
      'An admin on your team can turn the assistant off for your whole workplace in Settings, at any time. When it is off, nobody can use it in your workplace, Green Streets staff included.',
    ],
  },
  {
    heading: 'What it sees',
    body: [
      'The conversation itself, and the account information the portal already shows that person: your challenges, rewards and balance, your plan, your portal team, employee names with their trip totals, invitation addresses, commute survey totals, your offices and the commute benefits you list.',
      'Files someone attaches: a logo image, or a staff list (spreadsheet or text file). A staff list is read and stored by Green Streets; the AI model receives a summary of it (how many people, the email domains, entries that look wrong) and a few sample rows, never the whole list.',
      "It never sees an employee's individual trips or individual survey answers. The portal doesn't show those to anyone at your workplace either.",
    ],
  },
  {
    heading: 'Who processes it',
    body: [
      "The assistant runs on Anthropic's Claude models (Claude Opus 5.5 today; if it declines a request on safety grounds, Anthropic re-runs it on an earlier Claude model), through Anthropic's commercial API. Under Anthropic's commercial terms, your data is not used to train their models, and inputs and outputs are deleted from Anthropic's systems within 30 days, except where content is flagged by their safety systems (kept up to 2 years) or the law requires longer. None of these models are ones Anthropic subjects to separate retention rules.",
      'The service providers the rest of the portal already uses handle the assistant too: Supabase stores the conversations and attached lists (United States, Oregon); Vercel runs the website; Google Maps looks up an office address someone types in; Resend sends the invitation emails your team approves.',
      "Green Streets shares this information only with service providers bound to confidentiality, as the Employer Platform Agreement's Confidentiality section describes.",
    ],
  },
  {
    heading: 'What Green Streets keeps',
    body: [
      'Conversations are private to the person who had them: other people on your portal team cannot read them. Green Streets staff may review conversations to improve the assistant. Each person can delete their own conversations at any time (History in the assistant), and all conversations are deleted automatically after 12 months. An attached staff list is deleted with its conversation.',
      'The changes the assistant makes are listed for your whole portal team in Settings ("Changes made with the assistant"), with who approved each one and when.',
      'When someone asks for something Shift does not do yet, or shares feedback, the assistant passes a short note to Green Streets (what was asked, in a sentence, and their words). Green Streets keeps these notes to decide what to build next.',
    ],
  },
  {
    heading: 'Questions',
    body: ['Email info@gogreenstreets.org. We are glad to walk your security or IT team through any of this, or to fill in your vendor questionnaire.'],
  },
]
