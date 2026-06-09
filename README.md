# Desk

Desk is the working product repo for the artist operating system. The Supabase-backed production app is the default local run mode. The current Ordersounds Desk prototype remains runnable only as explicit reference material.

## Current App

### Production app contract

- `src/main.tsx` renders the Supabase-backed production app by default.
- `src/app/ProductionApp.tsx` is the real app shell for onboarding, Desk HQ, Music, Missions, Manager, Staff, and Settings.
- The production app uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local`.

### Frozen prototype contract

- `src/main.tsx` renders the prototype only when `VITE_APP_MODE=prototype` is set.
- `src/prototype/AiLabelPrototype.tsx` contains the frozen runnable prototype screen and flow.
- The prototype is reference material for product behavior, visual hierarchy, and workflow parity. Do not build production features inside the prototype file.
- Prototype tests are not the production acceptance suite; production tests should target production services, schema, projections, and workflows.

### Production code boundary

- `src/app/` is reserved for the production shell, routing, and providers.
- `src/features/` is reserved for product areas such as Label HQ, Music, Missions, Manager, Staff, and Settings.
- `src/services/` is reserved for Supabase query/projection clients and workflow orchestration clients.
- `src/lib/` contains shared runtime helpers such as Supabase clients and common utilities.
- `src/types/` is reserved for shared domain and database types.
- `docs/implementation-phases.md` defines the implementation phase order.
- `docs/workflows/spotify-catalog-bootstrap.md` defines the Spotify catalog bootstrap contract.

## Connected Services

- Supabase project: `bbwbxmnanccwottrmkqu` (`Desk`)
- Spotify API credentials are expected through local or deployment environment variables.
- Chartmetric credentials should be added only after access is approved.

## Environment

Copy `.env.example` to `.env.local` for local development and fill values locally. Do not commit real secrets.

```powershell
Copy-Item .env.example .env.local
```

## Run Locally

Production app is the default local run mode.

```powershell
npm install
npm run dev
```

Run a production build locally:

```powershell
npm run build
npm run preview
```

Run the frozen prototype only when explicitly needed:

```powershell
$env:VITE_APP_MODE = "prototype"
npm run dev
```

For one-off command-line runs:

```powershell
$env:VITE_APP_MODE = "prototype"; npm run dev
```

Do not set `VITE_APP_MODE=prototype` when you want the real app connected to Supabase.

## Implementation Phases

Production work moves phase by phase:

1. Cleanup and production boundary.
2. Supabase core schema.
3. Spotify catalog bootstrap.
4. Production app shell.
5. Music workspace from Supabase.
6. Label HQ read projection.
7. Direct user writes.
8. Manager workflow skeleton.
9. Evidence and social enrichment.
10. Production verification and hardening.

Each phase must pass its own gate before the next phase starts.
