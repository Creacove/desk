type JsonSchemaFormat = {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

type ManagerAgentRequestInput = {
  model: string;
  instructions: string;
  context: unknown;
  tools: ManagerAgentToolDefinition[];
  jsonSchema: JsonSchemaFormat;
  previousResponseId?: string;
  parallelToolCalls?: boolean;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  maxOutputTokens?: number;
  contextManagement?: Array<{ type: "compaction"; compact_threshold: number }>;
  promptCacheKey?: string;
  promptCacheMode?: "implicit" | "explicit";
  initialToolChoice?: string;
};

type ManagerAgentLoopInput = ManagerAgentRequestInput & {
  endpoint: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  maxToolCalls?: number;
  executeTool: (name: string, args: Record<string, unknown>, call: { callId: string }) => Promise<unknown>;
  onToolEvent?: (event: ManagerAgentToolTrace) => void | Promise<void>;
  beforeModelRequest?: () => void | Promise<void>;
  afterModelRequest?: () => void | Promise<void>;
};

type ManagerAgentLoopResult = {
  outputText: string;
  responseId: string;
  usage: Record<string, unknown>;
  toolTrace: ManagerAgentToolTrace[];
};

export type ManagerAgentToolTrace = {
  tool: string;
  callId: string;
  status: "started" | "completed" | "failed";
  summary: string;
};

export type ManagerAgentToolDefinition =
  | { type: "web_search" }
  | {
      type: "function";
      name: string;
      description: string;
      strict: boolean;
      parameters: Record<string, unknown>;
    };

type FunctionCall = {
  callId: string;
  name: string;
  args: Record<string, unknown>;
};

const textProperties = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string" },
    category: { type: "string" },
    subjectType: { type: "string" },
    subjectId: { type: "string" },
    status: { type: "string" },
    outputType: { type: "string" },
    limit: { type: "number" },
    includeTasks: { type: "boolean" },
    includeCheckpoints: { type: "boolean" },
    itemType: { type: "string" },
    lifecycleStage: { type: "string" },
    scope: { type: "string" },
  },
};

const managerOutputSectionProperties = {
  type: "object",
  additionalProperties: false,
  required: ["outputId", "query", "maxChars"],
  properties: {
    outputId: { type: "string" },
    query: { type: "string" },
    maxChars: { type: "number" },
  },
};

const focusedMusicReadProperties = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const focusedReleaseSuccessProperties = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const focusedReleaseDateProposalProperties = {
  type: "object",
  additionalProperties: false,
  required: ["proposedDate", "reason"],
  properties: {
    proposedDate: { type: "string" },
    reason: { type: "string" },
  },
};

const focusedReleaseOpportunityQueryProperties = {
  type: "object",
  additionalProperties: false,
  required: ["opportunityType"],
  properties: {
    opportunityType: { type: "string", enum: ["playlist", "press"] },
  },
};

