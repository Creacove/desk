# Vercel Zero-Downtime Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing Desk Vite application to a new Vercel project and move `desk.ordersounds.com` with one verified production DNS cutover and no planned downtime.

**Architecture:** Keep the current Netlify deployment, Supabase database/Auth/Storage/Edge Functions, billing webhooks, and provider secrets unchanged. Add Vercel as a parallel static Vite host with a root SPA rewrite, matching response headers, and one Vercel Edge Function adapter for `/api/billing-country`; only after the Vercel URL passes the release gate will the existing custom hostname be attached and DNS changed.

**Tech Stack:** React 18, Vite 5, TypeScript, Vitest, Vercel CLI 59, Netlify CLI 26, Supabase JS, Vercel Edge Functions, Netlify DNS.

---

## File map

- Create `vercel.json`: Vite build/output settings, SPA fallback, and the existing browser security headers translated to Vercel JSON.
- Create `api/billing-country.ts`: Vercel Edge Function with the same JSON contract as the current Netlify Edge Function.
- Modify `package.json`: pin the deployment Node runtime to the existing Node 22 build runtime.
- Modify `src/payment-deployment-config.test.ts`: contract tests for the new Vercel configuration and function adapter while retaining the Netlify contract tests.
- Create `docs/superpowers/specs/2026-08-20-vercel-zero-downtime-migration-design.md`: approved migration design and rollback rules.
- Create `docs/superpowers/plans/2026-08-20-vercel-zero-downtime-migration.md`: this implementation plan.

### Task 1: Add failing deployment contract tests

**Files:**
- Modify: `src/payment-deployment-config.test.ts`
- Test: `src/payment-deployment-config.test.ts`

- [ ] **Step 1: Add tests for the Vercel build and routing contract**

Append these tests inside the existing `describe("payment deployment configuration", () => { ... })` block:

```ts
  it("defines the Vite production build and SPA fallback for Vercel", () => {
    const config = JSON.parse(read("vercel.json")) as {
      framework?: string;
      buildCommand?: string;
      outputDirectory?: string;
      rewrites?: Array<{ source?: string; destination?: string }>;
    };

    expect(config.framework).toBe("vite");
    expect(config.buildCommand).toBe("npm run build");
    expect(config.outputDirectory).toBe("dist");
    expect(config.rewrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/(.*)", destination: "/index.html" }),
    ]));
  });

  it("keeps the browser hardening headers on Vercel", () => {
    const config = JSON.parse(read("vercel.json")) as {
      headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
    };
    const headers = config.headers?.flatMap((entry) => entry.headers ?? []) ?? [];
    const values = new Map(headers.map((header) => [header.key, header.value]));

    expect(values.get("X-Content-Type-Options")).toBe("nosniff");
    expect(values.get("X-Frame-Options")).toBe("DENY");
    expect(values.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(values.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=(), payment=(self)");
    expect(values.get("Content-Security-Policy-Report-Only")).toContain("https://cdn.paddle.com");
    expect(values.get("Content-Security-Policy-Report-Only")).toContain("https://eu.i.posthog.com");
  });

  it("preserves the country endpoint contract in the Vercel adapter", () => {
    const edge = read("api", "billing-country.ts");
    expect(edge).toContain('runtime: "edge"');
    expect(edge).toContain("x-vercel-ip-country");
    expect(edge).toContain("/^[A-Z]{2}$/");
    expect(edge).toContain('"Cache-Control": "private, no-store"');
    expect(edge).toContain('"Vary": "Cookie"');
    expect(edge).not.toContain("OTHERS");
  });

  it("pins the Vercel build to the same Node major used by Netlify", () => {
    const packageJson = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    expect(packageJson.engines?.node).toBe("22.x");
  });
```

- [ ] **Step 2: Run the focused test and confirm it fails for missing Vercel files**

Run:

```powershell
npm test -- src/payment-deployment-config.test.ts
```

Expected: FAIL because `vercel.json`, `api/billing-country.ts`, and `package.json.engines.node` do not exist yet.

- [ ] **Step 3: Commit the failing contract tests**

```powershell
git add src/payment-deployment-config.test.ts
git commit -m "test: define Vercel deployment contracts"
```

### Task 2: Add the Vercel deployment adapter

**Files:**
- Create: `vercel.json`
- Create: `api/billing-country.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the Vercel configuration**

Create `vercel.json` with the Vite build, SPA fallback, and the current Netlify security headers:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(self)" },
        {
          "key": "Content-Security-Policy-Report-Only",
          "value": "default-src 'self'; script-src 'self' https://cdn.paddle.com https://eu-assets.i.posthog.com; connect-src 'self' https://bbwbxmnanccwottrmkqu.supabase.co wss://bbwbxmnanccwottrmkqu.supabase.co https://sandbox-api.paddle.com https://api.paddle.com https://checkout-service.paddle.com https://sandbox-checkout-service.paddle.com https://eu.i.posthog.com; frame-src https://checkout.paddle.com https://sandbox-checkout.paddle.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Add the Vercel Edge Function adapter**

Create `api/billing-country.ts`:

```ts
export const config = { runtime: "edge" } as const;

