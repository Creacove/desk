import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodayManagerItem } from "../features/desk/todayProjection";

export async function answerTodayManagerQuestion(
  client: SupabaseClient,
  item: TodayManagerItem,
  answer: string,
) {
  const cleanAnswer = answer.trim();
  if (item.kind !== "question" || !item.contextRequestId || !item.questionKey || !item.conversationId || !cleanAnswer) {
    throw new Error("This Manager question is no longer answerable from Today.");
  }

  const workspace = await loadActiveWorkspaceIdentity(client);
  if (!workspace) throw new Error("The active artist workspace could not be resolved.");

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

async function loadActiveWorkspaceIdentity(client: SupabaseClient) {
  const { data: memberships, error: membershipError } = await client
    .from("account_memberships")
    .select("account_id")
    .eq("status", "active")
    .limit(1);
  if (membershipError) throw membershipError;
  const accountId = text((memberships?.[0] as Record<string, unknown> | undefined)?.account_id);
  if (!accountId) return null;

  const { data: workspaces, error: workspaceError } = await client
    .from("artist_workspaces")
    .select("id,artist_id")
    .eq("account_id", accountId)
    .in("status", ["setup", "active"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (workspaceError) throw workspaceError;
  const row = workspaces?.[0] as Record<string, unknown> | undefined;
  const artistWorkspaceId = text(row?.id);
  const artistId = text(row?.artist_id);
  return artistWorkspaceId && artistId ? { accountId, artistWorkspaceId, artistId } : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