const focusedReleaseOpportunitySaveProperties = {
  type: "object",
  additionalProperties: false,
  required: ["opportunityType", "candidates"],
  properties: {
    opportunityType: { type: "string", enum: ["playlist", "press"] },
    candidates: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "opportunityType",
          "platform",
          "targetName",
          "sourceUrl",
          "targetUrl",
          "publicOrganization",
          "publicContact",
          "fit",
          "sourceEvidence",
          "confidence",
          "limitations",
          "paidPlacementClaim",
          "requirements",
        ],
        properties: {
          opportunityType: { type: "string", enum: ["playlist", "press"] },
          platform: { type: ["string", "null"] },
          targetName: { type: "string" },
          sourceUrl: { type: "string" },
          targetUrl: { type: ["string", "null"] },
          publicOrganization: { type: ["string", "null"] },
          publicContact: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["kind", "value", "sourceUrl", "verifiedAt"],
            properties: {
              kind: { type: "string", enum: ["email", "submission_form", "contact_page"] },
              value: { type: "string" },
              sourceUrl: { type: "string" },
              verifiedAt: { type: ["string", "null"] },
            },
          },
          fit: {
            type: "object",
            additionalProperties: false,
            required: ["songCriteria", "targetCriteria", "explanation", "recency", "market"],
            properties: {
              songCriteria: { type: "array", items: { type: "string" } },
              targetCriteria: { type: "array", items: { type: "string" } },
              explanation: { type: "string" },
              recency: { type: ["string", "null"] },
              market: { type: ["string", "null"] },
            },
          },
          sourceEvidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["source", "ref", "observedAt"],
              properties: {
                source: { type: "string" },
                ref: { type: ["string", "null"] },
                observedAt: { type: ["string", "null"] },
              },
            },
          },
          confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] },
          limitations: { type: "array", items: { type: "string" } },
          paidPlacementClaim: { type: "boolean" },
          requirements: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const focusedReleaseOpportunityOutcomeProperties = {
  type: "object",
  additionalProperties: false,
  required: ["opportunityId", "status", "manualOutcome"],
  properties: {
    opportunityId: { type: "string" },
    status: { type: "string", enum: ["watch", "shortlisted", "approved", "submitted_manually", "replied", "accepted", "declined", "skipped"] },
    manualOutcome: { type: "string" },
  },
};

// The body remains a string to keep the existing tool API stable, but it is now a
// JSON-encoded structured artifact. The server parses it, renders the readable body,
// scores it against document-specific standards and refuses weak artifacts.
const focusedSongDocumentProperties = {
  type: "object",
  additionalProperties: false,
  required: ["documentType", "title", "body", "opportunityId"],
  properties: {
    documentType: { type: "string", enum: ["epk", "spotify_editorial_pitch", "playlist_pitch", "press_target_brief", "press_pitch", "content_plan", "release_calendar", "press_release", "press_angle", "artist_biography", "one_sheet", "lyrics", "credits", "distributor_notes"] },
    title: { type: "string" },
    body: {
      type: "string",
      description: "JSON string only. Encode an object with purpose, audience, coreNarrative, sections[{key,title,content,evidenceRefs[]}], claims[{text,basis,sourceRef,confidence}], and missingInputs[]. Do not send markdown or generic prose here. Unknown facts belong in missingInputs, never placeholders. To create the internal Release Narrative, use documentType press_angle, title exactly Release narrative, and sections positioning, story, audience, campaign_thesis, proof, creative_world, and language_guardrails.",
    },
    opportunityId: { type: ["string", "null"] },
  },
};

const focusedReleaseSharePackageProperties = {
  type: "object",
  additionalProperties: false,
  required: ["preset", "opportunityId", "label"],
  properties: {
    preset: { type: "string", enum: ["listen", "epk_press", "delivery", "custom"] },
    opportunityId: { type: ["string", "null"] },
    label: { type: ["string", "null"] },
  },
};

const focusedMusicMetadataProperties = {
  type: "object",
  additionalProperties: false,
  required: ["group", "label", "value"],
  properties: {
    group: { type: "string" },
    label: { type: "string" },
    value: { type: "string" },
  },
};

const focusedMusicLifecycleProperties = {
  type: "object",
  additionalProperties: false,
  required: ["lifecycleStage"],
  properties: {
    lifecycleStage: { type: "string", enum: ["idea", "recording", "production", "mixing", "mastering", "ready", "scheduled"] },
  },
};

const ensureSongReleaseWorkspaceProperties = {
  type: "object",
  additionalProperties: false,
  required: ["title", "lifecycleStage"],
  properties: {
    title: { type: "string" },
    lifecycleStage: { type: "string", enum: ["idea", "recording", "production", "mixing", "mastering", "ready", "scheduled"] },
  },
};

