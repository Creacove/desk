import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("keeps a delayed music read from publishing over a newer canonical song event", () => {
  const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260807000500_music_manager_read_stale_publish_guard.sql"), "utf8");
  const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "generate-music-summary", "index.ts"), "utf8");

  expect(migration).toContain("finalize_latest_leased_music_manager_read_v2");
  expect(migration).toContain("target_trigger_event_id uuid");
  expect(migration).toContain("music_asset_uploaded");
  expect(migration).toContain("music_item_created");
  expect(migration).toContain("published', false");
  expect(functionSource).toContain("finalize_latest_leased_music_manager_read_v2");
  expect(functionSource).toContain("music_manager_read_superseded");
  expect(functionSource).toContain("finalizationMetadataMatches");
  expect(functionSource).toContain("superseded_by_event_id: supersededByEventId");
});
