# seo/

The SEO/AEO agent's committed workspace. (`.claude/` is gitignored in this
repo, so the agent's brain lives here where it can be versioned.)

- **strategy.md** — audience thesis, messaging guardrails, what "winning" means.
  Read first, every run.
- **methodology.md** — the routine's full weekly + monthly procedure. The
  scheduled task (`~/.claude/scheduled-tasks/seo-aeo-review/`) points here.
- **keyword-portfolio.json** — clusters of high-intent queries by audience,
  with the regexes that bucket Search Console data. Source of truth.
- **experiments.md** — append-only ledger of what we tried and what it did.
- **gsc-config.json** — the Search Console property id.
- **reports/** — one `YYYY-MM-DD.md` per run.
- **data/gsc/** — committed Search Console aggregates; git history is the time
  series baselines are computed from.
- **drafts/guides/** — new micro-guide drafts awaiting approval.

Run state lives in `.seo-state.json` at the repo root. The GSC puller is
`scripts/seo/pull-gsc.mjs`.

**To ship or decline a proposal:** open Claude Code and say
"ship SEO item N" or "decline SEO item N" (see the Shipping section of
methodology.md).
