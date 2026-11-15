// What the town email's top card says to do. Run with:
//   node --test src/lib/towns/digest-actions.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dayInUrl, eventNoun, featuredPlan, linkKind, recordProblem, timeRange, usableLink } from './digest-actions.ts'

const base = {
  id: 'a', title: '', description: null, hearing_date: null, hearing_time: null, hearing_end_time: null,
  hearing_type: 'in_person', hearing_location_name: null, virtual_link: null, source_url: null,
  comment_deadline: null, comment_email: null, action_label: null, municipality: 'Somerville',
  affected_towns: ['Somerville'], access_notes: null, digest_headline: null, community_name: null,
  whats_deciding: null, community_links: null, lat: null, lng: null,
}
const flags = { todayIso: '2026-11-15', townNames: ['Somerville'], volunteer: false, recruit: false, petition: false }
const text = (p: ReturnType<typeof featuredPlan>) =>
  p.lines.map((l) => `${l.before ?? ''}${l.link?.text ?? ''}${l.after ?? ''}`)

// The record Somerville's 2026-11-15 email led with, as it was stored.
const popUp = {
  ...base,
  id: 'popup',
  title: 'Broadway Magoun Reconstruction Project (Winchester St to Central St): Street Outreach Pop-Up at Broadway & Medford Street (outside CVS) (Somerville)',
  description: 'Stop by this informal pop-up near Magoun Square to ask questions and share your input on the Broadway reconstruction design.',
  hearing_date: '2026-11-18', hearing_time: '16:30:00',
  hearing_location_name: 'Intersection of Broadway and Medford Street (outside CVS)',
  virtual_link: 'https://voice.somervillema.gov/broadway-magoun-reconstruction/news_feed/attend-the-broadway-magoun-updated-design-open-house-november-4',
  source_url: 'https://voice.somervillema.gov/broadway-magoun-reconstruction',
  action_label: 'Attend the pop-up event',
}
const survey = {
  ...base,
  id: 'survey',
  title: 'Online Survey - Broadway Magoun Updated Design Feedback (Somerville)',
  hearing_type: 'virtual',
  virtual_link: 'https://voice.somervillema.gov/broadway-magoun-reconstruction/surveys/broadway-magoun-updated-design-feedback-survey',
  source_url: 'https://voice.somervillema.gov/broadway-magoun-reconstruction',
  comment_deadline: '2026-12-04', action_label: 'Submit a comment by December 4',
  digest_headline: 'Broadway and Magoun streets design feedback survey',
}

describe('the Somerville pop-up of 2026-11-15', () => {
  const plan = featuredPlan({ item: popUp, related: [popUp, survey], ...flags })
  it('is called a pop-up', () => assert.equal(plan.noun, 'pop-up'))
  it('says nothing about joining online or registering', () => {
    assert.ok(!text(plan).some((l) => /join|regist/i.test(l)), text(plan).join(' | '))
  })
  it('leaves out the link about Nov 4', () => {
    assert.ok(!plan.lines.some((l) => l.link?.href.includes('november-4')))
    assert.equal(plan.notes.length, 1)
    assert.ok(plan.notes[0].includes('another day'))
  })
  it('has no button', () => assert.equal(plan.button, null))
  it('says where and when, and offers the survey', () => {
    assert.deepEqual(text(plan), [
      'In person: Intersection of Broadway and Medford Street (outside CVS), Wednesday at 4:30 PM. Just show up.',
      'Can’t make it? Take the online survey, open through Fri, Dec 4',
      'Read the full notice on voice.somervillema.gov',
    ])
    assert.equal(plan.alsoOnline?.id, 'survey')
  })
})