export default function handler(request: Request) {
  const candidate = request.headers.get("x-vercel-ip-country") ?? undefined;
  const normalized = typeof candidate === "string" ? candidate.trim().toUpperCase() : undefined;
  const countryCode = normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;

  return new Response(JSON.stringify(countryCode ? { countryCode } : {}), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}
```

- [ ] **Step 3: Pin the Node runtime to the existing build major**

Add this top-level property to `package.json` without changing any existing scripts or dependencies:

```json
"engines": {
  "node": "22.x"
},
```

- [ ] **Step 4: Run the focused contract test**

Run:

```powershell
npm test -- src/payment-deployment-config.test.ts
```

Expected: PASS, including both the original Netlify checks and the new Vercel checks.

- [ ] **Step 5: Commit the adapter**

```powershell
git add vercel.json api/billing-country.ts package.json package-lock.json src/payment-deployment-config.test.ts
git commit -m "feat: add Vercel hosting adapter"
```

### Task 3: Verify the exact build locally

**Files:** None beyond Task 2.

- [ ] **Step 1: Validate JSON and TypeScript entrypoint syntax**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf8')); console.log('vercel.json valid')"
npx tsc --noEmit --target ES2020 --module ESNext --moduleResolution Node --strict --skipLibCheck --lib ES2020,DOM api/billing-country.ts
```

Expected: `vercel.json valid`, followed by a successful TypeScript exit.

- [ ] **Step 2: Run the full automated suite as a follow-up quality gate**

Run:

```powershell
npm test
```

Expected: this follow-up suite is clean before unrelated application work is merged. It is not a prerequisite for the hosting cutover: the migration gate is the focused deployment contract suite, the production build, and the Vercel preview/production smoke checks. The clean baseline recorded 7 pre-existing failing test files (43 failures), which remain outside this hosting change.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: Vite writes `dist` successfully with `VITE_APP_MODE` not set to `prototype`.

### Task 4: Create and configure the isolated Vercel project

**External state:** Vercel project configuration only; no custom domain or DNS changes.

- [ ] **Step 1: Confirm the target name is unused**

Run:

```powershell
vercel project ls --scope creacoveofficial-3023s-projects
```

Expected: no project named `ordersounds-desk`; existing `royaltytracker` and `ordersoundsw` remain unchanged.

- [ ] **Step 2: Create the new project**

Run:

```powershell
vercel project add ordersounds-desk --scope creacoveofficial-3023s-projects
```

Expected: Vercel creates `ordersounds-desk` under `creacoveofficial-3023s-projects` and prints its project id.

- [ ] **Step 3: Link only this workspace to the new project**

Run:

```powershell
vercel link --yes --scope creacoveofficial-3023s-projects --project ordersounds-desk
```

Expected: a local `.vercel/project.json` is created containing the new project link. Do not stage or commit this local link file.

- [ ] **Step 4: Configure the production browser environment values**

Read the current Netlify production environment in memory with the authenticated Netlify CLI. Copy only these browser-build keys to the Vercel Production and Preview environments:

```text
VITE_APP_MODE
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PRIVATE_BETA_ENABLED
VITE_POSTHOG_KEY
VITE_POSTHOG_HOST
```

Set `VITE_PRIVATE_BETA_ENABLED=true` for Vercel Production, matching `netlify.toml`; preserve the existing value for Preview if it is separately configured. Do not copy `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, payment secrets, email keys, Spotify secrets, or provider refresh tokens to Vercel.

Verify names and targets without printing values:

```powershell
vercel env ls --project ordersounds-desk
```

Expected: the required public variables exist for Production and Preview, and no server-only secret was added.

### Task 5: Deploy and verify Vercel before touching production DNS

**External state:** Vercel preview deployment only. Netlify remains production.

- [ ] **Step 1: Deploy the linked workspace to Vercel**

Run:

```powershell
vercel --yes --scope creacoveofficial-3023s-projects
```

Expected: Vercel returns a unique deployment URL for `ordersounds-desk`; `desk.ordersounds.com` is not changed.

- [ ] **Step 2: Verify static shell, SPA fallback, headers, and country endpoint**

Read the exact deployment URL printed by the previous step into `$vercelPreviewUrl`, then run:

```powershell
$vercelPreviewUrl = (Read-Host "Paste the exact Vercel preview URL printed above").TrimEnd("/")
$root = Invoke-WebRequest -Uri "$vercelPreviewUrl/" -TimeoutSec 30
$deep = Invoke-WebRequest -Uri "$vercelPreviewUrl/share" -TimeoutSec 30
$country = Invoke-WebRequest -Uri "$vercelPreviewUrl/api/billing-country" -Headers @{ 'x-vercel-ip-country' = 'NG' } -TimeoutSec 30
[pscustomobject]@{ Root=$root.StatusCode; Deep=$deep.StatusCode; Country=$country.Content; Server=($root.Headers['server'] -join ','); VercelId=($root.Headers['x-vercel-id'] -join ',') } | Format-List
```

Expected: root and deep link return 200; country response contains `"countryCode":"NG"`; response headers include Vercel indicators and the configured security headers.

- [ ] **Step 3: Run browser smoke tests on the preview URL**

Verify signed-out loading, the login shell, password-reset navigation, a deep link refresh, and the app's public `/share` and `/split-confirmation` entrypoints. For authenticated testing, add only the exact preview origin to Supabase Auth's allowed redirect URLs, run the smoke test, and retain the production URL as the Site URL.

Expected: the preview behaves like the current Netlify production shell and does not create duplicate records or invoke a webhook during read-only smoke testing.

- [ ] **Step 4: Stop before cutover if any acceptance check fails**

Do not add the custom domain or change DNS until the preview passes the full release gate. Leave `https://desk.ordersounds.com` on Netlify while diagnosing any failure.

### Task 6: Perform the single production domain cutover

**External state:** custom domain association and Netlify-managed DNS record. This is the only production traffic change.

- [ ] **Step 1: Record current DNS and Netlify rollback values**

Run:

```powershell
Resolve-DnsName desk.ordersounds.com -Type A
netlify dns:records:list ordersounds.com
vercel domains inspect desk.ordersounds.com
```

Record the current Netlify A records and the Vercel-required target. The current observed Netlify A records are `63.176.8.218` and `35.157.26.135`; Vercel currently reports `A desk.ordersounds.com 76.76.21.21` as its target.

- [ ] **Step 2: Attach the custom domain to the new Vercel project**

Run:

```powershell
vercel domains add desk.ordersounds.com ordersounds-desk --scope creacoveofficial-3023s-projects
```

Expected: Vercel accepts the domain for `ordersounds-desk`. If Vercel reports that the domain is still attached to `royaltytracker`, remove only that old project-domain association, never the project itself, then retry the add operation.

- [ ] **Step 3: Verify the Vercel domain target before DNS change**

Run:

```powershell
vercel domains inspect desk.ordersounds.com
```

Expected: Vercel shows the new project and the exact DNS record required for the subdomain.

- [ ] **Step 4: Change only the `desk` DNS record at Netlify DNS**

Update the existing `desk.ordersounds.com` A record through the authenticated Netlify DNS path to the exact Vercel target reported in Step 3. Do not change the zone nameservers, apex records, email records, Supabase URLs, or unrelated subdomains.

Expected: DNS queries may return mixed old/new answers briefly because of TTL; Netlify remains available on its fallback hostname during propagation.

- [ ] **Step 5: Verify traffic and TLS until Vercel is authoritative**

Run repeatedly until the expected result is stable:

```powershell
Resolve-DnsName desk.ordersounds.com -Type A
vercel domains inspect desk.ordersounds.com
$check = Invoke-WebRequest -Uri 'https://desk.ordersounds.com/' -TimeoutSec 30
[pscustomobject]@{ Status=$check.StatusCode; Server=($check.Headers['server'] -join ','); VercelId=($check.Headers['x-vercel-id'] -join ','); Length=$check.RawContentLength } | Format-List
```

Expected: HTTPS remains valid, the root and deep links serve the Vercel build, and Vercel domain verification reports the domain configured.

### Task 7: Post-cutover verification and rollback window

- [ ] **Step 1: Repeat the critical browser smoke on the production hostname**

Verify sign-in, workspace hydration, one non-mutating Manager read, a deep-link refresh, `/api/billing-country`, split confirmation loading, public share loading, and payment-return URL parsing without submitting a live payment.

- [ ] **Step 2: Verify backend continuity**

Confirm the browser still calls the same Supabase project URL, the Paystack webhook URL is unchanged, and no Supabase Edge Function deployment or database migration occurred.

- [ ] **Step 3: Keep Netlify as rollback for the stabilization window**

Leave `https://ordersounds-desk.netlify.app` and the Netlify project intact. If a production blocker appears, restore the recorded Netlify DNS A records and re-run the production smoke checks; do not rebuild or delete either project.

- [ ] **Step 4: Close the migration only after stability is observed**

After the rollback window is complete, disable the old Netlify Git auto-build trigger if desired. Do not remove the Netlify project or custom-domain configuration until the user explicitly asks for cleanup.
