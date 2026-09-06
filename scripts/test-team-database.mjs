#!/usr/bin/env node

/**
 * Disposable Postgres verification for the artist-team migration boundary.
 *
 * This harness deliberately requires an explicit local/disposable target. It
 * never reads DATABASE_URL, hosted Supabase credentials, or a default target.
 * With --docker-container, every concurrent case is a separate `docker exec`
 * process and therefore a separate psql connection. With --db-url, each case
 * starts its own psql process against the explicitly supplied local URL.
 */

import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const TEAM_SETUP = path.join(REPO_ROOT, "supabase", "tests", "artist_team_seat_concurrency_setup.sql");
const TEAM_VERIFY = path.join(REPO_ROOT, "supabase", "tests", "artist_team_seat_concurrency_verify.sql");
const TEAM_CONTINUATION_GOLDEN = path.join(REPO_ROOT, "supabase", "tests", "artist_team_manager_continuation_golden.sql");

const FIXTURE = Object.freeze({
  account: "91000000-0000-4000-8000-000000000001",
  artist: "91000000-0000-4000-8000-000000000002",
  workspace: "91000000-0000-4000-8000-000000000003",
  owner: "91000000-0000-4000-8000-000000000004",
  acceptor: "91000000-0000-4000-8000-000000000005",
  task: "91000000-0000-4000-8000-000000000006",
  outsider: "91000000-0000-4000-8000-000000000007",
  acceptToken: "team-concurrency-accept-token-v1",
  acceptEmail: "acceptor-team-concurrency@example.invalid",
});

const MUTATION_FUNCTIONS = [
  "invite_account_member_v1",
  "rotate_account_invitation_v1",
  "revoke_account_invitation_v1",
  "accept_account_invitation_v1",
  "remove_account_member_v1",
  "update_member_responsibilities_v1",
  "reassign_workspace_task_v1",
];

const args = parseArgs(process.argv.slice(2));

function usage() {
  return `Usage:
  node scripts/test-team-database.mjs --source-only
  node scripts/test-team-database.mjs --target local --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
  node scripts/test-team-database.mjs --target local --docker-container supabase_db_desk

The database mode requires --target local or --target disposable and one of
--db-url or --docker-container. Only loopback URLs and explicitly named local
containers are accepted. Hosted URLs are rejected before any connection.
`;
}

