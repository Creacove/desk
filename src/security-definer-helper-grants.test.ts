import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260829200900_restrict_security_definer_helper_execute.sql",
  "utf8",
);

describe("internal security-definer helper grants", () => {
  for (const signature of [
    "public.rls_auto_enable()",
    "public.stale_campaign_documents_from_music_item()",
    "public.stale_campaign_documents_from_music_child()",
  ]) {
    it(`does not expose ${signature} as a client RPC`, () => {
      expect(migration).toContain(
        `revoke execute on function ${signature} from public, anon, authenticated`,
      );
      expect(migration).toContain(`grant execute on function ${signature} to service_role`);
    });
  }

  for (const signature of [
    "public.set_updated_at()",
    "public.validate_task_transition()",
    "public.get_guc_role()",
  ]) {
    it(`pins and removes client execution from ${signature}`, () => {
      expect(migration).toContain(`alter function ${signature} set search_path =`);
      expect(migration).toContain(
        `revoke execute on function ${signature} from public, anon, authenticated`,
      );
      expect(migration).toContain(`grant execute on function ${signature} to service_role`);
    });
  }
});