export const managerConversationTools: ManagerAgentToolDefinition[] = [
  { type: "web_search" },
  {
    type: "function",
    name: "query_evidence_items",
    description: "Read scoped evidence items when the Manager needs specific metrics, conversion proof, source limits, or signal support.",
    strict: false,
    parameters: textProperties,
  },
  {
    type: "function",
    name: "query_active_missions",
    description: "Read active mission, checkpoint, and task state before creating or updating operating work.",
    strict: false,
    parameters: textProperties,
  },
  {
    type: "function",
    name: "query_music_catalog",
    description: "Search the artist catalog, songs, projects, lifecycle states, source limits, and metadata.",
    strict: false,
    parameters: textProperties,
  },
  {
    type: "function",
    name: "query_durable_memory",
    description: "Read durable strategic memory, constraints, prior user preferences, and previous manager facts.",
    strict: false,
    parameters: textProperties,
  },
  {
    type: "function",
    name: "query_manager_outputs",
    description: "List metadata for prior Manager outputs such as decision packages, briefs, reviews, and song or project reads. Use the section reader only when document text is necessary.",
    strict: false,
    parameters: textProperties,
  },
  {
    type: "function",
    name: "read_manager_output_section",
    description: "Read one bounded text section from a prior Manager output after identifying it with query_manager_outputs.",
    strict: true,
    parameters: managerOutputSectionProperties,
  },
  {
    type: "function",
    name: "read_focused_music_subject",
    description: "Read the exact attached song or project packet, including its existing metadata, assets, credits, identifiers, rights readiness, and current canonical documents. Use only when a song or project is attached to this conversation.",
    strict: true,
    parameters: focusedMusicReadProperties,
  },
  {
    type: "function",
    name: "read_focused_release_success",
    description: "Read the exact attached unreleased song's release-success packet, linked mission schedule, evidence-backed gates, canonical documents, and opportunity counts.",
    strict: true,
    parameters: focusedReleaseSuccessProperties,
  },
  {
    type: "function",
    name: "propose_focused_release_date_change",
    description: "Prepare a deterministic release-date impact preview and permission request for the exact attached unreleased song. This never applies the date change; approval stays with the user.",
    strict: true,
    parameters: focusedReleaseDateProposalProperties,
  },
  {
    type: "function",
    name: "query_focused_release_opportunities",
    description: "Read the exact attached song, its scoped evidence, and existing playlist or press opportunities before public web research. Use only for the attached song.",
    strict: true,
    parameters: focusedReleaseOpportunityQueryProperties,
  },
  {
    type: "function",
    name: "save_focused_release_opportunities",
    description: "Save a normalized, source-backed playlist or press shortlist for the exact attached song. This stores preparation and public provenance only; it never sends or submits anything.",
    strict: true,
    parameters: focusedReleaseOpportunitySaveProperties,
  },
  {
    type: "function",
    name: "record_focused_release_opportunity_outcome",
    description: "Record a manual outcome for one saved playlist or press target on the exact attached song. The artist still performs any submission or outreach.",
    strict: true,
    parameters: focusedReleaseOpportunityOutcomeProperties,
  },
  {
    type: "function",
    name: "create_focused_song_document",
    description: "Create or version one premium canonical song artifact in Files. Before any recipient-facing campaign artifact, establish one internal Release Narrative by calling this tool with documentType press_angle and title exactly Release narrative; use the release-narrative section set described in the body schema. The body MUST be the JSON-encoded structured artifact described by the schema. The server persists structurally valid drafts even when verified inputs are missing and marks them needs_review; missing facts belong in missingInputs and must never be invented or padded. Retry only when the transport itself is invalid, never merely to improve a quality score. Never send or publish the document.",
    strict: true,
    parameters: focusedSongDocumentProperties,
  },
  {
  type: "function",
  name: "prepare_focused_release_share_package",
  description: "Prepare a frozen, revocable private package for the exact attached song from approved canonical Files content. Optionally bind it to one saved release opportunity. This only prepares a reviewable link; it never emails, submits, posts, spends, or contacts anyone.",
  strict: true,
  parameters: focusedReleaseSharePackageProperties,
},
  {
    type: "function",
    name: "read_focused_release_readiness",
    description: "Read a deterministic release readiness view for the exact attached song or project. It reports pre-release gaps only before release; released/catalog music returns post-release priorities and never reopens master, split, or delivery gates.",
    strict: true,
    parameters: focusedMusicReadProperties,
  },
  {
    type: "function",
    name: "refresh_focused_music_intelligence",
    description: "Refresh connected Chartmetric intelligence for the exact attached song or project, using its saved Spotify or ISRC identity. Use this before asking the artist for public performance data. If the provider cannot resolve it, continue with saved evidence and web search.",
    strict: true,
    parameters: focusedMusicReadProperties,
  },
  {
    type: "function",
    name: "update_focused_music_metadata",
    description: "Save one verified metadata field on the exact song or project attached to this conversation. This uses the same editable Details data that the user can correct in the app. Never invent values; ask if the value is not known.",
    strict: true,
    parameters: focusedMusicMetadataProperties,
  },
  {
    type: "function",
    name: "update_focused_music_lifecycle",
    description: "Move the exact attached unreleased song or project to a verified internal production stage. Do not mark music released, catalogued, or archived; those require an explicit release handoff or a user action.",
    strict: true,
    parameters: focusedMusicLifecycleProperties,
  },
  {
    type: "function",
    name: "ensure_song_release_workspace",
    description: "Create or safely resume the complete Song Workspace in this Manager conversation after the user has clearly named a new song and its current unreleased stage. This atomically creates the song, its dedicated release mission, initial package task, and all links. Never use it for an already attached song or project.",
    strict: true,
    parameters: ensureSongReleaseWorkspaceProperties,
  },
];

