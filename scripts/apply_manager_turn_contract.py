from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str, flags=0) -> str:
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return next_text


# ---------------------------------------------------------------------------
# Shared Manager output contract: server-created artifact metadata is richer
# than model-created compatibility work, and decision packages are explicit.
# ---------------------------------------------------------------------------
path = Path("supabase/functions/_shared/openaiManagerConversationLegacy.ts")
text = path.read_text()
text = replace_once(
    text,
    '''export type ManagerConversationCreatedWork = {\n  type: "music_item" | "mission" | "task";\n  title: string;\n  body: string;\n  id: string;\n  parentMissionId?: string;\n  status?: "created" | "updated" | "approval_required" | "failed" | "pending";\n};''',
    '''export type ManagerConversationCreatedWork = {\n  type: "music_item" | "mission" | "task";\n  title: string;\n  body: string;\n  id: string;\n  parentMissionId?: string;\n  artifactKind?: "task_draft" | "song_document";\n  content?: string;\n  musicItemId?: string;\n  documentType?: string;\n  readiness?: "ready" | "needs_review" | "save_failed";\n  missingInputs?: string[];\n  managerOutputId?: string;\n  presentationRole?: "deliverable" | "internal_support" | "compatibility";\n  visibility?: "user" | "internal";\n  status?: "created" | "updated" | "approval_required" | "failed" | "pending";\n};''',
    "created-work rich type",
)
text = replace_once(
    text,
    '    "Set actionPolicy before any durable write is applied: answer_only for simple conversation; save_memory only when durableMemory is the only write; create_decision_package for a durable recommendation package; create_mission or update_mission for missionGraphDecisions; update_task or review_checkpoint for task/checkpoint state changes; request_permission for external, expensive, legal, financial, public, or reputational actions; request_evidence when missing evidence blocks a specific decision.",',
    '    "Set actionPolicy before any durable write is applied: answer_only for normal advice, planning, reviews, research, troubleshooting, and document creation; save_memory only when durableMemory is the only write; create_decision_package ONLY when the user explicitly asks for a decision package, decision/strategy/management memo or brief, or recommendation package; create_mission or update_mission for missionGraphDecisions; update_task or review_checkpoint for task/checkpoint state changes; request_permission for external, expensive, legal, financial, public, or reputational actions; request_evidence when missing evidence blocks a specific decision.",\n    "Decision packages are optional user-facing decision memos, not the default container for a strong recommendation. Never create one automatically from an EPK, press, playlist, release-readiness, post-release, research, or troubleshooting request. If the artist did not explicitly ask for that durable decision surface, keep the recommendation in chat and use the native artifact/workflow surface instead.",',
    "decision-package prompt policy",
)
text = replace_once(
    text,
    '    "Canonical artifact rule: when the artist asks to draft, create, build, prepare, revise, refresh, update, finish, or complete an EPK, press release, bio, one-sheet, pitch, release/campaign kit, content plan, release calendar, press angle, lyrics, credits, or distributor notes for an attached song, use create_focused_song_document for every requested artifact. Never satisfy an artifact request by placing the full draft only in responseBody.",',
    '    "Canonical artifact rule: when the artist asks to draft, create, build, prepare, revise, refresh, update, finish, or complete an EPK, press release, bio, one-sheet, pitch, release/campaign kit, content plan, release calendar, press angle, lyrics, credits, or distributor notes for an attached song, use create_focused_song_document for every requested artifact. Never satisfy an artifact request by placing the full draft only in responseBody.",\n    "Release Narrative is Manager-internal campaign scaffolding. Ensure one exists only when recipient-facing campaign work needs it and the current narrative is missing or materially stale. It is never a user deliverable, never a second answer to the artist, and must not be described as work the artist asked to open or review.",',
    "internal narrative prompt policy",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Tool description: internal Release Narrative is support, not a deliverable.
# ---------------------------------------------------------------------------
path = Path("supabase/functions/_shared/manager-conversation/agentLoop.ts")
text = path.read_text()
text = replace_once(
    text,
    '    description: "Create or version one premium canonical song artifact in Files. Before any recipient-facing campaign artifact, establish one internal Release Narrative by calling this tool with documentType press_angle and title exactly Release narrative; use the release-narrative section set described in the body schema. The body MUST be the JSON-encoded structured artifact described by the schema. The server persists structurally valid drafts even when verified inputs are missing and marks them needs_review; missing facts belong in missingInputs and must never be invented or padded. Retry only when the transport itself is invalid, never merely to improve a quality score. Never send or publish the document.",',
    '    description: "Create or version one premium canonical song artifact in Files. For recipient-facing campaign work, first ensure a current internal Release Narrative exists; create or materially refresh it only when needed, using documentType press_angle and title exactly Release narrative. The Release Narrative is internal Manager support and is never a user-facing deliverable. The body MUST be the JSON-encoded structured artifact described by the schema. The server persists structurally valid drafts even when verified inputs are missing and marks them needs_review; missing facts belong in missingInputs and must never be invented or padded. Retry only when the transport itself is invalid, never merely to improve a quality score. Never send or publish the document.",',
    "document tool internal support description",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Canonical document tool emits one exact server receipt. Internal support is
# tagged internal so the turn contract can never expose it.
# ---------------------------------------------------------------------------
path = Path("supabase/functions/_shared/manager-conversation/toolExecutor.ts")
text = path.read_text()
old = '''    return { ...persisted, status: "drafted", musicItemId: subject.id, documentType, title, ...(opportunityId ? { opportunityId } : {}) };'''
new = '''    const canonicalDocumentType = persisted?.documentType || documentType;\n    const canonicalTitle = persisted?.title || title;\n    if (persisted?.documentId) {\n      const internalSupport = canonicalDocumentType === "release_narrative" || canonicalTitle.trim().toLowerCase() === "release narrative";\n      const receipt: ManagerConversationCreatedWork = {\n        type: "music_item",\n        id: persisted.documentId,\n        musicItemId: subject.id,\n        artifactKind: "song_document",\n        documentType: canonicalDocumentType,\n        title: canonicalTitle,\n        body: internalSupport ? "Internal campaign support updated." : "Draft saved to Files and ready to review.",\n        readiness: persisted.quality?.readiness === "ready" ? "ready" : "needs_review",\n        presentationRole: internalSupport ? "internal_support" : "deliverable",\n        visibility: internalSupport ? "internal" : "user",\n        status: persisted.created ? "created" : "updated",\n      };\n      if (!input.createdWork?.some((work) => work.artifactKind === "song_document" && work.id === receipt.id)) {\n        input.createdWork?.push(receipt);\n      }\n    }\n    return { ...persisted, status: "drafted", musicItemId: subject.id, documentType: canonicalDocumentType, title: canonicalTitle, ...(opportunityId ? { opportunityId } : {}) };'''
text = replace_once(text, old, new, "canonical document receipt")
path.write_text(text)


# Common rich created-work normalizer body used by sync + stream.
rich_normalizer = '''{\n      type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",\n      title: String(item.title || "").trim(),\n      body: String(item.body || "").trim(),\n      artifactKind: item.artifactKind === "task_draft" || item.artifactKind === "song_document" ? item.artifactKind : undefined,\n      content: item.content ? String(item.content) : undefined,\n      musicItemId: item.musicItemId ? String(item.musicItemId) : undefined,\n      documentType: item.documentType ? String(item.documentType) : undefined,\n      readiness: item.readiness === "ready" || item.readiness === "needs_review" || item.readiness === "save_failed" ? item.readiness : undefined,\n      missingInputs: Array.isArray(item.missingInputs) ? item.missingInputs.map((value: unknown) => String(value || "").trim()).filter(Boolean) : undefined,\n      managerOutputId: item.managerOutputId ? String(item.managerOutputId) : undefined,\n      presentationRole: item.presentationRole === "deliverable" || item.presentationRole === "internal_support" || item.presentationRole === "compatibility" ? item.presentationRole : undefined,\n      visibility: item.visibility === "internal" ? "internal" : item.visibility === "user" ? "user" : undefined,\n      id: item.id ? String(item.id) : undefined,\n      parentMissionId: item.parentMissionId ? String(item.parentMissionId) : undefined,\n      status: item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : "created",\n    }'''


# ---------------------------------------------------------------------------
# Synchronous Edge endpoint: enforce package policy, reconcile actual artifacts,
# persist a turn-scoped presentation contract, preserve rich document receipts.
# ---------------------------------------------------------------------------
path = Path("supabase/functions/manager-conversation/index.ts")
text = path.read_text()
anchor = 'import { executeManagerConversationTool } from "../_shared/manager-conversation/toolExecutor.ts";'
text = replace_once(
    text,
    anchor,
    anchor + '\nimport { buildManagerTurnPresentation, enforceExplicitDecisionPackagePolicy, normalizeManagerTurnPresentation, reconcileManagerCreatedWork } from "../_shared/manager-conversation/turnContract.ts";',
    "sync turn-contract import",
)
text = text.replace('import { persistFocusedSongDocumentDraft } from "../_shared/songDocumentDraft.ts";\n', '')
text = replace_once(
    text,
    '''    const finalMusicSubject = await ensureMusicConversationSubjectLink(db, input, conversationId);''',
    '''    enforceExplicitDecisionPackagePolicy(output, input);\n    const turnToolNames = safeToolTraceSummary(toolTrace).map((item) => item.tool);\n    const finalMusicSubject = await ensureMusicConversationSubjectLink(db, input, conversationId);''',
    "sync enforce package policy",
)
text = replace_once(
    text,
    '''      output.contextQuestions = output.contextQuestions.filter((question) => question.key !== derivedProposal.questionKey);\n    }\n    const taskDraftWork''',
    '''      output.contextQuestions = output.contextQuestions.filter((question) => question.key !== derivedProposal.questionKey);\n      turnToolNames.push("propose_focused_release_date_change");\n    }\n    const taskDraftWork''',
    "sync derived proposal surface",
)
text = replace_once(
    text,
    '''    const taskDraftWork = await persistTaskDraftOutput(db, input, conversationId, runId, output);\n    await persistFocusedSongDocumentDraft(db, input, runId, output.responseBody, Boolean(output.contextQuestions.length));\n    output.createdWork = taskDraftWork\n      ? [...toolCreatedWork, ...persistedWork, taskDraftWork]\n      : [...toolCreatedWork, ...persistedWork];''',
    '''    const taskDraftWork = await persistTaskDraftOutput(db, input, conversationId, runId, output);\n    output.createdWork = reconcileManagerCreatedWork(taskDraftWork\n      ? [...toolCreatedWork, ...persistedWork, taskDraftWork]\n      : [...toolCreatedWork, ...persistedWork]);''',
    "sync reconcile created work",
)
text = replace_once(
    text,
    '''    const decisionPackage = await persistDecisionPackageOutput(db, input, conversationId, runId, output);\n    const managerMessage''',
    '''    const decisionPackage = await persistDecisionPackageOutput(db, input, conversationId, runId, output);\n    const presentation = buildManagerTurnPresentation({\n      createdWork: output.createdWork,\n      toolNames: turnToolNames,\n      decisionPackageId: decisionPackage?.id,\n    });\n    const managerMessage''',
    "sync build turn presentation",
)
text = replace_once(
    text,
    '''        decisionPackageId: decisionPackage?.id ?? "",\n        openaiResponseId: responseId,''',
    '''        decisionPackageId: decisionPackage?.id ?? "",\n        presentation,\n        openaiResponseId: responseId,''',
    "sync persist presentation",
)
text = replace_once(
    text,
    '''    const preserveWorkspaceTopic = toolCreatedWork.some((work) => work.type === "music_item");''',
    '''    const preserveWorkspaceTopic = Boolean(finalMusicSubject);''',
    "sync preserve song topic",
)
old_normalizer = '''{\n      type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",\n      title: String(item.title || "").trim(),\n      body: String(item.body || "").trim(),\n      artifactKind: item.artifactKind === "task_draft" ? "task_draft" : undefined,\n      content: item.content ? String(item.content) : undefined,\n      managerOutputId: item.managerOutputId ? String(item.managerOutputId) : undefined,\n      id: item.id ? String(item.id) : undefined,\n      parentMissionId: item.parentMissionId ? String(item.parentMissionId) : undefined,\n      status: item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : "created",\n    }'''
text = replace_once(text, old_normalizer, rich_normalizer, "sync rich normalizer")
text = replace_once(
    text,
    '''      createdWork: normalizeCreatedWork(metadata.createdWork),\n      contextQuestions:''',
    '''      createdWork: normalizeCreatedWork(metadata.createdWork),\n      presentation: normalizeManagerTurnPresentation(metadata.presentation),\n      contextQuestions:''',
    "sync presentation view model",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Streaming Edge endpoint: document creation is NOT release-success state,
# emit only reconciled user artifacts, and persist the same turn contract.
# ---------------------------------------------------------------------------
path = Path("supabase/functions/manager-conversation-stream/index.ts")
text = path.read_text()
anchor = 'import { executeManagerConversationTool } from "../_shared/manager-conversation/toolExecutor.ts";'
text = replace_once(
    text,
    anchor,
    anchor + '\nimport { buildManagerTurnPresentation, enforceExplicitDecisionPackagePolicy, normalizeManagerTurnPresentation, reconcileManagerCreatedWork } from "../_shared/manager-conversation/turnContract.ts";',
    "stream turn-contract import",
)
text = text.replace('import { persistFocusedSongDocumentDraft } from "../_shared/songDocumentDraft.ts";\n', '')
text = replace_once(
    text,
    '''        const finalMusicSubject = await ensureMusicConversationSubjectLink(db, input, conversationId);''',
    '''        enforceExplicitDecisionPackagePolicy(output, input);\n        const finalMusicSubject = await ensureMusicConversationSubjectLink(db, input, conversationId);''',
    "stream enforce package policy",
)
text = replace_once(
    text,
    '''        const preserveWorkspaceTopic = toolCreatedWork.some((work) => work.type === "music_item");\n        if (preserveWorkspaceTopic && finalMusicSubject) {\n          emit({\n            type: "conversation.workspace_ready",\n            conversationId,\n            topic: releasePlanningTopic(finalMusicSubject),\n            musicSubject: finalMusicSubject,\n            createdWork: toolCreatedWork.map(normalizeCreatedWorkItem),\n            refresh: refreshHintForCreatedWorkItems(toolCreatedWork),\n          });\n        }''',
    '''        const workspaceCreatedWork = reconcileManagerCreatedWork(toolCreatedWork)\n          .filter((work) => work.artifactKind !== "song_document");\n        const createdSongWorkspace = workspaceCreatedWork.some((work) => work.type === "music_item")\n          && workspaceCreatedWork.some((work) => work.type === "mission");\n        const preserveWorkspaceTopic = Boolean(finalMusicSubject);\n        if (createdSongWorkspace && finalMusicSubject) {\n          emit({\n            type: "conversation.workspace_ready",\n            conversationId,\n            topic: releasePlanningTopic(finalMusicSubject),\n            musicSubject: finalMusicSubject,\n            createdWork: workspaceCreatedWork.map(normalizeCreatedWorkItem),\n            refresh: refreshHintForCreatedWorkItems(workspaceCreatedWork),\n          });\n        }''',
    "stream workspace event isolation",
)
text = replace_once(
    text,
    '''        const taskDraftWork = await persistTaskDraftOutput(db, input, conversationId, runId, output);\n        const documentToolResult = releaseSuccessToolResults.find((item) => item.tool === "create_focused_song_document");\n        const persistedDocument = documentToolResult?.result && isRecord(documentToolResult.result) && documentToolResult.result.status === "drafted"\n          ? documentToolResult.result\n          : documentToolResult\n            ? undefined\n            : await persistFocusedSongDocumentDraft(db, input, runId, output.responseBody, Boolean(output.contextQuestions.length));\n        const documentWork = persistedDocument ? songDocumentCreatedWork(input, persistedDocument) : undefined;\n        const baseCreatedWork = taskDraftWork\n          ? [...toolCreatedWork, ...persistedWork, taskDraftWork]\n          : [...toolCreatedWork, ...persistedWork];\n        output.createdWork = documentWork\n          ? upsertServerCreatedWork(baseCreatedWork, documentWork)\n          : baseCreatedWork;''',
    '''        const taskDraftWork = await persistTaskDraftOutput(db, input, conversationId, runId, output);\n        output.createdWork = reconcileManagerCreatedWork(taskDraftWork\n          ? [...toolCreatedWork, ...persistedWork, taskDraftWork]\n          : [...toolCreatedWork, ...persistedWork]);''',
    "stream remove compatibility receipt",
)
text = replace_once(
    text,
    '''        const decisionPackage = await persistDecisionPackageOutput(db, input, conversationId, runId, output);\n        const managerMessage''',
    '''        const decisionPackage = await persistDecisionPackageOutput(db, input, conversationId, runId, output);\n        const presentation = buildManagerTurnPresentation({\n          createdWork: output.createdWork,\n          toolNames: [\n            ...safeToolTraceSummary(toolTrace).map((item) => item.tool),\n            ...releaseSuccessToolResults.map((item) => item.tool),\n          ],\n          decisionPackageId: decisionPackage?.id,\n        });\n        const managerMessage''',
    "stream build presentation",
)
text = replace_once(
    text,
    '''            decisionPackageId: decisionPackage?.id ?? "",\n            openaiResponseId: responseId,''',
    '''            decisionPackageId: decisionPackage?.id ?? "",\n            presentation,\n            openaiResponseId: responseId,''',
    "stream persist presentation",
)
text = replace_once(
    text,
    '''function isReleaseSuccessTool(tool: string) {\n  return tool === "read_focused_release_success"\n    || tool === "propose_focused_release_date_change"\n    || tool === "create_focused_song_document";\n}\n\nfunction isOpportunityTool(tool: string) {\n  return tool === "query_focused_release_opportunities"\n    || tool === "save_focused_release_opportunities"\n    || tool === "record_focused_release_opportunity_outcome"\n    || tool === "create_focused_song_document";\n}''',
    '''function isReleaseSuccessTool(tool: string) {\n  return tool === "read_focused_release_success"\n    || tool === "propose_focused_release_date_change";\n}\n\nfunction isOpportunityTool(tool: string) {\n  return tool === "query_focused_release_opportunities"\n    || tool === "save_focused_release_opportunities"\n    || tool === "record_focused_release_opportunity_outcome";\n}''',
    "stream document surface separation",
)
old_stream_item = '''{\n    type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",\n    title: String(item.title || "").trim(),\n    body: String(item.body || "").trim(),\n    artifactKind: item.artifactKind === "task_draft" ? "task_draft" : undefined,\n    content: item.content ? String(item.content) : undefined,\n    managerOutputId: item.managerOutputId ? String(item.managerOutputId) : undefined,\n    id: item.id ? String(item.id) : undefined,\n    parentMissionId: item.parentMissionId ? String(item.parentMissionId) : undefined,\n    status: item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : "created",\n  }'''
stream_rich = rich_normalizer.replace('{\n      ', '{\n    ').replace('\n      ', '\n    ')
text = replace_once(text, old_stream_item, stream_rich, "stream rich normalizer")
text = regex_once(
    text,
    r'\nfunction songDocumentCreatedWork\(input: ManagerConversationInput, persistedDocument: Record<string, unknown>\) \{.*?\n\}\n\nfunction upsertServerCreatedWork\(.*?\n\}\n',
    '\n',
    "remove stream compatibility helpers",
    flags=re.S,
)
text = replace_once(
    text,
    '''    createdWork: normalizeCreatedWork(metadata.createdWork),\n    contextQuestions:''',
    '''    createdWork: normalizeCreatedWork(metadata.createdWork),\n    presentation: normalizeManagerTurnPresentation(metadata.presentation),\n    contextQuestions:''',
    "stream presentation view model",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Browser view models carry the deterministic turn contract and artifact roles.
# ---------------------------------------------------------------------------
path = Path("src/types/cleanProduction.ts")
text = path.read_text()
marker = 'export type ConversationMessageViewModel = {'
text = replace_once(
    text,
    marker,
    '''export type ManagerTurnSurfaceViewModel = "release_success" | "release_opportunities" | "decision_package" | "release_share_package";\n\nexport type ManagerTurnPresentationViewModel = {\n  version: 1;\n  surfaces: ManagerTurnSurfaceViewModel[];\n  visibleArtifactIds: string[];\n  decisionPackageId?: string;\n};\n\n''' + marker,
    "frontend turn presentation types",
)
text = text.replace(
    '    managerOutputId?: string;\n    status?: "created" | "updated" | "approval_required" | "failed" | "pending";',
    '    managerOutputId?: string;\n    presentationRole?: "deliverable" | "internal_support" | "compatibility";\n    visibility?: "user" | "internal";\n    status?: "created" | "updated" | "approval_required" | "failed" | "pending";',
)
if text.count('presentationRole?: "deliverable" | "internal_support" | "compatibility";') != 2:
    raise SystemExit("frontend created-work role fields: expected exactly 2 occurrences")
text = replace_once(
    text,
    '  attachments?: ManagerConversationAttachmentViewModel[];\n};',
    '  attachments?: ManagerConversationAttachmentViewModel[];\n  presentation?: ManagerTurnPresentationViewModel;\n};',
    "message presentation field",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Production loader preserves the contract/rich receipts and hides internal
# Release Narrative from the artist-facing Files list.
# ---------------------------------------------------------------------------
path = Path("src/services/productionSupabase.ts")
text = path.read_text()
old_prod = '''{\n      type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",\n      title: readConversationString(item.title, ""),\n      body: readConversationString(item.body, ""),\n      artifactKind: item.artifactKind === "task_draft" ? "task_draft" as const : undefined,\n      content: typeof item.content === "string" && item.content.trim() ? item.content.trim() : undefined,\n      managerOutputId: typeof item.managerOutputId === "string" && item.managerOutputId.trim() ? item.managerOutputId.trim() : undefined,\n      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined,\n      parentMissionId: typeof item.parentMissionId === "string" && item.parentMissionId.trim() ? item.parentMissionId.trim() : undefined,\n      status: item.status === "created" || item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : undefined,\n    }'''
new_prod = '''{\n      type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",\n      title: readConversationString(item.title, ""),\n      body: readConversationString(item.body, ""),\n      artifactKind: item.artifactKind === "task_draft" || item.artifactKind === "song_document" ? item.artifactKind : undefined,\n      content: typeof item.content === "string" && item.content.trim() ? item.content.trim() : undefined,\n      musicItemId: typeof item.musicItemId === "string" && item.musicItemId.trim() ? item.musicItemId.trim() : undefined,\n      documentType: typeof item.documentType === "string" && item.documentType.trim() ? item.documentType.trim() : undefined,\n      readiness: item.readiness === "ready" || item.readiness === "needs_review" || item.readiness === "save_failed" ? item.readiness : undefined,\n      missingInputs: Array.isArray(item.missingInputs) ? item.missingInputs.map((value) => readConversationString(value, "")).filter(Boolean) : undefined,\n      managerOutputId: typeof item.managerOutputId === "string" && item.managerOutputId.trim() ? item.managerOutputId.trim() : undefined,\n      presentationRole: item.presentationRole === "deliverable" || item.presentationRole === "internal_support" || item.presentationRole === "compatibility" ? item.presentationRole : undefined,\n      visibility: item.visibility === "internal" ? "internal" : item.visibility === "user" ? "user" : undefined,\n      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined,\n      parentMissionId: typeof item.parentMissionId === "string" && item.parentMissionId.trim() ? item.parentMissionId.trim() : undefined,\n      status: item.status === "created" || item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : undefined,\n    }'''
text = replace_once(text, old_prod, new_prod, "production rich created-work normalizer")
text = replace_once(
    text,
    '''  const contextRequestId = readOptionalConversationString(metadata.contextRequestId);\n  return {''',
    '''  const contextRequestId = readOptionalConversationString(metadata.contextRequestId);\n  const presentation = normalizeManagerTurnPresentation(metadata.presentation);\n  return {''',
    "production row presentation parse",
)
text = replace_once(
    text,
    '''    ...(contextRequestId ? { contextRequestId } : {}),\n  };\n}\n\nfunction conversationViewModel''',
    '''    ...(contextRequestId ? { contextRequestId } : {}),\n    ...(presentation ? { presentation } : {}),\n  };\n}\n\nfunction conversationViewModel''',
    "production row presentation field",
)
text = replace_once(
    text,
    '''        const contextRequestId = readOptionalConversationString(message.contextRequestId);\n        return {''',
    '''        const contextRequestId = readOptionalConversationString(message.contextRequestId);\n        const presentation = normalizeManagerTurnPresentation(message.presentation);\n        return {''',
    "production API presentation parse",
)
text = replace_once(
    text,
    '''          ...(contextRequestId ? { contextRequestId } : {}),\n        };''',
    '''          ...(contextRequestId ? { contextRequestId } : {}),\n          ...(presentation ? { presentation } : {}),\n        };''',
    "production API presentation field",
)
insert_before = 'function normalizeCreatedWork(value: unknown): ConversationViewModel["createdWork"] {'
turn_parser = '''function normalizeManagerTurnPresentation(value: unknown): ConversationMessageViewModel["presentation"] {\n  if (!isPlainRecord(value) || value.version !== 1 || !Array.isArray(value.surfaces)) return undefined;\n  const allowed = new Set(["release_success", "release_opportunities", "decision_package", "release_share_package"]);\n  const surfaces = [...new Set(value.surfaces.filter((item): item is string => typeof item === "string" && allowed.has(item)))] as NonNullable<ConversationMessageViewModel["presentation"]>["surfaces"];\n  const visibleArtifactIds = Array.isArray(value.visibleArtifactIds)\n    ? [...new Set(value.visibleArtifactIds.map((item) => readConversationString(item, "")).filter(Boolean))]\n    : [];\n  const decisionPackageId = readOptionalConversationString(value.decisionPackageId);\n  return { version: 1, surfaces, visibleArtifactIds, ...(decisionPackageId ? { decisionPackageId } : {}) };\n}\n\n'''
text = replace_once(text, insert_before, turn_parser + insert_before, "production turn presentation helper")
text = replace_once(
    text,
    '''      const document = documentById.get(link.source_id);\n      if (!document) return [];\n      seen.add(document.id);''',
    '''      const document = documentById.get(link.source_id);\n      if (!document) return [];\n      if (document.document_type === "release_narrative" || document.title.trim().toLowerCase() === "release narrative") return [];\n      seen.add(document.id);''',
    "hide internal narrative from Files",
)
# Do not project a conversation-wide package onto a newer structured turn that
# did not create/ask for it.
text = replace_once(
    text,
    '''  const mappedMessages = messages.map(conversationMessageFromRow);\n  const prompt = mappedMessages.find((message) => message.speaker === "artist")?.body ?? row.summary ?? "";\n\n  return {''',
    '''  const mappedMessages = messages.map(conversationMessageFromRow);\n  const prompt = mappedMessages.find((message) => message.speaker === "artist")?.body ?? row.summary ?? "";\n  const latestManagerPresentation = [...mappedMessages].reverse().find((message) => message.speaker === "manager")?.presentation;\n  const visibleDecisionPackage = output && (\n    !latestManagerPresentation\n    || (latestManagerPresentation.surfaces.includes("decision_package")\n      && (!latestManagerPresentation.decisionPackageId || latestManagerPresentation.decisionPackageId === output.id))\n  ) ? output : undefined;\n\n  return {''',
    "production decision package turn scope",
)
text = replace_once(
    text,
    '''    ...(output ? { decisionPackage: decisionPackageFromRow(output) } : {}),''',
    '''    ...(visibleDecisionPackage ? { decisionPackage: decisionPackageFromRow(visibleDecisionPackage) } : {}),''',
    "production scoped decision package",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Presentation layer: structured metadata is authoritative for new turns.
# Regexes remain only as legacy fallback for old messages already in production.
# ---------------------------------------------------------------------------
path = Path("src/features/manager/ManagerScreens.tsx")
text = path.read_text()
text = replace_once(
    text,
    '''  const directive = triggeringArtistMessage?.body ?? conversation.prompt ?? "";\n  const lifecycleStage = conversation.musicSubject?.lifecycleStage?.trim().toLowerCase() ?? "";\n  const isReleased = RELEASED_STAGES.has(lifecycleStage);\n  const subject = conversation.musicSubject;''',
    '''  const directive = triggeringArtistMessage?.body ?? conversation.prompt ?? "";\n  const lifecycleStage = conversation.musicSubject?.lifecycleStage?.trim().toLowerCase() ?? "";\n  const isReleased = RELEASED_STAGES.has(lifecycleStage);\n  const subject = conversation.musicSubject;\n  const latestManagerPresentation = lastManagerIndex >= 0 ? messages[lastManagerIndex]?.presentation : undefined;\n  const hasTurnContract = latestManagerPresentation?.version === 1;\n  const hasSurface = (surface: "release_success" | "release_opportunities" | "decision_package") =>\n    Boolean(latestManagerPresentation?.surfaces.includes(surface));''',
    "frontend structured surface setup",
)
text = replace_once(
    text,
    '''    const createdWork = (message.createdWork ?? []).flatMap((item) => {\n      const normalized = normalizeHistoricalDocumentWork(item, message.id, subject);\n      return normalized ? [normalized] : [];\n    });''',
    '''    const createdWork = (message.createdWork ?? []).flatMap((item) => {\n      if (item.visibility === "internal" || item.presentationRole === "internal_support" || item.presentationRole === "compatibility") return [];\n      const normalized = normalizeHistoricalDocumentWork(item, message.id, subject);\n      return normalized ? [normalized] : [];\n    });''',
    "frontend internal work defense",
)
text = replace_once(
    text,
    '''    releaseSuccessArtifacts: !latestManagerFailed && !isReleased && RELEASE_MANAGEMENT_INTENT.test(directive)\n      ? conversation.releaseSuccessArtifacts\n      : [],\n    releaseOpportunityArtifacts: !latestManagerFailed && OPPORTUNITY_DISCOVERY_INTENT.test(directive)\n      ? conversation.releaseOpportunityArtifacts\n      : [],\n    decisionPackage: !latestManagerFailed && DECISION_PACKAGE_INTENT.test(directive)\n      ? conversation.decisionPackage\n      : undefined,''',
    '''    releaseSuccessArtifacts: !latestManagerFailed && (hasTurnContract\n      ? hasSurface("release_success")\n      : !isReleased && RELEASE_MANAGEMENT_INTENT.test(directive))\n      ? conversation.releaseSuccessArtifacts\n      : [],\n    releaseOpportunityArtifacts: !latestManagerFailed && (hasTurnContract\n      ? hasSurface("release_opportunities")\n      : OPPORTUNITY_DISCOVERY_INTENT.test(directive))\n      ? conversation.releaseOpportunityArtifacts\n      : [],\n    decisionPackage: !latestManagerFailed && (hasTurnContract\n      ? hasSurface("decision_package")\n        && (!latestManagerPresentation?.decisionPackageId || latestManagerPresentation.decisionPackageId === conversation.decisionPackage?.id)\n      : DECISION_PACKAGE_INTENT.test(directive))\n      ? conversation.decisionPackage\n      : undefined,''',
    "frontend structured surface rendering",
)
path.write_text(text)


# Final presentation guard: internal/support receipts cannot render even if a
# caller bypasses ManagerScreens.prepareManagerConversationForPresentation.
path = Path("src/features/manager/managerPresentation.ts")
text = path.read_text()
text = replace_once(
    text,
    '''export function groupManagerWork(items: ManagerWorkItem[]): ManagerWorkGroup[] {\n  const unique = dedupeManagerWork(items);''',
    '''export function groupManagerWork(items: ManagerWorkItem[]): ManagerWorkGroup[] {\n  const unique = dedupeManagerWork(items.filter((item) =>\n    item.visibility !== "internal"\n    && item.presentationRole !== "internal_support"\n    && item.presentationRole !== "compatibility"\n    && item.documentType !== "release_narrative"\n    && item.title.trim().toLowerCase() !== "release narrative"\n  ));''',
    "manager work visibility guard",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Product-level regression tests: open chat intent must route by server contract,
# not by brittle English matching or stale conversation state.
# ---------------------------------------------------------------------------
Path("src/manager-turn-contract.test.ts").write_text(r'''import { describe, expect, it } from "vitest";
import {
  buildManagerTurnPresentation,
  enforceExplicitDecisionPackagePolicy,
  explicitlyRequestsDecisionPackage,
  reconcileManagerCreatedWork,
} from "../supabase/functions/_shared/manager-conversation/turnContract";
import { prepareManagerConversationForPresentation } from "./features/manager/ManagerScreens";
import type { ConversationViewModel } from "./types/cleanProduction";

function baseConversation(): ConversationViewModel {
  return {
    id: "conversation-1",
    topic: "Release work",
    status: "Manager responded",
    summary: "summary",
    prompt: "",
    musicSubject: { type: "music_item", id: "song-1", title: "Song", lifecycleStage: "released" },
    createdWork: [],
    messages: [],
  };
}

describe("Manager turn contract", () => {
  it("never creates a decision package just because the user asked for a durable artifact", () => {
    const output = { actionPolicy: "create_decision_package", responseBody: "EPK ready" };
    enforceExplicitDecisionPackagePolicy(output, { body: "Create an EPK for this song" });
    expect(output.actionPolicy).toBe("answer_only");
    expect(explicitlyRequestsDecisionPackage({ body: "Create a decision package for this release date call" })).toBe(true);
    expect(explicitlyRequestsDecisionPackage({ body: "Prepare a press package and EPK" })).toBe(false);
  });

  it("hides internal support and compatibility receipts and dedupes canonical documents", () => {
    const work = reconcileManagerCreatedWork([
      { type: "music_item", id: "narrative-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "release_narrative", title: "Release narrative", presentationRole: "internal_support", visibility: "internal" },
      { type: "music_item", id: "epk-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "epk", title: "Song EPK", presentationRole: "deliverable", visibility: "user" },
      { type: "music_item", id: "song-1", title: "Song EPK", presentationRole: "compatibility", visibility: "user" },
      { type: "music_item", id: "epk-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "epk", title: "Song EPK", presentationRole: "deliverable", visibility: "user" },
    ]);
    expect(work).toHaveLength(1);
    expect(work[0]?.id).toBe("epk-1");
  });

  it("derives specialized UI surfaces from completed tools, not chat wording", () => {
    const presentation = buildManagerTurnPresentation({
      createdWork: [],
      toolNames: ["query_focused_release_opportunities", "save_focused_release_opportunities"],
    });
    expect(presentation.surfaces).toEqual(["release_opportunities"]);
  });

  it("uses structured surfaces as authoritative even when the artist wording does not match frontend regexes", () => {
    const conversation = baseConversation();
    conversation.releaseOpportunityArtifacts = [{
      id: "opportunity-set",
      musicItemId: "song-1",
      subjectTitle: "Song",
      opportunityType: "playlist",
      state: "ready",
      targets: [],
    } as any];
    conversation.messages = [
      { id: "u1", speaker: "artist", label: "You", body: "What can we do now to get more ears on this?" },
      { id: "m1", speaker: "manager", label: "Manager", body: "I found a shortlist.", presentation: { version: 1, surfaces: ["release_opportunities"], visibleArtifactIds: [] } },
    ];
    expect(prepareManagerConversationForPresentation(conversation).releaseOpportunityArtifacts).toHaveLength(1);
  });

  it("does not attach stale conversation-wide decision packages to a newer non-package turn", () => {
    const conversation = baseConversation();
    conversation.decisionPackage = {
      id: "old-package",
      title: "Old decision",
      summary: "old",
      recommendation: "old",
      confidence: "high",
      actionPolicy: "create_decision_package",
      evidenceIds: [],
      limitations: [],
      createdWork: [],
      proposedActions: [],
    };
    conversation.messages = [
      { id: "u1", speaker: "artist", label: "You", body: "Create the press release" },
      { id: "m1", speaker: "manager", label: "Manager", body: "Press release ready.", presentation: { version: 1, surfaces: [], visibleArtifactIds: ["press-1"] }, createdWork: [
        { type: "music_item", id: "press-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "press_release", title: "Song press release", body: "Draft saved", presentationRole: "deliverable", visibility: "user" },
        { type: "music_item", id: "internal-1", musicItemId: "song-1", artifactKind: "song_document", documentType: "release_narrative", title: "Release narrative", body: "internal", presentationRole: "internal_support", visibility: "internal" },
      ] },
    ];
    const projected = prepareManagerConversationForPresentation(conversation);
    expect(projected.decisionPackage).toBeUndefined();
    expect(projected.messages[1]?.createdWork).toHaveLength(1);
    expect(projected.messages[1]?.createdWork?.[0]?.id).toBe("press-1");
  });

  it("shows a decision package only when the server bound that package to the turn", () => {
    const conversation = baseConversation();
    conversation.decisionPackage = {
      id: "package-1",
      title: "Release strategy decision",
      summary: "basis",
      recommendation: "recommendation",
      confidence: "high",
      actionPolicy: "create_decision_package",
      evidenceIds: [],
      limitations: [],
      createdWork: [],
      proposedActions: [],
    };
    conversation.messages = [
      { id: "u1", speaker: "artist", label: "You", body: "Put your recommendation into something I can take to the team" },
      { id: "m1", speaker: "manager", label: "Manager", body: "Done.", presentation: { version: 1, surfaces: ["decision_package"], visibleArtifactIds: [], decisionPackageId: "package-1" } },
    ];
    expect(prepareManagerConversationForPresentation(conversation).decisionPackage?.id).toBe("package-1");
  });
});
''')

print("Manager turn contract patch applied")
