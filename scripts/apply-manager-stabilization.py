from pathlib import Path

def replace_once(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path_str}: expected exactly one match, found {count}\n--- OLD ---\n{old[:1000]}")
    path.write_text(text.replace(old, new, 1))

# 1) Structured drafts must persist even when they still need review.
replace_once(
    "supabase/functions/_shared/songDocumentDraft.ts",
    '''  const quality = assessStructuredSongDocument(artifactType, structure);
  if (quality.blockers.length) {
    throw new Error(`Document quality gate failed (${quality.score}/100): ${quality.blockers.join(" ")}`);
  }
  const renderedBody = renderStructuredSongDocument(artifactType, title, structure);
''',
    '''  const quality = assessStructuredSongDocument(artifactType, structure);
  // Draft persistence is not publication approval. A structurally valid artifact must
  // survive even when verified inputs are missing; quality.readiness keeps it in
  // needs_review and the sharing/approval UI already withholds approval in that state.
  // Reject only malformed transport above. Never force the model to pad or invent facts
  // merely to cross a word-count gate before the artist can review the draft.
  const renderedBody = renderStructuredSongDocument(artifactType, title, structure);
''',
)

# 2) Manager mutation retries, provider retry/backoff, and document-tool contract.
replace_once(
    "supabase/functions/_shared/manager-conversation/agentLoop.ts",
    '''    description: "Create or version one premium canonical song artifact in Files. Before any recipient-facing campaign artifact, establish one internal Release Narrative by calling this tool with documentType press_angle and title exactly Release narrative; use the release-narrative section set described in the body schema. The body MUST be the JSON-encoded structured artifact described by the schema; the server renders recipient-ready copy and applies type-specific quality gates. If the tool rejects quality, repair the named blockers and retry. Never send or publish the document.",
''',
    '''    description: "Create or version one premium canonical song artifact in Files. Before any recipient-facing campaign artifact, establish one internal Release Narrative by calling this tool with documentType press_angle and title exactly Release narrative; use the release-narrative section set described in the body schema. The body MUST be the JSON-encoded structured artifact described by the schema. The server persists structurally valid drafts even when verified inputs are missing and marks them needs_review; missing facts belong in missingInputs and must never be invented or padded. Retry only when the transport itself is invalid, never merely to improve a quality score. Never send or publish the document.",
''',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/agentLoop.ts",
    '''  let responseId = "";
  let toolCallsUsed = 0;

  for (let iteration = 0; iteration <= (input.maxToolCalls ?? 8); iteration += 1) {
''',
    '''  let responseId = "";
  let toolCallsUsed = 0;
  const attemptedMutationSignatures = new Set<string>();

  for (let iteration = 0; iteration <= (input.maxToolCalls ?? 8); iteration += 1) {
''',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/agentLoop.ts",
    '''    const executeCall = async (call: FunctionCall) => {
      const started = {
''',
    '''    const executeCall = async (call: FunctionCall) => {
      const mutationSignature = managerMutationSignature(call);
      if (mutationSignature && attemptedMutationSignatures.has(mutationSignature)) {
        const completed = {
          tool: call.name,
          callId: call.callId,
          status: "completed" as const,
          summary: "Duplicate write suppressed; the first result for this mutation remains authoritative.",
        };
        toolTrace.push(completed);
        await input.onToolEvent?.(publicToolEvent(completed));
        return {
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify({
            status: "duplicate_suppressed",
            retryable: false,
            reason: "The same mutation was already attempted in this Manager turn.",
          }),
        };
      }
      if (mutationSignature) attemptedMutationSignatures.add(mutationSignature);

      const started = {
''',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/agentLoop.ts",
    '''async function postResponses(fetchImpl: typeof fetch, endpoint: string, apiKey: string, body: Record<string, unknown>) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Manager agent request failed with status ${response.status}: ${errorBody.slice(0, 500)}`);
  }
  return await response.json() as Record<string, unknown>;
}

function extractFunctionCalls(payload: Record<string, unknown>): FunctionCall[] {
''',
    '''const MANAGER_MUTATION_TOOLS = new Set([
  "propose_focused_release_date_change",
  "save_focused_release_opportunities",
  "record_focused_release_opportunity_outcome",
  "create_focused_song_document",
  "prepare_focused_release_share_package",
  "update_focused_music_metadata",
  "update_focused_music_lifecycle",
  "ensure_song_release_workspace",
]);

function managerMutationSignature(call: FunctionCall) {
  if (!MANAGER_MUTATION_TOOLS.has(call.name)) return "";
  const sortedArgs = Object.fromEntries(Object.entries(call.args).sort(([left], [right]) => left.localeCompare(right)));
  return `${call.name}:${JSON.stringify(sortedArgs)}`;
}

const MAX_PROVIDER_RETRIES = 2;

async function postResponses(fetchImpl: typeof fetch, endpoint: string, apiKey: string, body: Record<string, unknown>) {
  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRIES; attempt += 1) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return await response.json() as Record<string, unknown>;

    const errorBody = await response.text();
    const retryable = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
    if (retryable && attempt < MAX_PROVIDER_RETRIES) {
      await sleep(providerRetryDelayMs(response, errorBody, attempt));
      continue;
    }
    throw new Error(`Manager agent request failed with status ${response.status}: ${errorBody.slice(0, 500)}`);
  }
  throw new Error("Manager agent request exhausted provider retries.");
}

function providerRetryDelayMs(response: Response, errorBody: string, attempt: number) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(15_000, Math.ceil(retryAfterSeconds * 1_000) + 150);
  }
  const bodyDelay = errorBody.match(/try again in\\s+([\\d.]+)s/i);
  if (bodyDelay) {
    const seconds = Number(bodyDelay[1]);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(15_000, Math.ceil(seconds * 1_000) + 150);
  }
  return Math.min(15_000, 750 * (2 ** attempt));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function extractFunctionCalls(payload: Record<string, unknown>): FunctionCall[] {
''',
)