const releaseTurnToolNames = new Set([
  "read_focused_release_success",
  "propose_focused_release_date_change",
  "query_focused_release_opportunities",
  "save_focused_release_opportunities",
  "record_focused_release_opportunity_outcome",
  "create_focused_song_document",
  "prepare_focused_release_share_package",
]);

export function managerConversationRequiresCanonicalDocumentTool(input: {
  body: string;
  contextAnswers?: Array<{ questionKey: string; answer: string }>;
}) {
  const body = input.body.trim().toLowerCase();
  const directDocumentIntent = /\b(draft|write|prepare|create|make|build|revise|refresh|update|finish|complete)\b/.test(body)
    && /\b(release kit|campaign kit|release narrative|campaign narrative|campaign spine|epk|press kit|pitch|content plan|release calendar|press release|press angle|biography|bio|one[- ]sheet|lyrics|credits|distributor notes|documents?)\b/.test(body);
  const contextDocumentIntent = (input.contextAnswers ?? []).some((answer) =>
    /(?:epk|press|bio|biography|one[-_ ]sheet|release[_ -]?(?:narrative|angle)|campaign|document|kit|copy|content|core[_ -]?angle)/i.test(answer.questionKey)
  );
  return directDocumentIntent || contextDocumentIntent;
}

export function selectManagerConversationToolsForTurn(input: {
  body: string;
  contextAnswers?: Array<{ questionKey: string; answer: string }>;
  hasAttachedUnreleasedSong: boolean;
}): ManagerAgentToolDefinition[] {
  const allowed = new Set<string>();
  const body = input.body.trim().toLowerCase();
  const contextAnswerText = (input.contextAnswers ?? [])
    .map((answer) => `${answer.questionKey} ${answer.answer}`)
    .join(" ")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  const intentText = `${body} ${contextAnswerText}`;
  const servicingIntent = /\b(playlist(?:ing)?|playlist opportunities?|curator|press|publicity|editorial|media|outreach|record servicing|service this (?:song|release)|pitch(?:ing)?(?:\s+(?:this|the))?\s+(?:song|release|record))\b/.test(intentText);
  const documentIntent = managerConversationRequiresCanonicalDocumentTool({
    body: input.body,
    contextAnswers: input.contextAnswers,
  });
  const packageIntent = /\b(prepare|build|create|make|assemble)\b/.test(body)
  && /\b(package|share link|private link|delivery link|press kit|epk package)\b/.test(body);
  const outcomeIntent = /\b(submitted|replied|accepted|declined|outcome|response from|heard back)\b/.test(body);

  if (servicingIntent) {
    allowed.add("query_focused_release_opportunities");
    allowed.add("save_focused_release_opportunities");
    allowed.add("create_focused_song_document");
  }
  if (documentIntent) allowed.add("create_focused_song_document");
  if (packageIntent) allowed.add("prepare_focused_release_share_package");
  if (outcomeIntent) allowed.add("record_focused_release_opportunity_outcome");

  if (input.hasAttachedUnreleasedSong) {
    const releaseManagementIntent = /\b(release date|release readiness|readiness|ready to release|ready for release|release (?:this|the) (?:song|record)|move (?:the )?release|delay (?:the )?release|postpone|reschedule|release plan|plan this release|launch date)\b/.test(intentText);
    if (releaseManagementIntent) {
      allowed.add("read_focused_release_success");
      allowed.add("propose_focused_release_date_change");
    }
  }

  return managerConversationTools.filter((tool) => tool.type !== "function"
    || !releaseTurnToolNames.has(tool.name)
    || allowed.has(tool.name));
}

