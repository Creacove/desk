import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodayManagerItem } from "../features/desk/todayProjection";

export async function answerTodayManagerQuestion(
  client: SupabaseClient,
  item: TodayManagerItem,
  answer: string,
) {
  const cleanAnswer = answer.trim();
  if (item.kind !== "question" || !item.missionId || !item.contextRequestId || !item.questionKey || !item.conversationId || !cleanAnswer) {
    throw new Error("This Manager question is no longer answerable from Today.");
  }

  const workspace = await loadMissionWorkspaceIdentity(client, item.missionId);
  if (!workspace) throw new Error("This Mission is no longer available in the current workspace.");

  const { error } = await client.functions.invoke("manager-conversation", {
    body: {
      accountId: workspace.accountId,
      artistWorkspaceId: workspace.artistWorkspaceId,
      artistId: workspace.artistId,
      conversationId: item.conversationId,
      body: "Context answer for Manager.",
      ...(item.taskId ? { taskId: item.taskId } : {}),
      contextRequestId: item.contextRequestId,
      contextAnswers: [{ questionKey: item.questionKey, answer: cleanAnswer }],
    },
  });

  if (error) throw new Error(error.message || "Manager could not save this answer.");
}

async function loadMissionWorkspaceIdentity(client: SupabaseClient, missionId: string) {
  const { data, error } = await client
    .from("missions")
    .select("account_id,artist_workspace_id,artist_id,status")
    .eq("id", missionId)
    .maybeSingle();
  if (error) throw error;
  const row = data as Record<string, unknown> | null;
  if (!row || ["complete", "archived", "cancelled"].includes(text(row.status))) return null;
  const accountId = text(row.account_id);
  const artistWorkspaceId = text(row.artist_workspace_id);
  const artistId = text(row.artist_id);
  return accountId && artistWorkspaceId && artistId ? { accountId, artistWorkspaceId, artistId } : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
