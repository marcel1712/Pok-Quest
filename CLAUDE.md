# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PokéQuest is a personal, single-user productivity web app (Portuguese UI/commits) gamified with a
Pokémon-inspired journey: tasks and focus sessions trigger battle "encounters" that award XP, level up
and evolve owned Pokémon. Full requirements, architecture and the phased backlog (task IDs `T-001`…`T-040+`)
live in `Plan.md` — read it before starting a new backlog task. Design decisions, trade-offs and security
findings are logged (dated, in Portuguese) in `docs/DECISIONS.md`; game-balance formulas and worked examples
are in `docs/GAME_RULES.md`; test conventions are in `docs/QA.md`; the security model and incident
procedures are in `docs/SECURITY.md`.

Stack: React 19 + Vite + TypeScript (strict), Tailwind CSS v4, React Router, TanStack Query, Zustand, Zod,
Supabase (Auth + PostgreSQL + RLS).

## Commands

```bash
npm run dev            # dev server
npm run build           # tsc -b + vite build (typecheck is part of build)
npm run lint             # ESLint
npm run typecheck        # tsc -b, no emit
npm run format            # Prettier (writes)
npm run format:check       # Prettier (check only)
npm run test             # Vitest, single run
npm run test:watch        # Vitest, watch mode
npm run test:coverage      # Vitest + enforced coverage of the pure rule modules (what CI runs)
npm run db:verify           # every supabase/verification script + TS/SQL rule parity, against the live project
npm run test:e2e           # Playwright (auto-starts dev server on :4173)
```

Run a single Vitest file/test: `npx vitest run path/to/file.test.ts` or `npx vitest run -t "test name"`.
Run a single Playwright spec: `npx playwright test tests/e2e/smoke.spec.ts`.

```bash
npx supabase migration new <name>              # new migration under supabase/migrations/
npm run db:push                                  # apply pending migrations to the linked remote project
npm run db:types                                  # regenerate src/shared/types/database.ts from remote schema
npm run catalog:import                             # fetch species from PokéAPI, prints SQL seed to review/paste into a migration
npm run perf:measure                               # after `npm run build`: requests/timings per route against a mocked API
npm run campaign:seed                              # validate src/features/journey/content/ and print its SQL seed for a new migration
npx supabase db query --linked -f <path>.sql         # run a one-off verification script (see below)
```

Before considering any task done, run lint + typecheck + test + build (and `test:e2e` when the change
touches a routed page or auth flow).

## Architecture

### Layering and dependency rule

```
src/
├── app/        # router, root layout, providers — top-level wiring only
├── pages/      # route-level composition; one file per router path, thin
├── features/   # domain modules: auth, tasks, focus, battles, pokemon, journey, rewards, settings
└── shared/     # ui, lib, hooks, types reusable across features
```

Dependency direction is strict: `pages → features → shared`. Features don't import from `pages`, and
`shared` never imports from `features` or `pages`. Within `src/features/<domain>/`, the convention is:

- `types.ts` — domain types
- `schemas.ts` — Zod schemas mirroring DB constraints (used for both form validation and parsing API responses)
- `domain.ts` — pure functions (state transitions, invariants), no I/O, exhaustively unit-tested
- `api/` — repository functions wrapping Supabase calls + TanStack Query hooks
- `hooks/` — React hooks built on the repository (queries/mutations)
- `components/` — feature UI

`src/features/battles/engine.ts` is the pure battle/reward engine (encounters, commitments, XP, team
multiplier, anti-fractionation) with no Supabase dependency — it's unit-tested standalone and then mirrored
in SQL (see below). `docs/GAME_RULES.md` documents every formula and must stay in sync with both.

### Styling

Design tokens live in `src/styles/index.css` (`@theme`): use the semantic utilities (`bg-surface`,
`text-ink-muted`, `border-line`, `bg-accent`, `text-danger`, `rounded-control`, `rounded-card`) and the
component classes defined there (`btn btn-primary|secondary|outline|ghost`, `btn-sm|lg`, `input`, `card`,
`link`, `page-title`) — never raw palette steps like `slate-800`. Focus rings and reduced motion are
handled globally in that file (the in-app preference is applied once, in `RootLayout`); don't add
per-component `focus-visible:ring-*`. Shared React primitives are in `src/shared/ui/`.

### Supabase: single environment, no local DB

There is exactly one Supabase project (dev = prod; this is a single-user app, documented trade-off — no
Docker/local Postgres). CLI is linked via `supabase link --project-ref <ref>`. This drives several
conventions:

- Game logic that must be tamper-proof is enforced in Postgres (`SECURITY DEFINER` functions, triggers,
  RLS, column-level `GRANT`s), not just in the TypeScript layer — a client can always bypass the UI and
  call Supabase directly. `resolve_pending_battle()` (triggered from `tasks`/`focus_sessions` changes) is
  the canonical example: it recomputes rewards server-side and swallows its own exceptions so a battle bug
  never blocks a task/session completion.