export function buildManagerAgentRequest(input: ManagerAgentRequestInput) {
  return buildManagerAgentRequestBody(input, JSON.stringify(input.context), input.previousResponseId, true);
}

function buildManagerAgentRequestBody(
  input: ManagerAgentRequestInput,
  requestInput: unknown,
  previousResponseId?: string,
  initialRequest = false,
) {
  return {
    model: input.model,
    instructions: input.instructions,
    input: requestInput,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    store: true,
    tools: input.tools,
    tool_choice: initialRequest && input.initialToolChoice ? { type: "function", name: input.initialToolChoice } : "auto",
    parallel_tool_calls: input.parallelToolCalls ?? false,
    ...(input.reasoningEffort ? { reasoning: { effort: input.reasoningEffort } } : {}),
    ...(input.maxOutputTokens ? { max_output_tokens: input.maxOutputTokens } : {}),
    ...(input.contextManagement?.length ? { context_management: input.contextManagement } : {}),
    ...(input.promptCacheKey ? { prompt_cache_key: input.promptCacheKey } : {}),
    ...(input.promptCacheMode ? { prompt_cache_options: { mode: input.promptCacheMode } } : {}),
    text: { format: { type: "json_schema", ...input.jsonSchema } },
  };
}

export async function runManagerAgentLoop(input: ManagerAgentLoopInput): Promise<ManagerAgentLoopResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const toolTrace: ManagerAgentToolTrace[] = [];
  const usageTotals: Record<string, unknown> = {};
  let requestBody: Record<string, unknown> = buildManagerAgentRequest(input);
  let responseId = "";
  let toolCallsUsed = 0;
  const attemptedMutationSignatures = new Set<string>();

  for (let iteration = 0; iteration <= (input.maxToolCalls ?? 8); iteration += 1) {
    await input.beforeModelRequest?.();
    const payload = await postResponses(fetchImpl, input.endpoint, input.apiKey, requestBody);
    await input.afterModelRequest?.();
    responseId = typeof payload.id === "string" ? payload.id : responseId;
    addUsage(usageTotals, payload.usage);

    const outputText = readOutputText(payload);
    if (outputText) {
      return { outputText, responseId, usage: usageTotals, toolTrace };
    }

    const calls = extractFunctionCalls(payload);
    if (!calls.length) {
      throw new Error("Manager agent response did not include final output text or executable tool calls.");
    }

    if (toolCallsUsed + calls.length > (input.maxToolCalls ?? 8)) {
      throw new Error("Manager agent exceeded the local tool-call limit.");
    }
    toolCallsUsed += calls.length;

    const executeCall = async (call: FunctionCall) => {
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
        tool: call.name,
        callId: call.callId,
        status: "started" as const,
        summary: safeToolSummary(call.name, call.args),
      };
      await input.onToolEvent?.(publicToolEvent(started));

      try {
        const result = await input.executeTool(call.name, call.args, { callId: call.callId });
        const completed = {
          tool: call.name,
          callId: call.callId,
          status: "completed" as const,
          summary: summarizeToolResult(call.name, result),
        };
        toolTrace.push(completed);
        await input.onToolEvent?.(publicToolEvent(completed));
        return { type: "function_call_output", call_id: call.callId, output: serializeToolOutput(result) };
      } catch (error) {
        const failed = {
          tool: call.name,
          callId: call.callId,
          status: "failed" as const,
          summary: readErrorMessage(error),
        };
        toolTrace.push(failed);
        await input.onToolEvent?.(publicToolEvent(failed));
        return { type: "function_call_output", call_id: call.callId, output: JSON.stringify({ error: failed.summary }) };
      }
    };
    const outputs = input.parallelToolCalls
      ? await Promise.all(calls.map(executeCall))
      : await executeSequentially(calls, executeCall);

    requestBody = buildManagerAgentRequestBody(input, outputs, responseId);
  }

  throw new Error("Manager agent did not finish within the configured loop limit.");
}