# 3) Expected safety validation is not an outage; document errors get their own taxonomy.
replace_once(
    "supabase/functions/_shared/manager-conversation/toolExecutor.ts",
    '''  // These are expected model-validation failures, not application failures. Do not
  // persist a source-less target or a contact that cannot be traced to a public page.
  rawCandidates.forEach((raw) => assertPublicOpportunityProvenance(record(raw)));

  let saved: ReleaseOpportunityBrief[] = [];
''',
    '''  let saved: ReleaseOpportunityBrief[] = [];
''',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/toolExecutor.ts",
    '''  const rejected: Array<{ targetName: string; reason: string }> = [];
  try {
    const context = await loadOpportunityContext(db, input, opportunityType);
''',
    '''  const rejected: Array<{ targetName: string; reason: string }> = [];
  try {
    // These are expected model-validation failures, not application failures. Do not
    // persist a source-less target or a contact that cannot be traced to a public page.
    rawCandidates.forEach((raw) => assertPublicOpportunityProvenance(record(raw)));

    const context = await loadOpportunityContext(db, input, opportunityType);
''',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/toolExecutor.ts",
    '''  } catch (error) {
    return failedOpportunityResult(error, input, "opportunity_persistence", "The song document could not be saved.");
  }
}

async function prepareFocusedReleaseSharePackage''',
    '''  } catch (error) {
    return failedDocumentResult(error, input);
  }
}

async function prepareFocusedReleaseSharePackage''',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/toolExecutor.ts",
    '''function assertPublicOpportunityProvenance(source: Record<string, unknown>) {
  if (!normalizePublicUrl(stringArg(source.sourceUrl))) throw new Error("A public HTTPS source URL is required for opportunity provenance.");
  if (source.publicContact == null) return;
  const contact = record(source.publicContact);
  const sourceUrl = normalizePublicUrl(stringArg(contact.sourceUrl));
  if (!sourceUrl) throw new Error("A public contact must include its source URL.");
  const kind = stringArg(contact.kind);
  const value = stringArg(contact.value);
  const validValue = kind === "email" ? normalizePublicEmail(value) : normalizePublicUrl(value);
  if (!validValue || !stringArg(contact.verifiedAt)) throw new Error("A public contact must be verifiable from its cited source.");
}
''',
    '''function assertPublicOpportunityProvenance(source: Record<string, unknown>) {
  if (!normalizePublicUrl(stringArg(source.sourceUrl))) throw new OpportunityCandidateError("A public HTTPS source URL is required for opportunity provenance.");
  if (source.publicContact == null) return;
  const contact = record(source.publicContact);
  const sourceUrl = normalizePublicUrl(stringArg(contact.sourceUrl));
  if (!sourceUrl) throw new OpportunityCandidateError("A public contact must include its source URL.");
  const kind = stringArg(contact.kind);
  const value = stringArg(contact.value);
  const validValue = kind === "email" ? normalizePublicEmail(value) : normalizePublicUrl(value);
  if (!validValue || !stringArg(contact.verifiedAt)) throw new OpportunityCandidateError("A public contact must be verifiable from its cited source.");
}
''',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/toolExecutor.ts",
    '''class OpportunityCandidateError extends Error {}

async function failedOpportunityResult(error: unknown, input: ManagerToolInput, stage: "opportunity_search" | "contact_verification" | "opportunity_persistence", publicMessage: string) {
  const errorEventId = await captureAppError(error, {
''',
    '''class OpportunityCandidateError extends Error {}

async function failedDocumentResult(error: unknown, input: ManagerToolInput) {
  const message = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : typeof error === "string" && error.trim()
      ? error.trim()
      : "Song document creation failed.";

  if (/document quality gate failed/i.test(message)) {
    return {
      status: "invalid_draft",
      stage: "document_validation",
      retryable: false,
      reason: message,
    };
  }

  const errorEventId = await captureAppError(error, {
    functionName: "manager-conversation-tool-executor",
    operation: "song_document_workflow",
    source: "edge",
    publicMessage: "The song document could not be saved.",
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    refs: {
      conversation_id: input.conversationId,
      manager_run_id: input.runId,
      music_item_id: input.musicSubject?.type === "music_item" ? input.musicSubject.id : null,
      stage: "document_persistence",
    },
  });
  return { status: "failed", stage: "document_persistence", retryable: true, reference: errorEventId ?? undefined };
}

async function failedOpportunityResult(error: unknown, input: ManagerToolInput, stage: "opportunity_search" | "contact_verification" | "opportunity_persistence", publicMessage: string) {
  const message = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : typeof error === "string" && error.trim()
      ? error.trim()
      : publicMessage;
  if (stage === "contact_verification") {
    return { status: "rejected", stage, retryable: false, reason: message };
  }

  const errorEventId = await captureAppError(error, {
''',
)

