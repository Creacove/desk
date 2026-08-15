import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  persistFocusedSongDocumentDraft,
  releaseSuccessDocumentTypes,
} from "../supabase/functions/_shared/songDocumentDraft";

type Row = Record<string, any>;

class DocumentDbDouble {
  readonly rows: Record<string, Row[]> = {
    artifact_links: [{ id: "mission-link-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1", source_type: "mission", source_id: "mission-1", target_type: "music_item", target_id: "song-1", relationship: "references" }],
    documents: [],
    document_versions: [],
    operating_events: [],
  };
  failTable: string | null = null;
  private sequence = 0;

  from(table: string) {
    return new DocumentQuery(this, table);
  }

  nextId(prefix: string) {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }
}

class DocumentQuery {
  private filters: Array<[string, unknown]> = [];
  private inFilters: Array<[string, unknown[]]> = [];
  private action: "select" | "insert" | "update" | "delete" | null = null;
  private payload: Row | Row[] | null = null;
  private inserted: Row[] = [];
  private head = false;

  constructor(private readonly db: DocumentDbDouble, private readonly table: string) {}

  select(_columns: string, options?: { head?: boolean }) {
    this.action = this.action ?? "select";
    this.head = Boolean(options?.head);
    return this;
  }

  insert(payload: Row | Row[]) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    if (!this.action) throw new TypeError("query.eq is not a function");
    this.filters.push([column, value]);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push([column, values]);
    return this;
  }

  order() { return this; }
  limit() { return this; }

  async single() {
    const result = await this.execute();
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async maybeSingle() {
    const result = await this.execute();
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  then(resolve: (value: { data: Row[] | null; error: Error | null; count?: number }) => unknown, reject?: (error: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }

  private async execute() {
    if (this.db.failTable === this.table && this.action && ["insert", "update", "delete"].includes(this.action)) {
      return { data: null, error: new Error(`${this.table} write failed`) };
    }

    const tableRows = this.db.rows[this.table] ?? (this.db.rows[this.table] = []);
    const matching = () => tableRows.filter((row) => this.filters.every(([column, value]) => row[column] === value)
      && this.inFilters.every(([column, values]) => values.includes(row[column])));

    if (this.action === "insert") {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      this.inserted = values.map((value) => ({ ...value, id: value.id ?? this.db.nextId(this.table === "documents" ? "document" : this.table === "document_versions" ? "version" : this.table === "artifact_links" ? "link" : "event") }));
      tableRows.push(...this.inserted);
      return { data: this.inserted, error: null };
    }

    if (this.action === "update") {
      const updated = matching().map((row) => Object.assign(row, this.payload ?? {}));
      return { data: updated, error: null };
    }

    if (this.action === "delete") {
      const deleted = matching();
      this.db.rows[this.table] = tableRows.filter((row) => !deleted.includes(row));
      return { data: deleted, error: null };
    }

    const data = matching();
    return this.head
      ? { data: null, count: data.length, error: null }
      : { data, error: null };
  }
}

const input = {
  accountId: "account-1",
  artistWorkspaceId: "workspace-1",
  artistId: "artist-1",
  body: "Create a release document.",
  musicSubject: { type: "music_item" as const, id: "song-1" },
};

const documentSections = {
  press_pitch: ["subject_line", "opening", "why_them", "story", "proof", "cta"],
  playlist_pitch: ["subject_line", "opening", "fit", "song_story", "proof", "cta"],
  epk: ["artist_snapshot", "release_story", "why_now", "sound_and_context", "proof", "press_angles", "assets_and_links", "contact"],
} as const;

function structuredBody(type: keyof typeof documentSections, revision: string) {
  const sections = documentSections[type].map((key, index) => ({
    key,
    title: key.replace(/_/g, " "),
    content: `After Midnight ${revision} section ${index + 1} uses verified workspace context to explain the song, its late-night Afrobeats direction, the intended audience, and the concrete campaign action without inventing unsupported performance claims or recipient details.`,
    evidenceRefs: ["workspace:song-1"],
  }));
  return JSON.stringify({
    purpose: "Prepare a specific review-ready campaign document for this recorded song.",
    audience: "Verified music industry recipients reviewing this release.",
    coreNarrative: "After Midnight is positioned as a late-night Afrobeats record whose restrained mood and direct release story give the campaign one consistent, evidence-grounded angle across every recipient-facing asset.",
    sections,
    claims: [{
      text: "The workspace identifies After Midnight as an Afrobeats song with a late-night mood.",
      basis: "workspace",
      sourceRef: "workspace:song-1",
      confidence: "high",
    }],
    missingInputs: [],
  });
}

afterEach(() => vi.restoreAllMocks());

describe("release-success canonical documents", () => {
  it("persists the canonical document, version, links, and event in one database transaction", () => {
    const sql = readFileSync("supabase/migrations/20260813000100_release_document_persistence.sql", "utf8");
    expect(sql).toContain("create or replace function public.persist_focused_song_document_v1");
    expect(sql).toMatch(/music_release_plans[\s\S]*mission_id/is);
    expect(sql).toMatch(/insert into public\.documents[\s\S]*insert into public\.document_versions[\s\S]*insert into public\.artifact_links[\s\S]*insert into public\.operating_events/is);
    expect(sql).not.toMatch(/exception\s+when\s+others/is);
  });

  it("supports every Video One release document type", () => {
    expect(releaseSuccessDocumentTypes).toEqual([
      "epk",
      "spotify_editorial_pitch",
      "playlist_pitch",
      "press_target_brief",
      "press_pitch",
      "content_plan",
      "release_calendar",
    ]);
  });

  it("creates one logical document, links it to the song and mission, and versions updates", async () => {
    const db = new DocumentDbDouble();
    const first = await persistFocusedSongDocumentDraft(db, {
      ...input,
      documentType: "press_pitch",
      title: "Personalized press pitch",
    } as any, "run-1", structuredBody("press_pitch", "first"), false);
    const second = await persistFocusedSongDocumentDraft(db, {
      ...input,
      documentType: "press_pitch",
      title: "Personalized press pitch",
    } as any, "run-2", structuredBody("press_pitch", "updated"), false);

    expect(first).toEqual(expect.objectContaining({ documentId: "document-1", missionId: "mission-1", status: "draft", schemaVersion: "song_document_v2" }));
    expect(second).toEqual(expect.objectContaining({ documentId: "document-1", versionId: expect.not.stringMatching(first?.versionId ?? "^$") }));
    expect(db.rows.documents).toHaveLength(1);
    expect(db.rows.document_versions.map((row) => row.version_number)).toEqual([1, 2]);
    expect(db.rows.documents[0].current_version_id).toBe(second?.versionId);
    expect(db.rows.artifact_links.filter((row) => row.source_id === "document-1").map((row) => [row.target_type, row.target_id])).toEqual([
      ["music_item", "song-1"],
      ["mission", "mission-1"],
    ]);
  });

  it("compensates a failed success event so Files has no phantom document", async () => {
    const db = new DocumentDbDouble();
    db.failTable = "operating_events";

    await expect(persistFocusedSongDocumentDraft(db, {
      ...input,
      documentType: "epk",
      title: "EPK",
    } as any, "run-failed", structuredBody("epk", "failed"), false)).rejects.toThrow("operating_events write failed");

    expect(db.rows.documents).toEqual([]);
    expect(db.rows.document_versions).toEqual([]);
    expect(db.rows.artifact_links.filter((row) => row.source_id === "document-1")).toEqual([]);
    expect(db.rows.operating_events).toEqual([]);
  });

  it("restores the prior document version when a later persistence event fails", async () => {
    const db = new DocumentDbDouble();
    const first = await persistFocusedSongDocumentDraft(db, {
      ...input,
      documentType: "playlist_pitch",
      title: "Playlist pitch",
    } as any, "run-1", structuredBody("playlist_pitch", "original"), false);
    const originalDocument = { ...db.rows.documents[0] };
    const originalVersions = db.rows.document_versions.map((row) => ({ ...row }));

    db.failTable = "operating_events";
    await expect(persistFocusedSongDocumentDraft(db, {
      ...input,
      documentType: "playlist_pitch",
      title: "Playlist pitch",
    } as any, "run-2", structuredBody("playlist_pitch", "replacement"), false)).rejects.toThrow("operating_events write failed");

    expect(db.rows.documents).toEqual([originalDocument]);
    expect(db.rows.document_versions).toEqual(originalVersions);
    expect(db.rows.documents[0].current_version_id).toBe(first?.versionId);
  });
});