const MAX_TOOL_OUTPUT_CHARS = 12_000;

function serializeToolOutput(value: unknown) {
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = JSON.stringify({ error: "Tool returned an unreadable result." });
  }
  if (!serialized) serialized = JSON.stringify({});
  if (serialized.length <= MAX_TOOL_OUTPUT_CHARS) return serialized;
  return JSON.stringify({ truncated: true, excerpt: serialized.slice(0, MAX_TOOL_OUTPUT_CHARS) });
}

const MANAGER_MUTATION_TOOLS = new Set([
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
  const bodyDelay = errorBody.match(/try again in\s+([\d.]+)s/i);
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
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output
    .filter(isRecord)
    .filter((item) => item.type === "function_call")
    .map((item) => ({
      callId: typeof item.call_id === "string" ? item.call_id : "",
      name: typeof item.name === "string" ? item.name : "",
      args: parseArgs(item.arguments),
    }))
    .filter((item) => item.callId && item.name);
}

function readOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output.filter(isRecord)) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const contentItem of content.filter(isRecord)) {
      if (typeof contentItem.text === "string" && contentItem.text.trim()) return contentItem.text;
    }
  }
  return "";
}

function parseArgs(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function addUsage(target: Record<string, unknown>, value: unknown) {
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "number" || !Number.isFinite(item)) continue;
    const current = typeof target[key] === "number" ? target[key] as number : 0;
    target[key] = current + item;
  }
}

function safeToolSummary(name: string, args: Record<string, unknown>) {
  const query = typeof args.query === "string" && args.query.trim() ? ` for "${args.query.trim().slice(0, 80)}"` : "";
  if (name === "chartmetric_artist_enrich") return "Enriching the artist profile.";
  if (name === "chartmetric_track_enrich") return "Enriching a focus track.";
  if (name === "chartmetric_project_enrich") return "Enriching a focus project.";
  if (name === "save_public_evidence") return "Saving a public context signal.";
  if (name === "write_strategic_memory") return "Saving Manager memory.";
  if (name === "query_evidence_items") return `Checking evidence${query}.`;
  if (name === "query_active_missions") return "Reviewing active mission state.";
  if (name === "query_music_catalog") return `Checking catalog${query}.`;
  if (name === "query_durable_memory") return "Reading durable Manager memory.";
  if (name === "query_manager_outputs") return "Reviewing prior Manager outputs.";
  if (name === "read_manager_output_section") return "Reading the relevant Manager document section.";
  if (name === "query_focused_release_opportunities") return "Checking saved playlist and press targets.";
  if (name === "save_focused_release_opportunities") return "Saving verified release opportunities.";
  if (name === "create_focused_song_document") return "Building and quality-checking a campaign document.";
  if (name === "prepare_focused_release_share_package") return "Preparing a private release package.";
  if (name === "record_focused_release_opportunity_outcome") return "Recording the opportunity outcome.";
  return "Manager is checking the workspace.";
}