# 4) Provider context is bounded and 429 messaging is truthful.
replace_once(
    "supabase/functions/_shared/manager-conversation/context.ts",
    'const MAX_OPENING_BRIEF_BYTES = 80_000;\n',
    'const MAX_OPENING_BRIEF_BYTES = 48_000;\n',
)

replace_once(
    "supabase/functions/_shared/manager-conversation/context.ts",
    '''    if (/request too large|tokens per min|token limit|context length|context window|too many tokens/.test(normalized)) {
''',
    '''    if (/request too large|context length|context window|maximum context|too many tokens/.test(normalized)) {
''',
)

# 5) Stop chaining opaque provider history when the bounded opening brief already carries
# recent conversation + source-of-truth workspace state.
for index_path in [
    "supabase/functions/manager-conversation/index.ts",
    "supabase/functions/manager-conversation-stream/index.ts",
]:
    replace_once(
        index_path,
        '''    const previousResponseId = await loadPreviousOpenAIResponseId(db, input, conversationId);
''',
        '''    // Each turn is intentionally grounded from the bounded source-of-truth opening
    // brief. Do not chain opaque provider history on top of that packet: it duplicates
    // context, grows token usage across turns and caused production TPM failures.
    const previousResponseId = "";
''',
    )

# 6) Never pass a client-only temporary conversation identifier into UUID columns.
for index_path in [
    "supabase/functions/manager-conversation/index.ts",
    "supabase/functions/manager-conversation-stream/index.ts",
]:
    replace_once(
        index_path,
        '''function validateInput(input: ManagerConversationInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId) throw new Error("Manager conversation workspace input is incomplete.");
  if (!input.body || !input.body.trim()) throw new Error("Manager conversation requires a directive or question.");
  input.musicSubject = parseMusicConversationSubject(input.musicSubject) ?? undefined;
}
''',
        '''const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateInput(input: ManagerConversationInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId) throw new Error("Manager conversation workspace input is incomplete.");
  if (!input.body || !input.body.trim()) throw new Error("Manager conversation requires a directive or question.");
  if (input.conversationId && !UUID_PATTERN.test(input.conversationId)) {
    if (/^pending-conversation-\\d+$/i.test(input.conversationId)) input.conversationId = undefined;
    else throw new Error("Manager conversation ID is invalid.");
  }
  input.musicSubject = parseMusicConversationSubject(input.musicSubject) ?? undefined;
}
''',
    )

