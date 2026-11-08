# Spanish and Portuguese drafts: what the reviewers read

Keith, 2026-11-07: "Translate the entry pages into Spanish and Portuguese:
Walk/Ride Day and its rules, privacy, and town pages for Chelsea, Lawrence,
Lynn, Revere and Everett. Claude drafts; a native-speaker reviewer reads
before publishing."

Claude wrote these drafts. Nobody who speaks the language has read them yet.
They live at preview addresses, which search engines don't index, the sitemap
doesn't list and no page links to. Nothing is public until a reviewer signs
off and the go-live steps below are done.

## What each reviewer reads

Two reviewers: one native Spanish speaker, one native Brazilian Portuguese
speaker. Each one reads three drafts and the town pages. The town pages share
every fixed sentence, so the first town is the long read. After that, only the
names and numbers change.

| Page | Spanish | Portuguese | Read time |
|---|---|---|---|
| Walk/Ride Day | /preview/es/walk-ride-day | /preview/pt-BR/walk-ride-day | 5 min |
| Official rules (legal) | /preview/es/walk-ride-day/rules | /preview/pt-BR/walk-ride-day/rules | 25 min |
| Privacy policy (legal) | /preview/es/privacy | /preview/pt-BR/privacy | 40 min |
| Chelsea town page | /shift/towns/chelsea-ma?lang=es | /shift/towns/chelsea-ma?lang=pt-BR | 10 min |
| Lynn, Revere, Everett | /shift/towns/lynn-ma?lang=es (and revere-ma, everett-ma) | same with ?lang=pt-BR | 5 min |

Put https://www.gogreenstreets.org in front of each address.

**The town pages are not drafts.** Site languages, part 3 (gsi-website
dacebb82, the same evening) translated every town page in place: Spanish,
Portuguese and Chinese, at the town's own address. A visitor sees them when
the app sends `?lang=` or their browser asks for Spanish or Portuguese. They
are public now, with no "pending review" note. The reviewer reads them the
same way as the drafts. Corrections go in `src/lib/site-strings/towns.ts`
(plus `new-infra.ts` and `roam-card.ts` for the new-lane rows and roam cards).
Claude's own draft of the five town pages was withdrawn, so the site keeps one
translation per page.

**Lawrence** has no town page yet, in English either. A town gets a page once
enough people there have joined Shift. When it does, it opens in all three
languages, using the same sentences as the other towns.

**The two legal pages** (rules and privacy) need a careful, word-for-word
reading against the English. The reviewer checks that every obligation,
right, date, limit and exception means exactly what the English says. Each
legal page carries a gold box at the top saying it's an AI translation
awaiting review, and that the English version is official and wins if the two
differ.

**The program and town pages** need a reading for tone: plain, warm and
natural, the way a neighbor would say it, not word for word.

### What stays in English on purpose

- **Names from the database:** meeting and group names, event titles, trail
  and roam names, partner offers, new bike lane descriptions. They arrive in
  English from the organizations that publish them. The page says so once and
  marks them `lang="en"`.
- **The town digest emails and the newsletter:** these go out in English, and
  the sign-up line says so ("por ahora en inglés" / "por enquanto em inglês").
- **The site footer:** it stays English on the preview drafts (see go-live).
  The top menu is translated, from the shared site dictionary
  (`src/lib/site-strings/chrome.ts`).
- **The name "Walk/Ride Day":** it stays in English, used with an article
  (el Walk/Ride Day / o Walk/Ride Day).
- **Links to pages that are English only:** these are marked "(en inglés)" or
  "(em inglês)".

### Choices for the reviewers to check

1. **Formal or informal "you".** The Spanish legal pages use *usted*; the
   Spanish program and town pages use *tú*. Portuguese uses *você*
   throughout. Is that right for Chelsea, Lawrence and Lynn readers?
2. **Shift Rate.** It's "Shift Rate" in Spanish and "Taxa Shift" in
   Portuguese, matching most of the app. The app also uses "Índice Shift" and
   "Tasa de cambio" in places. Pick one per language and the app should
   follow.
3. **Gift card.** We use "tarjeta de regalo" and "cartão-presente". Check
   that "cartão-presente" reads better to Brazilian readers than
   "vale-presente".
4. **Prizes are won by chance, never earned.** The rules must never sound
   like trips earn a prize. Flag any verb that does.