describe('other kinds of item', () => {
  it('a Zoom registration keeps its line and its button', () => {
    const p = featuredPlan({ item: { ...base, title: 'Virtual Office Hour - Broadway Magoun', hearing_date: '2026-11-13', hearing_time: '12:30:00', hearing_type: 'virtual', virtual_link: 'https://us02web.zoom.us/webinar/register/WN_x' }, ...flags })
    assert.deepEqual(text(p), ['Join the virtual office hour online — registration takes a minute'])
    assert.equal(p.button?.label, 'Register for the office hour')
  })
  it('an online meeting whose link is a schedule PDF does not promise registration', () => {
    const p = featuredPlan({ item: { ...base, title: 'Monthly PTAC Public Meeting', hearing_date: '2026-11-19', hearing_time: '18:30:00', hearing_type: 'virtual', virtual_link: 'https://s3.amazonaws.com/x/PTAC-schedule-2026_0.pdf', action_label: 'Attend the meeting' }, ...flags })
    assert.deepEqual(text(p), ['Find the link to join online'])
    assert.equal(p.button?.label, 'See how to join')
  })
  it('a survey is a survey, with one line', () => {
    const p = featuredPlan({ item: survey, ...flags })
    assert.deepEqual(text(p), ['Take the online survey, open through Fri, Dec 4', 'Read the full notice on voice.somervillema.gov'])
    assert.equal(p.button?.label, 'Submit a comment by December 4')
  })
  it('a hybrid hearing lists both ways', () => {
    const p = featuredPlan({ item: { ...base, title: 'Design Public Hearing: Main St', hearing_date: '2026-11-20', hearing_time: '18:00:00', hearing_end_time: '19:30:00', hearing_type: 'hybrid', hearing_location_name: 'City Hall', virtual_link: 'https://zoom.us/j/123' }, ...flags })
    assert.deepEqual(text(p), ['Join the public hearing online', 'In person: City Hall, Friday, 6:00–7:30 PM.'])
    assert.equal(p.button?.label, 'Join the public hearing')
  })
  it('an open house in person with only a project page gets no button', () => {
    const p = featuredPlan({ item: { ...base, title: 'Broadway/Magoun Open House', hearing_date: '2026-11-20', hearing_time: '18:30:00', hearing_location_name: 'Healey School', virtual_link: 'https://somervillema.gov/broadwaymagoun', action_label: 'Attend the open house' }, ...flags })
    assert.equal(p.button, null)
    assert.equal(text(p)[0], 'In person: Healey School, Friday at 6:30 PM. Just show up.')
  })
})

describe('meetings with no link of their own', () => {
  it('an online hearing points to its notice for the link', () => {
    const p = featuredPlan({ item: { ...base, title: 'Braintree - Bridge replacement', description: 'A virtual public hearing.', hearing_date: '2026-11-17', hearing_time: '18:00:00', hearing_type: 'virtual', source_url: 'https://www.mass.gov/event/x', comment_deadline: '2026-12-01', action_label: 'Attend the virtual hearing' }, ...flags })
    assert.deepEqual(text(p), ['Find the link to join online on mass.gov', 'Written comments are accepted through Tue, Dec 1'])
    assert.equal(p.button?.label, 'See how to join')
  })
  it('an in-person meeting that asks for sign-up keeps its button', () => {
    const p = featuredPlan({ item: { ...base, title: 'Allston Task Force meeting', hearing_date: '2026-11-19', hearing_time: '18:00:00', hearing_location_name: 'MassDOT Board Room', source_url: 'https://www.mass.gov/event/y', action_label: 'Register to attend the meeting' }, ...flags })
    assert.equal(p.button?.label, 'Register to attend the meeting')
    assert.equal(text(p)[0], 'In person: MassDOT Board Room, Thursday at 6:00 PM.')
  })
})

describe('pieces', () => {
  it('names the event from its title before its summary', () => {
    assert.equal(eventNoun({ title: 'Street Outreach Pop-Up', description: 'After the open house, a public hearing follows.' }), 'pop-up')
    assert.equal(eventNoun({ title: 'Main St redesign', description: 'A public hearing on the plan.' }), 'public hearing')
    assert.equal(eventNoun({ title: 'Main St redesign', description: null }), 'public meeting')
  })
  it('reads the day a link names', () => {
    assert.equal(dayInUrl('https://x.gov/news/open-house-november-4'), '11-04')
    assert.equal(dayInUrl('https://x.gov/events/2026/11/04/open-house'), '11-04')
    assert.equal(dayInUrl('https://x.gov/may-2026-newsletter'), null)
    assert.equal(dayInUrl('https://x.gov/project/broadway'), null)
    assert.equal(dayInUrl('https://x.gov/decision-12-points'), null)
  })
  it('keeps a link that names the meeting\'s own day', () => {
    assert.ok(usableLink({ virtual_link: 'https://x.gov/events/2026/11/18/pop-up', hearing_date: '2026-11-18' }))
    assert.equal(usableLink({ virtual_link: 'https://x.gov/events/2026/11/04/open-house', hearing_date: '2026-11-18' }), null)
  })
  it('sorts links', () => {
    assert.equal(linkKind('https://us02web.zoom.us/webinar/register/WN_x'), 'join')
    assert.equal(linkKind('https://voice.somervillema.gov/p/surveys/x'), 'form')
    assert.equal(linkKind('https://x.gov/a.pdf'), 'file')
    assert.equal(linkKind('https://voice.somervillema.gov/broadway-magoun-reconstruction'), 'page')
  })
  it('writes time ranges', () => {
    assert.equal(timeRange('16:30:00', null), '4:30 PM')
    assert.equal(timeRange('16:30:00', '18:00:00'), '4:30–6:00 PM')
    assert.equal(timeRange('11:00', '13:00'), '11:00 AM–1:00 PM')
  })
  it('holds an online meeting nobody can join', () => {
    assert.ok(recordProblem({ ...base, hearing_date: '2026-11-20', hearing_type: 'virtual' }))
    assert.equal(recordProblem(popUp), null)
  })
})