# 7) Make streaming emit/close idempotent so client cancellation cannot turn a completed
# run into "controller cannot close or enqueue".
replace_once(
    "supabase/functions/manager-conversation-stream/index.ts",
    '''  const encoder = new TextEncoder();
  let eventIndex = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => {
        eventIndex += 1;
        controller.enqueue(encoder.encode(`id: ${eventIndex}\\ndata: ${JSON.stringify(event)}\\n\\n`));
      };
''',
    '''  const encoder = new TextEncoder();
  let eventIndex = 0;
  let streamClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => {
        if (streamClosed) return;
        try {
          eventIndex += 1;
          controller.enqueue(encoder.encode(`id: ${eventIndex}\\ndata: ${JSON.stringify(event)}\\n\\n`));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error ?? "");
          if (error instanceof TypeError && /close|enqueue|state|controller/i.test(message)) {
            streamClosed = true;
            return;
          }
          throw error;
        }
      };
''',
)

replace_once(
    "supabase/functions/manager-conversation-stream/index.ts",
    '''      } finally {
        controller.close();
      }
    },
  });
''',
    '''      } finally {
        if (!streamClosed) {
          streamClosed = true;
          try {
            controller.close();
          } catch {
            // The browser may have cancelled the SSE connection after the run already
            // committed. Closing twice is transport noise, not a failed Manager run.
          }
        }
      }
    },
    cancel() {
      streamClosed = true;
    },
  });
''',
)

# 8) Regression tests.
Path("src/song-document-quality-gate.test.ts").write_text('''import { describe, expect, it, vi } from "vitest";
import { persistFocusedSongDocumentDraft } from "../supabase/functions/_shared/songDocumentDraft";

describe("song document quality gate", () => {
  it("rejects plain-text recipient collateral before any persistence write", async () => {
    const rpc = vi.fn();

    await expect(persistFocusedSongDocumentDraft(
      { rpc },
      {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        body: "Create the press pitch for this song.",
        musicSubject: { type: "music_item", id: "song-1" },
        documentType: "press_pitch",
        title: "After Midnight press pitch",
      },
      "run-1",
      "A concise song-specific press pitch draft.",
      false,
    )).rejects.toThrow(/structured JSON artifact/i);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("persists a structurally valid sparse EPK as needs-review instead of pretending persistence failed", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        documentId: "document-1",
        versionId: "version-1",
        musicItemId: "song-1",
        documentType: "epk",
        title: "Oleku EPK",
        status: "draft",
        created: true,
      },
      error: null,
    }));
    const sparseEpk = JSON.stringify({
      purpose: "Prepare a factual review draft for future press use.",
      audience: "Music press and editorial teams.",
      coreNarrative: "Oleku is a developing catalog record and this draft intentionally uses only verified workspace facts while the artist team supplies the missing creative and contact material.",
      sections: [
        {
          key: "proof",
          title: "Proof",
          content: "Current workspace evidence can support a limited factual performance snapshot, but it does not prove fan conversion, editorial support, campaign ROI, or breakout momentum.",
          evidenceRefs: ["workspace:song-1"],
        },
        {
          key: "contact",
          title: "Contact",
          content: "No approved public press contact is currently stored for this record, so the review draft does not invent one.",
          evidenceRefs: [],
        },
      ],
      claims: [{
        text: "The workspace contains a limited performance snapshot for this song.",
        basis: "workspace",
        sourceRef: "workspace:song-1",
        confidence: "high",
      }],
      missingInputs: [
        "Artist snapshot and approved biography",
        "Release story and song story",
        "Why now",
        "Sound and context",
        "Press angles",
        "Assets and links",
        "Approved press contact",
      ],
    });

    const result = await persistFocusedSongDocumentDraft(
      { rpc },
      {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        body: "Create EPK for this record.",
        musicSubject: { type: "music_item", id: "song-1" },
        documentType: "epk",
        title: "Oleku EPK",
      },
      "run-1",
      sparseEpk,
      false,
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "draft",
      documentType: "epk",
      quality: expect.objectContaining({ readiness: "needs_review" }),
    });
    expect(result?.quality?.blockers.length).toBeGreaterThan(0);
  });
});
''')

