export async function assertActiveWorkspaceEntitlement(
  client: {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  input: { artistWorkspaceId?: string | null },
) {
  if (!input.artistWorkspaceId) {
    throw new Error("Artist workspace is required for entitlement checks.");
  }

  const { data, error } = await client.rpc("has_active_workspace_entitlement", {
    p_artist_workspace_id: input.artistWorkspaceId,
  });

  if (error) {
    throw error;
  }

  if (data !== true) {
    throw new Error("Active paid or beta access is required before this workspace action can run.");
  }
}