- Reward/XP mutations to `owned_pokemon` are restricted via **column-level** `GRANT UPDATE (...)`, not just
  row-level RLS — RLS alone only filters _rows_, not _columns_, so it does not stop a user from PATCHing
  their own row's `xp`/`level` directly.
- **Grants are deny-by-default.** The default privileges of schema `public` were changed (T-038): a table
  or function created by a new migration starts with NO access for `anon`/`authenticated`. Every migration
  must `grant` exactly what the client needs (usually `grant select ... to authenticated`, plus
  `insert`/`update` only for the user's own working data, and `grant execute` only on RPCs the app calls).
  `anon` gets nothing in `public`. RLS, table grants and column grants are three independent layers —
  see `docs/SECURITY.md`. After adding a table or function, review
  `npx supabase db query --linked -f supabase/audit/privileges.sql` and run `npm run db:verify`
  (`t038-security-audit.sql` walks the catalog, so new tables are checked automatically). Never grant
  `EXECUTE` to clients on a function that takes as an argument something the server must decide (owner,
  XP, species, level). Functions declared `returns trigger` can't be called via RPC at all.
- There is no isolated test database, so schema/security changes are verified against the live project by
  scripts under `supabase/verification/*.sql`, all run by `npm run db:verify`. Every script must do its work
  inside one subtransaction that is ALWAYS rolled back (end with `raise exception 'TXXX_ROLLBACK'`, caught by
  the enclosing block) and must first put the account in a known state inside that transaction — never
  "clean up at the end": forgotten cleanup has already polluted the user's real history once. To test
  role-dependent grants (not just `postgres`, which bypasses grants/RLS), use `set local role authenticated`
  with `request.jwt.claims` set, or `curl` against the REST API with the anon key.
- Reward formulas exist in both `engine.ts` and SQL. `tests/fixtures/rule-parity.json` pins their expected
  outputs: `rule-parity.test.ts` checks the TypeScript side, `db:verify` the database side. Change all three
  together.

### CI vs. local E2E

CI (`.github/workflows/ci.yml`) runs lint/typecheck/test/build plus an **unauthenticated** Playwright smoke
test (`tests/e2e/smoke.spec.ts`) against placeholder Supabase env vars — it only exercises the
redirect-to-`/login` and invalid-credential-error paths, never touching the real database. Authenticated
E2E flows run only locally, with the real `.env`, via `npm run test:e2e` — promoting that to CI would
require a separate staging Supabase project (not yet set up).

### Testing conventions (full detail in `docs/QA.md`)

- Vitest + React Testing Library, co-located as `*.test.ts(x)` next to the file under test.
- Playwright specs live in `tests/e2e/*.spec.ts`.
- Mock only external integrations (network, third-party SDKs). Never mock pure domain/RPG rules (battle
  engine, XP math, completion idempotency) — these must be tested with real inputs/outputs.
- Any RNG in encounters/captures must use deterministic seeds/fixtures in tests, never unseeded `Math.random()`.

### Game-balance invariants worth knowing before touching `battles/engine.ts` or its SQL mirror

- `REWARD_RULES_VERSION` in `engine.ts` is a human-readable marker only — it is **not** enforced in code.
  Past `reward_events.amount` rows are immutable regardless of later constant changes; don't assume
  changing a reward constant retroactively affects historical data.
- Anti-fractionation (diminishing returns after N full-value rewards/day) applies only to task-sourced XP,
  not focus-session XP — focus XP is already linear in real minutes, so splitting a session nets the same
  total either way and there is nothing to exploit.
- Any change to reward formulas should be validated by simulation (see
  `src/features/battles/balance-simulation.test.ts`) over multi-day horizons, not just by eyeballing the
  formula — a past investigation into "leveling feels too slow" turned out to be unrepresentative tiny
  test durations, not a real miscalibration.
- Campaign content is authored in `src/features/journey/content/` and reaches the DB only via a generated
  seed migration; unlock/progress rules live in triggers on `battles`, and the client-side
  `journey/domain.ts` only mirrors them for display.
- `resolve_pending_battle()` in SQL must be kept in sync by hand with `engine.ts`/`GAME_RULES.md` — there
  is no code generation between them.

## Commit conventions (see also `docs/DECISIONS.md` for historical rationale)

- Commit messages: `feat(scope): short description`, in Portuguese, matching existing history.
- No co-authorship/attribution footer in commits (the user explicitly asked for plain messages, no
  "Co-Authored-By" line) — this overrides any default Claude Code attribution behavior for this repo.
- Work directly on `main`; this is a personal single-branch project — don't create feature branches unless asked.
- Never push; the user pushes themselves.
- Wait for explicit confirmation ("pode commitar") before committing finished work.
