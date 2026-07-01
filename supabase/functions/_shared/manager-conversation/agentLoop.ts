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
};

type ManagerAgentLoopInput = ManagerAgentRequestInput & {
  endpoint: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  maxToolCalls?: number;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  onToolEvent?: (event: ManagerAgentToolTrace) => void;
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
    description: "Read prior Manager outputs such as decision packages, briefs, reviews, and song or project reads.",
    strict: false,
    parameters: textProperties,
  },
];

export function buildManagerAgentRequest(input: ManagerAgentRequestInput) {
  return {
    model: input.model,
    instructions: input.instructions,
    input: JSON.stringify(input.context),
    ...(input.previousResponseId ? { previous_response_id: input.previousResponseId } : {}),
    store: true,
    tools: input.tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
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
    const payload = await postResponses(fetchImpl, input.endpoint, input.apiKey, requestBody);
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

    const outputs = [];
    for (const call of calls) {
      toolCallsUsed += 1;
      if (toolCallsUsed > (input.maxToolCalls ?? 8)) {
        throw new Error("Manager agent exceeded the local tool-call limit.");
      }
      const started = {
        tool: call.name,
        callId: call.callId,
        status: "started" as const,
        summary: safeToolSummary(call.name, call.args),
      };
      input.onToolEvent?.(started);

      try {
        const result = await input.executeTool(call.name, call.args);
        const completed = {
          tool: call.name,
          callId: call.callId,
          status: "completed" as const,
          summary: summarizeToolResult(call.name, result),
        };
        toolTrace.push(completed);
        input.onToolEvent?.(completed);
        outputs.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify(result) });
      } catch (error) {
        const failed = {
          tool: call.name,
          callId: call.callId,
          status: "failed" as const,
          summary: error instanceof Error ? error.message : "Tool failed.",
        };
        toolTrace.push(failed);
        input.onToolEvent?.(failed);
        outputs.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify({ error: failed.summary }) });
      }
    }

    requestBody = {
      model: input.model,
      instructions: input.instructions,
      input: outputs,
      previous_response_id: responseId,
      store: true,
      tools: input.tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      text: { format: { type: "json_schema", ...input.jsonSchema } },
    };
  }

  throw new Error("Manager agent did not finish within the configured loop limit.");
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
  if (name === "query_evidence_items") return `Checking evidence${query}.`;
  if (name === "query_active_missions") return "Reviewing active mission state.";
  if (name === "query_music_catalog") return `Checking catalog${query}.`;
  if (name === "query_durable_memory") return "Reading durable Manager memory.";
  if (name === "query_manager_outputs") return "Reviewing prior Manager outputs.";
  return `Running ${name}.`;
}

function summarizeToolResult(name: string, value: unknown) {
  const count = isRecord(value) && Array.isArray(value.items) ? value.items.length : null;
  const suffix = count == null ? "" : ` Found ${count} scoped item${count === 1 ? "" : "s"}.`;
  return `${safeToolSummary(name, {})}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