function parseArgs(argv) {
  const parsed = { sourceOnly: false, keepFixture: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (value === "--source-only") {
      parsed.sourceOnly = true;
      continue;
    }
    if (value === "--keep-fixture") {
      parsed.keepFixture = true;
      continue;
    }
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    if (!["target", "db_url", "docker_container"].includes(key.replaceAll("-", "_"))) {
      throw new Error(`Unknown option --${key}`);
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}`);
    parsed[key.replaceAll("-", "_")] = next;
    index += 1;
  }
  return parsed;
}

function fail(message) {
  throw new Error(message);
}

function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://***:***@")
    .replace(/[A-Za-z0-9_-]{43}/g, "[token-redacted]")
    .replace(/[0-9a-f]{64}/gi, "[hash-redacted]");
}

function validateTarget(options) {
  if (options.sourceOnly) {
    if (options.target || options.db_url || options.docker_container) {
      fail("--source-only cannot be combined with a database target or connection.");
    }
    return;
  }
  const target = options.target;
  if (!target) fail(`Refusing database verification without an explicit --target local|disposable.\n${usage()}`);
  if (target !== "local" && target !== "disposable") {
    fail(`Unsupported target "${target}". Only local and disposable targets are allowed.`);
  }
  if (options.db_url && options.docker_container) fail("Choose exactly one of --db-url or --docker-container.");
  if (!options.db_url && !options.docker_container) {
    fail("Database verification requires --db-url or --docker-container; no target is inferred.");
  }
  if (options.docker_container && !/^[A-Za-z0-9_.-]+$/.test(options.docker_container)) {
    fail("--docker-container must be a simple local Docker container name.");
  }
  if (!options.db_url) return;
  let url;
  try {
    url = new URL(options.db_url);
  } catch {
    fail("--db-url must be a valid postgresql:// or postgres:// URL.");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    fail("--db-url must use postgresql:// or postgres://.");
  }
  const host = url.hostname.toLowerCase();
  const hostedPattern = /(supabase\.(co|in)|pooler\.supabase|amazonaws\.com|azure(postgres|database)|neon\.tech|railway\.app|render\.com)/i;
  if (hostedPattern.test(host)) fail("Hosted database URLs are rejected; use a loopback disposable database.");
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "host.docker.internal";
  if (!loopback) fail(`Database host "${host}" is not loopback. Hosted and remote targets are rejected.`);
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function sourceChecks() {
  const failures = [];
  const check = (name, condition, detail) => {
    if (!condition) failures.push(`${name}: ${detail}`);
  };

  const migrationNames = await readdir(MIGRATIONS_DIR);
  const migrationFiles = migrationNames.filter((name) => name.endsWith(".sql")).sort();
  const identity = migrationFiles.find((name) => name.includes("workspace_identity_boundary"));
  const foundationName = migrationFiles.find((name) => name.includes("artist_team_foundation"));
  const membershipName = migrationFiles.find((name) => name.includes("artist_team_membership_operations"));
  const authorityName = migrationFiles.find((name) => name.includes("artist_team_authority"));
  const assignmentName = migrationFiles.find((name) => name.includes("artist_team_runtime_assignment"));
  const remindersName = migrationFiles.find((name) => name.includes("artist_team_personal_reminders"));
  check("identity migration", Boolean(identity), "workspace_identity_boundary migration is missing");
  check("team migration foundation", Boolean(foundationName), "artist_team_foundation migration is missing");
  check("team migration membership", Boolean(membershipName), "artist_team_membership_operations migration is missing");
  check("team migration authority", Boolean(authorityName), "artist_team_authority migration is missing");
  check("team runtime assignment migration", Boolean(assignmentName), "artist_team_runtime_assignment migration is missing");
  check("team personal reminders migration", Boolean(remindersName), "artist_team_personal_reminders migration is missing");
  if (identity && foundationName) check("migration order", identity < foundationName, `${foundationName} must follow ${identity}`);
  if (foundationName && membershipName) check("mutation migration order", foundationName < membershipName, `${membershipName} must follow ${foundationName}`);
  if (membershipName && authorityName) check("authority migration order", membershipName < authorityName, `${authorityName} must follow ${membershipName}`);
  if (authorityName && assignmentName) check("assignment migration order", authorityName < assignmentName, `${assignmentName} must follow ${authorityName}`);
  if (assignmentName && remindersName) check("reminder migration order", assignmentName < remindersName, `${remindersName} must follow ${assignmentName}`);

  const foundation = foundationName ? await readText(path.join(MIGRATIONS_DIR, foundationName)) : "";
  const membership = membershipName ? await readText(path.join(MIGRATIONS_DIR, membershipName)) : "";
  const authority = authorityName ? await readText(path.join(MIGRATIONS_DIR, authorityName)) : "";
  const assignment = assignmentName ? await readText(path.join(MIGRATIONS_DIR, assignmentName)) : "";
  const reminders = remindersName ? await readText(path.join(MIGRATIONS_DIR, remindersName)) : "";
  const handler = await readText(path.join(REPO_ROOT, "supabase", "functions", "_shared", "accountTeamHandler.ts"));
  const authorization = await readText(path.join(REPO_ROOT, "supabase", "functions", "_shared", "workspaceAuthorization.ts"));
  const functionConfig = await readText(path.join(REPO_ROOT, "supabase", "config.toml"));

  check("token storage", /token_hash\s+text/i.test(foundation), "team invitations must persist token_hash");
  check("token secrecy", !/\btoken\s+text\b/i.test(foundation), "team tables must not add a plaintext token column");
  check("team RLS", /alter table public\.account_invitations enable row level security/i.test(foundation), "invitation RLS is missing");
  check("service-only mutations", /revoke all on function public\.invite_account_member_v1/i.test(membership), "mutation RPCs must be revoked from public/anon/authenticated");
  check("continuation assignment trigger", /create trigger zz_persist_team_continuation_assignments/i.test(assignment), "task-result continuation assignment trigger is missing");
  check("validated assignment grant", /grant execute on function public\._persist_model_assignment_v1[\s\S]*?to service_role/i.test(assignment), "validated assignment helper is not granted to service_role");
  check("personal reminder delivery", /recipient_user_id[\s\S]*?deliver_in_app_task_reminder_v1/i.test(reminders), "personal reminder addressing is missing");
  check("account lock", /from\s+public\.accounts\b[\s\S]{0,180}\bfor\s+update\b/i.test(membership), "mutation path must lock the account before seat changes");
  const serviceGrantBlocks = [...membership.matchAll(/grant\s+execute\s+on\s+function([\s\S]*?)to\s+service_role\s*;/gi)]
    .map((match) => match[1]).join("\n");
  for (const functionName of MUTATION_FUNCTIONS) {
    check(`mutation RPC ${functionName}`, new RegExp(`create or replace function public\\.${functionName}\\b`, "i").test(membership), "required contract function is missing");
    check(`mutation grant ${functionName}`, new RegExp(`public\\.${functionName}\\s*\\(`, "i").test(serviceGrantBlocks), "required service_role grant is missing");
  }
  check("verified actor", /p_actor_user_id:\s*user\.id/.test(handler), "Edge mutations must derive actor from verified auth");
  check("no forged actor", !/p_actor_user_id:\s*body\./.test(handler), "request body must not supply the mutation actor");
  check("JWT boundary", /\[functions\.account-team\][\s\S]*?verify_jwt\s*=\s*true/i.test(functionConfig), "account-team must keep gateway JWT verification enabled");
  if (/assert_workspace_operation_v1/.test(authorization)) {
    check("authority RPC definition", /create or replace function public\.assert_workspace_operation_v1\b/i.test(authority), "workspace authorization client references an RPC with no authority migration definition");
  }

  if (failures.length) fail(`Source contract checks failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  console.log(`Team source checks passed (${migrationFiles.filter((name) => /artist_team/.test(name)).length} team migration file(s) found).`);
}

function psqlCommand(options) {
  const baseArgs = ["--no-psqlrc", "-X", "-v", "ON_ERROR_STOP=1", "-Atq"];
  if (options.docker_container) {
    return { command: "docker", args: ["exec", "-i", options.docker_container, "psql", ...baseArgs, "-U", "postgres", "-d", "postgres"] };
  }
  return { command: "psql", args: [...baseArgs, "-d", options.db_url] };
}

function runPsql(options, sql) {
  const { command, args: commandArgs } = psqlCommand(options);
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: REPO_ROOT,
      env: { ...process.env, PGAPPNAME: "team-release-verification" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`Unable to start ${command}: ${error.message}`)));
    child.on("close", (code, signal) => resolve({ code: code ?? 1, signal, stdout, stderr }));
    child.stdin.end(sql);
  });
}

