# Claude Code — Project Rules for gsi-website

## Text contrast on dark backgrounds (HARD RULE)

This has been a recurring complaint for years across both the website and the
Shift mobile app. Check it on every page you build or edit, before marking the
task done.

On any dark-navy background (`bg-[#191A2E]` and friends — most Shift-branded
pages: employer portal, rewards partner portal, marketing sections), text must
stay legible:

- **Body / informational text, form labels, captions, empty states, validation
  messages, timestamps:** minimum **`text-white/75`**.
- **Tertiary labels / table column headers:** minimum `text-white/70`.
- **Placeholders (inputs):** minimum `placeholder:text-white/60`. Dimmer than
  body is OK; lower is not.
- **Never use** `text-white/30`, `text-white/40`, `text-white/45`, or
  `text-white/50` on dark backgrounds. All of these read as dark-gray-on-navy
  and are illegible on typical laptop screens in typical ambient light.
- Avoid Tailwind gray scales (`text-gray-400`, `text-slate-500`, etc.) on dark
  navy. If you need muted secondary text, use `text-white/75` or `text-white/80`
  — do not drop into a gray palette.
- Borders/backgrounds at low opacity (`border-white/[0.12]`,
  `bg-white/[0.07]`) are fine — the rule is only for **text color**.

Before finishing any page touch, grep the diff for the suspicious patterns:

```
text-white/[1-5]\d
text-white/[1-5]0
text-gray-[3-6]00
text-slate-[3-6]00
text-neutral-[3-6]00
```

Every hit needs justification (a deliberately disabled control, watermark,
etc.) or it gets bumped.

### Intentional low-contrast cases

Rare: disabled controls, decorative watermarks, truly tertiary metadata in a
visually busy card. Floor at `text-white/60` even for those. Never go lower.

## Code style

- Next.js 15 App Router, TypeScript, Tailwind.
- Supabase client in `src/lib/supabase.ts`. Edge functions in
  `supabase/functions/`.
- Brand wordmarks (`shift-wordmark-white.png`, `gsi-wordmark.png`, etc.) live
  in the public `brand-assets` Supabase storage bucket — fetched at runtime for
  PDFs and similar. When replacing them in place, bump `BRAND_ASSETS_VERSION`
  in `src/app/shift/employers/portal/page.tsx` to bust CDN/browser cache.
- Employer platform functions are public (`--no-verify-jwt`) and authenticate
  via their own signatures/mechanisms; that setting lives in
  `supabase/config.toml`. Do not remove it.

## Before every push

1. **`git status -u`** in every touched repo (gsi-website and Shift often
   move in lockstep for employer platform work). Commit thematically, don't
   leave drift.
2. **Typecheck clean**: `npx tsc --noEmit`.
3. **Deploy flags** for edge functions: `--no-verify-jwt` is required for
   `employer-webhook`, `employer-checkout`, `employer-magic-link` (captured in
   `supabase/config.toml` but worth remembering when deploying manually).
