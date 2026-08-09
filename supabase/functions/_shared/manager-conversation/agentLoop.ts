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
    description: "Read the exact attached song or project packet, including its existing metadata, assets, credits, identifiers, and rights readiness. Use only when a song or project is attached to this conversation.",
    strict: true,
    parameters: focusedMusicReadProperties,
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

export function buildManagerAgentRequest(input: ManagerAgentRequestInput) {
  return buildManagerAgentRequestBody(input, JSON.stringify(input.context), input.previousResponseId);
}

function buildManagerAgentRequestBody(
  input: ManagerAgentRequestInput,
  requestInput: unknown,
  previousResponseId?: string,
) {
  return {
    model: input.model,
    instructions: input.instructions,
    input: requestInput,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    store: true,
    tools: input.tools,
    tool_choice: "auto",
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

async function postResponses(fetchImpl: typeof fetch, endpoint: string, apiKey: string, body: Record<string, unknown>) {
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
        : ` with ${evidenceCount} supporting signal${evidenceCount === 1 ? "" : "s"}`;
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
    : ` with ${evidenceCount} supporting signal${evidenceCount === 1 ? "" : "s"}`;
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