async function runSql(options, sql, label) {
  const result = await runPsql(options, sql);
  if (result.code !== 0) {
    const detail = redact(result.stderr).trim().split(/\r?\n/).filter(Boolean)[0] || `exit ${result.code}`;
    fail(`${label} failed: ${detail}`);
  }
  return result.stdout.trim();
}

function inviteSql(index) {
  const email = `seat-race-${index}@example.invalid`;
  const token = `team-seat-race-token-${index}`;
  return serviceRoleSql(`select public.invite_account_member_v1('${FIXTURE.owner}','${FIXTURE.workspace}','${email}',encode(digest('${token}','sha256'),'hex'),null,'{}'::text[])::text;`);
}

function acceptSql() {
  return serviceRoleSql(`select public.accept_account_invitation_v1('${FIXTURE.acceptor}','${FIXTURE.acceptEmail}',encode(digest('${FIXTURE.acceptToken}','sha256'),'hex'))::text;`);
}

function removeSql() {
  return serviceRoleSql(`select public.remove_account_member_v1('${FIXTURE.owner}','${FIXTURE.workspace}','${FIXTURE.acceptor}')::text;`);
}

function serviceRoleSql(sql) {
  return `select set_config('request.jwt.claims','{"role":"service_role"}',false);\n${sql}`;
}