Path("src/manager-agent-resilience.test.ts").write_text('''import { describe, expect, it, vi } from "vitest";
import { runManagerAgentLoop } from "../supabase/functions/_shared/manager-conversation/agentLoop";

const schema = { name: "manager_test", schema: { type: "object" } };

function functionCall(callId: string, name: string, args: Record<string, unknown>) {
  return new Response(JSON.stringify({
    id: `response-${callId}`,
    output: [{ type: "function_call", call_id: callId, name, arguments: JSON.stringify(args) }],
    usage: {},
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function finalResponse() {
  return new Response(JSON.stringify({
    id: "response-final",
    output_text: "done",
    usage: {},
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Manager agent production resilience", () => {
  it("suppresses an identical mutation repeated by the model in the same turn", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(functionCall("call-1", "create_focused_song_document", {
        documentType: "epk",
        title: "Oleku EPK",
        body: "{}",
        opportunityId: null,
      }))
      .mockResolvedValueOnce(functionCall("call-2", "create_focused_song_document", {
        documentType: "epk",
        title: "Oleku EPK",
        body: "{}",
        opportunityId: null,
      }))
      .mockResolvedValueOnce(finalResponse());
    const executeTool = vi.fn(async () => ({ status: "drafted" }));

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "test",
      context: { test: true },
      tools: [],
      jsonSchema: schema,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool,
      maxToolCalls: 4,
    });

    expect(result.outputText).toBe("done");
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result.toolTrace.some((item) => item.summary.includes("Duplicate write suppressed"))).toBe(true);
  });

  it("retries a temporary 429 using Retry-After instead of immediately failing the Manager turn", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: "Rate limit reached. Please try again in 0s." },
      }), { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(finalResponse());

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "test",
      context: { test: true },
      tools: [],
      jsonSchema: schema,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: vi.fn(),
    });

    expect(result.outputText).toBe("done");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
''')

Path("src/manager-production-stabilization-contract.test.ts").write_text('''import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Manager production stabilization contracts", () => {
  it("defends both Manager endpoints from client-only pending conversation ids and provider-history growth", () => {
    for (const path of [
      "supabase/functions/manager-conversation/index.ts",
      "supabase/functions/manager-conversation-stream/index.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("pending-conversation-");
      expect(source).toContain('const previousResponseId = "";');
    }
  });

  it("guards streaming close/enqueue after browser cancellation", () => {
    const source = readFileSync("supabase/functions/manager-conversation-stream/index.ts", "utf8");
    expect(source).toContain("let streamClosed = false");
    expect(source).toContain("cancel()");
    expect(source).not.toContain("finally {\\n        controller.close();");
  });
});
''')

print("Manager stabilization patch applied.")
