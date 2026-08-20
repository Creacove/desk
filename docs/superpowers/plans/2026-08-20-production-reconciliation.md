# Production reconciliation and release

## Goal

Publish the current Desk product line from the actual GitHub `main`, including PR24's Today's Brief operating refresh and the already validated Vercel hosting adapter, while keeping the existing Netlify deployment available as a fallback. Bring the hosted Desk Supabase schema and deployed Edge Functions to the same release contract, and leave the repository with a reproducible, verified production release.

## Release-selection decisions

- Use GitHub `origin/main` at `2dbefb5` as the code baseline. The local checkout is stale and contains eight Vercel commits based on an older history, so those commits must be replayed onto current `main` rather than merging the stale local branch.
- Include the ten product commits from PR24 (`feature/todays-brief-operating-v1`) after validating and repairing its contracts.
- Do not merge PR23's `.release-qa/manager-song-production-verify.txt`; it is explicitly a disposable verification marker, not product functionality.
- Do not merge PR2 wholesale; it is an old draft whose CI workflow and generated-artifact cleanup must be compared with current `main` before any reusable piece is selected.
- Audit remote branches for unique work, but do not combine abandoned or superseded design/QA branches into this release without a current product contract and tests.
- Preserve unrelated untracked user files in the original checkout and do all implementation work in the isolated release worktree.

## Implementation and verification tasks

### 1. Assemble the release candidate

1. Confirm the worktree starts clean at current GitHub `main` and capture the exact baseline SHA.
2. Cherry-pick the eight Vercel migration commits in chronological order, resolving only conflicts caused by current `main` movement. Keep `vercel.json`, `api/billing-country.ts`, production configuration, package metadata, and deployment-contract tests together.
3. Fast-forward/merge PR24's ten commits onto the release candidate. Review the final diff for frontend behavior, Edge Function behavior, prompt contracts, and migration references.
4. Run `git diff --check` and inspect the resulting commit graph before changing application code.

### 2. Lock PR24 behavior with tests first

1. Run the focused PR24 tests against the assembled candidate to reproduce failures.
2. Add or update regression coverage before implementation changes for:
   - setup-map versus operating Today's Brief prompt boundaries and the exact four-section contract;
   - platform-specific metric labels and exclusion of proprietary Chartmetric ranks/scores;
   - current workspace context projection, row limits, ordering, and account/workspace/artist scoping;
   - 24-hour Chartmetric refresh, cached artist identity reuse, and last-known-good fallback;
   - persisted Chartmetric identity updates scoped to the authenticated source connection.
3. Make the smallest production changes required by those tests. Keep setup behavior unchanged where PR24 only changes operating behavior.

### 3. Repair the complete test contract

1. Run the full Vitest suite on the current candidate and group failures by the owning product contract rather than patching assertions one by one.
2. Reconcile stale test expectations with the current Manager/Song V2 source of truth, preserving user-visible behavior that is intentionally part of the latest release.
3. Fix production code when a failing test identifies a real runtime regression (navigation, action state, data scoping, responsive behavior, or release artifact rendering); update a test only when the intended current contract is demonstrably different.
4. Re-run focused suites after each cluster, then the full suite, so no failure is hidden by a broad fixture change.

### 4. Reconcile and promote Supabase

1. Compare the repository migration files with the hosted Desk migration ledger for project ref `bbwbxmnanccwottrmkqu`.
2. Validate `20260820094704_manager_song_system_v2.sql` for additive/backward-compatible DDL, data backfill safety, grants, and RLS before applying it. Do not reset or overwrite the hosted database. The filename is aligned to the hosted migration ledger timestamp created by the authenticated migration apply.
3. Apply only migrations shown as pending by the hosted ledger, then re-list migrations and run the relevant schema/RPC/RLS smoke checks and Supabase security/performance advisors.
4. Deploy the release's changed Edge Functions (`generate-todays-brief` and `chartmetric-artist-enrichment`, including their shared modules) with JWT verification settings matching the existing functions.
5. Verify the deployed function versions and production configuration without exposing secrets.

### 5. Verify the release candidate end to end

Run fresh commands from the release worktree and require successful exit codes for:

- focused PR24/product tests and the full Vitest suite;
- production build, production environment validation, browser/type regression, Deno Edge checks, and dependency audit;
- local/fresh Supabase migration/RPC/RLS smoke coverage;
- Vercel deployment contract checks and a production deployment preview;
- HTTP and real-browser smoke checks on `desk.ordersounds.com` for the root app, `/share`, billing-country API, authentication shell, and a representative Manager/Song route;
- Netlify fallback reachability, without depending on a Netlify rebuild.

Record the final release SHA, migration versions, deployed Vercel URL, custom-domain response status, and fallback status.

### 6. Publish once the candidate is green

1. Commit the reconciled candidate with a release message that avoids unnecessary Netlify preview churn.
2. Push the candidate as a fast-forward update to PR24's existing head branch so PR24 becomes the single review/release vehicle.
3. Wait for and inspect all required GitHub checks on the updated PR24 head. Do not merge while a required check is red.
4. Merge PR24 into `main` using the GitHub PR workflow after checks are green.
5. Deploy the merged release to Vercel production, verify the custom domain and fallback again, and ensure the Vercel project remains attached to `desk.ordersounds.com` with the production branch configured correctly.
6. Leave disposable/obsolete PRs open unless closing them is separately required; do not represent their marker or scaffolding files as shipped product work.

## Completion gate

The release is complete only when the production Vercel deployment, the hosted Supabase migration ledger, the deployed Edge Functions, GitHub `main`, and the verified test/build evidence all point to the same release candidate, with no known blocking test or migration mismatch.