async function runConcurrency(options) {
  const seatResults = await Promise.all(Array.from({ length: 8 }, (_, index) => runPsql(options, inviteSql(index + 1))));
  const seatSuccesses = seatResults.filter((result) => result.code === 0);
  const seatConflicts = seatResults.filter((result) => result.code !== 0 && `${result.stdout}\n${result.stderr}`.includes("TEAM_CONFLICT"));
  if (seatSuccesses.length !== 4 || seatConflicts.length !== 4) {
    fail(`seat concurrency expected 4 successes and 4 TEAM_CONFLICT results, received ${seatSuccesses.length} and ${seatConflicts.length}`);
  }
  console.log("Seat reservation race passed (4 accepted, 4 rejected, separate connections).");

  const acceptanceResults = await Promise.all(Array.from({ length: 6 }, () => runPsql(options, acceptSql())));
  if (acceptanceResults.some((result) => result.code !== 0)) {
    const failure = acceptanceResults.find((result) => result.code !== 0);
    fail(`acceptance replay race failed: ${redact(failure?.stderr || "unknown error")}`);
  }
  console.log("Invitation acceptance replay race passed (6 idempotent successes, separate connections).");

  const removalResults = await Promise.all(Array.from({ length: 4 }, () => runPsql(options, removeSql())));
  const removalSuccesses = removalResults.filter((result) => result.code === 0);
  const removalNotFound = removalResults.filter((result) => result.code !== 0 && `${result.stdout}\n${result.stderr}`.includes("TEAM_NOT_FOUND"));
  if (removalSuccesses.length !== 1 || removalNotFound.length !== 3) {
    fail(`member removal race expected 1 success and 3 TEAM_NOT_FOUND results, received ${removalSuccesses.length} and ${removalNotFound.length}`);
  }
  console.log("Member removal/reminder cancellation race passed (1 committed removal, 3 stale callers).");
}

function cleanupSql() {
  return `delete from public.accounts where id='${FIXTURE.account}';\ndelete from public.users where id in ('${FIXTURE.owner}','${FIXTURE.acceptor}','${FIXTURE.outsider}');\ndelete from auth.users where id in ('${FIXTURE.owner}','${FIXTURE.acceptor}','${FIXTURE.outsider}');`;
}

async function databaseChecks(options) {
  try {
    await runSql(options, await readText(TEAM_SETUP), "team concurrency setup");
    await runSql(options, await readText(TEAM_CONTINUATION_GOLDEN), "multi-human Manager continuation golden");
    console.log("Multi-human Manager continuation golden passed.");
    await runConcurrency(options);
    await runSql(options, await readText(TEAM_VERIFY), "team concurrency verification");
    console.log("Team disposable database checks passed.");
  } finally {
    if (!options.keep_fixture) {
      try {
        await runSql(options, cleanupSql(), "team fixture cleanup");
        console.log("Synthetic team fixture cleaned up.");
      } catch (error) {
        console.error(`Warning: synthetic fixture cleanup failed: ${redact(error.message)}`);
      }
    } else {
      console.log(`Synthetic fixture retained at account ${FIXTURE.account} by --keep-fixture.`);
    }
  }
}

async function main() {
  validateTarget(args);
  await sourceChecks();
  if (!args.sourceOnly) await databaseChecks(args);
}

main().catch((error) => {
  console.error(`Team database verification failed: ${redact(error.message)}`);
  process.exitCode = 1;
});
