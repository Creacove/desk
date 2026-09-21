# OrderSounds Ops PR1

PR1 ships the internal Ops control plane as a separate Vite/Vercel app under `ops/`. It uses the existing Desk Supabase project and existing Supabase Auth session; it does not create a second database or customer membership.

## One operator permission

`public.ordersounds_operators` is the single internal allow-list. An active row is the gate for the Ops app now and the Desk operator/admin surface planned for PR2. There is intentionally no second admin table, email-domain rule, customer `account_memberships` row, or `desk_access_enabled` flag. PR2 will reuse the same active-row check while applying its own read-only/operator-safe Desk policies.

Bootstrap a reviewed UUID with service-role SQL (never from the browser):

```sql
insert into public.ordersounds_operators (user_id)
values ('AUTH_USER_UUID')
on conflict (user_id) do update set active = true;
```

Disable access without deleting audit history:

```sql
update public.ordersounds_operators set active = false where user_id = 'AUTH_USER_UUID';
```

## Deploy `ops.ordersounds.com`

Create a separate Vercel project pointed at this repository with Root Directory `ops`. Use:

- Build command: `npm run build`
- Output directory: `dist`
- `VITE_SUPABASE_URL`: the existing Desk project URL
- `VITE_SUPABASE_ANON_KEY`: the existing browser-safe anon key

Attach `ops.ordersounds.com` to that project. The Ops browser never receives a service-role key. The same Supabase Auth account can be used for normal Desk and Ops; the active operator row controls whether the Ops route is available.

## Local verification

```powershell
npm run build --prefix ops
npx tsc -p ops/tsconfig.json --noEmit
npx vitest run src/ordersounds-ops-schema.test.ts ops/src/lib/opsService.test.ts --environment jsdom
```

The database smoke file is `supabase/tests/ordersounds_ops_control_plane_smoke.sql`. Run it through the repository's normal disposable Supabase/Postgres test environment; this machine does not include Docker/Podman, so `supabase db reset` cannot be run locally here.