async function executeSequentially<T, R>(items: T[], execute: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (const item of items) results.push(await execute(item));
  return results;
}

function publicToolEvent(event: ManagerAgentToolTrace): ManagerAgentToolTrace {
  return {
    ...event,
    tool: publicToolName(event.tool),
  };
}

function publicToolName(name: string) {
  if (name === "chartmetric_artist_enrich") return "artist-intelligence";
  if (name === "chartmetric_track_enrich") return "music-intelligence";
  if (name === "chartmetric_project_enrich") return "project-intelligence";
  if (name === "save_public_evidence") return "public-context";
  if (name === "write_strategic_memory") return "manager-memory";
  return name;
}

function summarizeToolResult(name: string, value: unknown) {
  if (isRecord(value)) {
    const status = typeof value.status === "string" && value.status.trim() ? value.status.trim() : "";
    const evidenceCount = typeof value.evidenceCount === "number" && Number.isFinite(value.evidenceCount)
      ? value.evidenceCount
      : Array.isArray(value.evidence)
        ? value.evidence.length
        : null;
    const snapshotId = typeof value.snapshotId === "string" && value.snapshotId.trim() ? value.snapshotId.trim() : "";
    const memoryId = typeof value.memoryId === "string" && value.memoryId.trim() ? value.memoryId.trim() : "";
    const evidenceId = typeof value.evidenceId === "string" && value.evidenceId.trim() ? value.evidenceId.trim() : "";
    const discoverySummary = summarizeDiscoveryToolResult(name, status, evidenceCount);
    if (discoverySummary) return discoverySummary;
    if (memoryId) return "Saved a Manager memory.";
    if (evidenceId) return "Saved a public context signal.";
    if (status || evidenceCount !== null || snapshotId || memoryId || evidenceId) {
      const normalizedStatus = status || "completed";
      const suffix = evidenceCount === null
        ? ""
        : ` with ${evidenceCount} saved evidence item${evidenceCount === 1 ? "" : "s"}`;
      return `Manager tool ${normalizedStatus}${suffix}.`;
    }
  }
  const count = isRecord(value) && Array.isArray(value.items) ? value.items.length : null;
  const suffix = count == null ? "" : ` Found ${count} scoped item${count === 1 ? "" : "s"}.`;
  return `${safeToolSummary(name, {})}${suffix}`;
}

function summarizeDiscoveryToolResult(name: string, status: string, evidenceCount: number | null) {
  const countText = evidenceCount === null
    ? ""
    : ` with ${evidenceCount} saved evidence item${evidenceCount === 1 ? "" : "s"}`;
  const normalizedStatus = status.toLowerCase();
  if (name === "chartmetric_artist_enrich") {
    if (normalizedStatus === "cached") return `Artist intelligence is already up to date${countText}.`;
    if (normalizedStatus === "unresolved") return "Artist intelligence could not be matched yet.";
    return `Artist intelligence is ready${countText}.`;
  }
  if (name === "chartmetric_track_enrich") {
    if (normalizedStatus === "cached") return `Music intelligence is already up to date${countText}.`;
    if (normalizedStatus === "unresolved") return "Music intelligence could not be matched yet.";
    return `Music intelligence is ready${countText}.`;
  }
  if (name === "chartmetric_project_enrich") {
    if (normalizedStatus === "cached") return `Project intelligence is already up to date${countText}.`;
    if (normalizedStatus === "unresolved") return "Project intelligence could not be matched yet.";
    return `Project intelligence is ready${countText}.`;
  }
  if (name === "save_public_evidence") return "Saved a public context signal.";
  if (name === "write_strategic_memory") return "Saved a Manager memory.";
  return "";
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : "Tool failed.";
  } catch {
    return "Tool failed.";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