5. **The app's names for its features and modes** are quoted as the app shows them. Spanish:
   Cerca de ti, Avísame, Lo que recuerdo, Voy, Auto compartido. Portuguese:
   Perto de você, Avise-me, O que eu lembro, Vou, Carona. If the app's wording
   changes, change these too.
6. **Distances and weights** keep miles and pounds first, with km and kg in
   parentheses.
7. **Massachusetts only.** Eligibility for the drawing is Massachusetts
   residents only, same as the English.

### For Keith, not the reviewers

- The legal banner says the English version is official and wins if the two
  differ. That's a legal choice. Keep it, or let the reviewed translation
  stand on its own?
- The town pages already show in Spanish and Portuguese to anyone whose
  browser asks for it, before a native speaker has read them. Keep them on,
  or hold them behind `?lang=` until the review is done?
- Reviewers: the Communities Lead keeps the bench of paid native-speaker
  reviewers (Shift `docs/programs/communities/state.json`).

## Where the words live

A reviewer's corrections go into these files, or Claude makes them from the
reviewer's notes.

- Walk/Ride Day page: `src/lib/walk-ride-day/i18n.ts`
- Rules: `src/components/translated/rules-es.tsx`, `rules-pt-BR.tsx`
- Privacy: `src/components/translated/privacy-es.tsx`, `privacy-pt-BR.tsx`
  (page title and date in `PrivacyPolicy.tsx`)
- Town pages: `src/lib/site-strings/towns.ts` (the site languages work, not
  these drafts)
- Shared banners and notes: `src/lib/translated-pages.ts` (`SHARED`)

Live numbers stay live: dates, prizes and the referral window come from
the same database queries as the English pages.

## Go-live, once a reviewer signs off

Part 1 of site languages (gsi-website c6dd2054) decided how translated pages
work: one address per page, with the language taken from `?lang=` (the app
sends it), then the browser's language, then English (`src/lib/site-i18n.ts`,
`siteLocale()`). Follow that rather than adding /es/ routes:

1. **Each English route renders the translation**, the way
   `/shift/towns/[slug]` already does. `/programs/walk-ride-days`,
   `/events/walk-ride-day/rules` and `/privacy` call
   `siteLocale(searchParams.lang)`. For `es` or `pt-BR` they return the
   translated component that the preview route uses today
   (`src/components/translated/*`).
2. **Switch the links in one place.** `translatedPath()` in
   `src/lib/translated-pages.ts` becomes `withLang(englishPath(page), locale)`.
   Every internal link on the drafts follows it.
3. **hreflang.** The English and translated versions list each other
   (`alternates.languages`: `es` → `?lang=es`, `pt-BR` → `?lang=pt-BR`,
   `x-default` → English). Translated pages drop `noindex`.
4. **Language switch.** Pass `locale` to `<Footer>` (its switch links to
   `?lang=`, which only works once step 1 is in). Add a one-line "En
   español · Em português" link near the top of each English page.
5. **Sitemap.** Add the `?lang=` alternates for these pages.
6. **Banners.** Drop the "AI translation" note and the legal gold box for the
   language a reviewer approved, or change them to "Translated by …,
   reviewed on <date>".
7. **Delete the preview routes** under `src/app/preview/{es,pt-BR}/` (not
   `/preview/es/guides`).
8. **Parity map.** Update Shift `docs/programs/product/parity.md` and
   `parity.json`, under **Languages**: Walk/Ride Day, its rules and privacy
   in es and pt-BR. This draft didn't touch the map, because other sessions
   had uncommitted edits in both files.

### Keeping the copies in step

The Walk/Ride Day page is a translated twin (`WalkRideDayPage.tsx`), not the
English page with a language prop, because the English page had another
session's uncommitted redesign in progress
(`src/app/programs/walk-ride-days/page.tsx`). Until the two are merged, a
change to the English Walk/Ride Day page, rules or privacy policy needs the
same change in the twin. At go-live, the simplest path for the Walk/Ride Day
page is to move its words into `src/lib/site-strings/` and give the English
page a `locale`, as the town pages did.

The privacy and rules translations follow the English as of 2026-11-07
(privacy "Last updated: November 2026"). If the English changes, the
translation is out of date until it's updated and reviewed again.
