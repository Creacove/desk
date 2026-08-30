import { describe, expect, it, vi } from "vitest";
import { resolveTodayManagerPermission } from "./services/todayPermissionAction";

describe("Today permission action", () => {
  it("surfaces the safe Edge response instead of Supabase's generic non-2xx wrapper", async () => {
    const response = new Response(JSON.stringify({
      error: "This approval is stale because its Manager plan was superseded.",
      errorEventId: "error-event-1",
    }), { status: 409, headers: { "Content-Type": "application/json" } });
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Edge Function returned a non-2xx status code", context: response },
        }),
      },
    };

    await expect(resolveTodayManagerPermission(client as never, "permission-1", "approve"))
      .rejects.toThrow("This approval is stale because its Manager plan was superseded. (Reference: error-event-1)");
  });
});
