import { describe, expect, it } from "vitest";
import { buildManagerEvidenceReads, buildTodaysBriefModelPacket } from "../supabase/functions/_shared/manager-intelligence/brief/briefPacketProjection";
import { buildManagerIntelligencePacket } from "../supabase/functions/_shared/manager-intelligence/packet/strategicIntelligencePacket";
import { validateManagerIntelligencePacket } from "../supabase/functions/_shared/manager-intelligence/packet/packetSchema";

describe("Manager Intelligence packet builder", () => {
  it("builds a valid packet from current profile, music, and evidence records", () => {
    const packet = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      packetType: "setup",
      profile: {
        display_name: "Mavo",
        stage: "Developing",
        home_market: "Lagos",
        genres: ["afrobeats"],
        current_goal: "Grow the current single",
      },
      musicItems: [
        { id: "older-song", title: "Older Song", released_at: "2025-01-01T00:00:00.000Z" },
        { id: "call-me", title: "Call Me", released_at: "2024-01-01T00:00:00.000Z" },
      ],
      musicProjects: [{ id: "project-1", title: "Mavo EP", released_at: "2024-02-01T00:00:00.000Z" }],
      evidenceRows: [
        {
          id: "ev_artist_score",
          evidence_type: "platform_metric",
          subject_type: "artist",
          metric_name: "chartmetric_artist_score",
          metric_value: 42,
          metric_unit: "score",
        },
        {
          id: "ev_fanbase_rank",
          evidence_type: "platform_metric",
          subject_type: "artist",
          metric_name: "fan_base_rank",
          metric_value: 80_000,
          metric_unit: "rank",
        },
        {
          id: "ev_engagement_rank",
          evidence_type: "platform_metric",
          subject_type: "artist",
          metric_name: "engagement_rank",
          metric_value: 8_000,
          metric_unit: "rank",
        },
        {
          id: "ev_tiktok",
          evidence_type: "public_social_metric",
          subject_type: "music_item",
          subject_id: "call-me",
          subject_label: "Call Me",
          metric_name: "tiktok_track_posts",
          metric_value: 1_500_000,
          metric_unit: "posts",
          lens: "social_attention",
        },
        {
          id: "ev_shazam",
          evidence_type: "platform_metric",
          subject_type: "music_item",
          subject_id: "call-me",
          subject_label: "Call Me",
          metric_name: "shazam_count",
          metric_value: 22_000,
          metric_unit: "shazams",
        },
        {
          id: "ev_city",
          evidence_type: "market_metric",
          subject_type: "artist",
          metric_name: "city_affinity_lagos",
          metric_value: 94,
          metric_unit: "score",
          lens: "market",
        },
      ],
    });

    expect(packet.packet_type).toBe("setup");
    expect(packet.profile_projection_json.kpi_profile.fanbaseVsEngagement.relationship).toBe("engagement_stronger");
    expect(packet.signal_map_json.map((signal) => signal.signal_type)).toEqual(
      expect.arrayContaining(["Attention", "Discovery", "Market"]),
    );
    expect(packet.asset_reads_json[0]).toMatchObject({
      asset_type: "track",
      asset_id: "call-me",
      asset_name: "Call Me",
    });
    expect(packet.internal_only_json.playbooks_applied).toEqual(
      expect.arrayContaining(["social_contagion", "ar_breakout", "cultural_expansion", "no_engine"]),
    );
    expect(packet.mission_seed_json.primary_mission_direction).not.toMatch(/conversion-focused mission from the strongest attention signal|source readiness before scaling/i);
    expect(packet.mission_seed_json.mission_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "Audience And Fan Development",
          direction: expect.stringContaining("Call Me"),
        }),
        expect.objectContaining({
          domain: "Market Expansion",
          direction: expect.stringContaining("Lagos"),
        }),
        expect.objectContaining({
          domain: "Data Sovereignty And Intelligence",
        }),
      ]),
    );
    expect(packet.mission_seed_json.do_not_generate_missions_for).toEqual(
      expect.arrayContaining(["generic strongest-song promotion", "playlist-save busywork"]),
    );
    expect(JSON.stringify(packet.executive_read_json)).not.toMatch(/playbook|openai|provider|prompt/i);

    const validation = validateManagerIntelligencePacket(packet);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("projects packet KPI, signal, asset, and market reads into the Today's Brief context", () => {
    const managerPacket = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      packetType: "setup",
      profile: {
        display_name: "Mavo",
        stage: "Developing",
        home_market: "Lagos",
        genres: ["afrobeats"],
        current_goal: "Grow the current single",
      },
      musicItems: [{ id: "call-me", title: "Call Me", released_at: "2024-01-01T00:00:00.000Z" }],
      musicProjects: [{ id: "project-1", title: "Mavo EP", released_at: "2024-02-01T00:00:00.000Z" }],
      evidenceRows: [
        {
          id: "ev_artist_score",
          evidence_type: "platform_metric",
          subject_type: "artist",
          metric_name: "chartmetric_artist_score",
          metric_value: 92,
          metric_unit: "score",
        },
        {
          id: "ev_city",
          evidence_type: "market_metric",
          subject_type: "artist",
          metric_name: "city_affinity_lagos",
          metric_value: 94,
          metric_unit: "score",
          lens: "market",
        },
        {
          id: "ev_call_me",
          evidence_type: "public_social_metric",
          subject_type: "music_item",
          subject_id: "call-me",
          subject_label: "Call Me",
          metric_name: "tiktok_track_posts",
          metric_value: 1_500_000,
          metric_unit: "posts",
          lens: "social_attention",
        },
      ],
    });

    const reads = buildManagerEvidenceReads(managerPacket);
    expect(reads.map((read) => read.category)).toEqual(expect.arrayContaining(["kpi", "signal", "asset", "market"]));
    expect(reads.find((read) => read.label === "Artist Score")?.read).toContain("broad artist strength");
    expect(reads.find((read) => read.label === "Call Me" && read.category === "asset")?.read).toContain("strongest management-relevant asset");
    expect(reads.every((read) => read.evidenceIds.length > 0)).toBe(true);

    const modelPacket = buildTodaysBriefModelPacket({
      profile: {
        artistName: "Mavo",
        genres: ["afrobeats"],
        socialHandles: {},
      },
      workingCatalog: {
        scopeLabel: "working catalog in view",
        projectCount: 1,
        songCount: 1,
        latestProjectTitles: ["Mavo EP"],
        focusSongTitles: ["Call Me"],
        note: "Current music in view.",
      },
      intelligenceSnapshotInputs: [],
      derivedInsights: [],
      sourceLimits: [],
      generatedFor: "setup",
    }, managerPacket);

    expect(modelPacket.managerIntelligence.kpiRead.artistScore.read).toContain("broad artist strength");
    expect(modelPacket.managerEvidenceReads.length).toBeGreaterThanOrEqual(4);
    expect(modelPacket.managerIntelligence.internalPlaybooksApplied).toEqual(
      expect.arrayContaining(["social_contagion", "cultural_expansion"]),
    );
    expect(modelPacket.managerIntelligence.domainReads).toEqual(expect.any(Array));
    expect(modelPacket.managerIntelligence.publicContext).toEqual(expect.any(Array));
    expect(modelPacket.managerIntelligence.openDecisions).toEqual(expect.any(Array));
    expect(modelPacket.managerIntelligence.doNotDo).toEqual(expect.any(Array));
  });

  it("caps the model-facing setup brief packet so OpenAI does not receive the full intelligence archive", () => {
    const managerPacket = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      packetType: "setup",
      profile: {
        display_name: "Mavo",
        stage: "Developing",
        home_market: "Lagos",
        genres: ["afrobeats"],
      },
      musicItems: Array.from({ length: 12 }, (_, index) => ({
        id: `song-${index}`,
        title: `Song ${index}`,
        released_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      })),
      musicProjects: [],
      evidenceRows: Array.from({ length: 36 }, (_, index) => ({
        id: `ev-${index}`,
        evidence_type: "public_social_metric",
        subject_type: "music_item",
        subject_id: `song-${index % 12}`,
        subject_label: `Song ${index % 12}`,
        metric_name: index % 2 === 0 ? "tiktok_track_posts" : "shazam_count",
        metric_value: 1000 + index,
        metric_unit: "count",
        lens: "social_attention",
      })),
    });

    const modelPacket = buildTodaysBriefModelPacket({
      profile: {
        artistName: "Mavo",
        genres: ["afrobeats"],
        socialHandles: {},
      },
      workingCatalog: {
        scopeLabel: "working catalog in view",
        projectCount: 0,
        songCount: 12,
        latestProjectTitles: [],
        focusSongTitles: Array.from({ length: 12 }, (_, index) => `Song ${index}`),
        note: "Current music in view.",
      },
      intelligenceSnapshotInputs: [],
      derivedInsights: [],
      sourceLimits: [],
      generatedFor: "setup",
    }, managerPacket);

    expect(modelPacket.workingCatalog.focusSongTitles).toHaveLength(6);
    expect(modelPacket.managerEvidenceReads.length).toBeLessThanOrEqual(8);
    expect(modelPacket.managerIntelligence.signalMap.length).toBeLessThanOrEqual(8);
    expect(modelPacket.managerIntelligence.assetReads.length).toBeLessThanOrEqual(6);
    expect(JSON.stringify(modelPacket).length).toBeLessThan(JSON.stringify(managerPacket).length);
  });

  it("turns track score and popularity evidence into model-visible track score reads", () => {
    const managerPacket = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      packetType: "setup",
      profile: {
        display_name: "Rema",
        stage: "Mainstream",
        home_market: "Lagos",
        genres: ["afrobeats"],
      },
      musicItems: [{ id: "calm-down", title: "Calm Down", released_at: "2022-02-11T00:00:00.000Z" }],
      musicProjects: [],
      evidenceRows: [
        {
          id: "ev_track_score",
          evidence_type: "platform_metric",
          subject_type: "music_item",
          subject_id: "calm-down",
          subject_label: "Calm Down",
          metric_name: "chartmetric_track_score",
          metric_value: 96,
          metric_unit: "score",
        },
        {
          id: "ev_spotify_popularity",
          evidence_type: "platform_metric",
          subject_type: "music_item",
          subject_id: "calm-down",
          subject_label: "Calm Down",
          metric_name: "spotify_popularity",
          metric_value: 89,
          metric_unit: "score",
        },
      ],
    });

    expect(managerPacket.kpi_read_json.trackScoreReads).toEqual([
      expect.objectContaining({
        trackName: "Calm Down",
        chartmetricTrackScore: 96,
        spotifyPopularity: 89,
        read: expect.stringMatching(/Calm Down|96|89/),
      }),
    ]);
    expect(buildManagerEvidenceReads(managerPacket)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Calm Down",
          category: "signal",
          evidenceIds: expect.arrayContaining(["ev_track_score", "ev_spotify_popularity"]),
        }),
      ]),
    );
  });

  it("projects saved public web evidence into manager evidence reads for personalized setup briefs", () => {
    const managerPacket = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      packetType: "setup",
      profile: {
        display_name: "Rema",
        stage: "Mainstream",
        home_market: "Lagos",
        genres: ["afrobeats"],
      },
      musicItems: [],
      musicProjects: [],
      evidenceRows: [
        {
          id: "ev_public_interview",
          source: "public_web",
          source_kind: "public_web",
          evidence_type: "public_career_context",
          subject_type: "artist",
          subject_id: "artist-1",
          subject_label: "Recent interview described Rema's global Afrobeats positioning",
          metric_name: "public_context",
          metric_value: 1,
          metric_unit: "instance",
          lens: "public_context",
          raw_ref: "https://example.com/rema-interview",
          provenance: "example.com",
          limitation: "Public context only.",
        } as any,
      ],
    });

    const reads = buildManagerEvidenceReads(managerPacket);
    expect(reads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringMatching(/interview|public/i),
          category: "management",
          read: expect.stringMatching(/Rema|global Afrobeats|public/i),
          evidenceIds: ["ev_public_interview"],
        }),
      ]),
    );
  });

  it("builds an artist operating packet from career, rights, sync, team, reputation, and public web context without defaulting to private analytics", () => {
    const packet = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      packetType: "manual_refresh",
      profile: {
        display_name: "Sable Day",
        stage: "Mid-Level",
        home_market: "London",
        genres: ["alt-pop"],
        artist_direction: "Make the next era feel more cinematic without chasing short-form trends",
      },
      musicItems: [
        { id: "north-star", title: "North Star", released_at: "2026-03-01T00:00:00.000Z" },
        { id: "glass-house", title: "Glass House", released_at: "2026-04-01T00:00:00.000Z" },
      ],
      musicProjects: [{ id: "project-era", title: "Blue Room", released_at: "2026-02-01T00:00:00.000Z" }],
      evidenceRows: [
        {
          id: "ev_interview",
          source: "public_web",
          source_kind: "public_web",
          evidence_type: "public_career_context",
          subject_type: "artist",
          subject_label: "Sable Day",
          metric_name: "press_interview_artist_positioning",
          lens: "public_context positioning narrative interview",
          raw_ref: "https://example.com/sable-day-blue-room-interview",
          limitation: "Public article context; not private analytics.",
        } as any,
        {
          id: "ev_sync",
          evidence_type: "partnership_signal",
          subject_type: "music_item",
          subject_id: "north-star",
          subject_label: "North Star",
          metric_name: "sync_pitch_interest",
          lens: "sync_deal brand partnership pitch",
          limitation: "Public/contextual opportunity signal only.",
        },
        {
          id: "ev_rights",
          evidence_type: "rights_risk",
          subject_type: "music_item",
          subject_id: "north-star",
          subject_label: "North Star",
          metric_name: "split_sheet_missing",
          lens: "rights ownership blocker",
          limitation: "Missing split documentation blocks external pitching.",
        },
        {
          id: "ev_team",
          evidence_type: "team_capacity",
          subject_type: "artist",
          subject_label: "Sable Day",
          metric_name: "approval_chain_blocked",
          lens: "team_operations accountability owner",
        },
        {
          id: "ev_reputation",
          evidence_type: "public_risk",
          subject_type: "artist",
          subject_label: "Sable Day",
          metric_name: "sensitive_public_context",
          lens: "reputation wellbeing public risk sensitive",
        },
      ],
    }) as any;

    expect(packet.domain_reads_json.map((read: any) => read.domain)).toEqual(
      expect.arrayContaining([
        "Career Architecture",
        "Artist Positioning And Narrative",
        "Partnerships, Brand, Sync, And Deals",
        "Rights, Finance, And Business Affairs",
        "Team, Operations, And Capacity",
        "Reputation, Crisis, And Wellbeing",
        "Public Career Context",
      ]),
    );
    expect(packet.public_context_json).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence_id: "ev_interview",
          url: "https://example.com/sable-day-blue-room-interview",
          limitation: expect.stringMatching(/not private analytics/i),
        }),
      ]),
    );
    expect(packet.mission_seed_json.mission_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pattern_key: "artist_positioning" }),
        expect.objectContaining({ pattern_key: "sync_deal_readiness" }),
        expect.objectContaining({ pattern_key: "rights_cleanup" }),
        expect.objectContaining({ pattern_key: "team_operations" }),
        expect.objectContaining({ pattern_key: "reputation_wellbeing" }),
      ]),
    );
    expect(packet.mission_seed_json.do_not_generate_missions_for).toEqual(
      expect.arrayContaining([
        "default private-analytics upload",
        "save/follow conversion without conversion evidence",
      ]),
    );
    expect(JSON.stringify(packet)).not.toMatch(/private analytics are still missing|upload saves|source-of-stream/i);
    expect(packet.strategic_diagnosis_json.current_priority).not.toBe("conversion");

    const validation = validateManagerIntelligencePacket(packet);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("treats attention-only evidence as a public attention question instead of a saves/follows mission", () => {
    const packet = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      packetType: "daily",
      profile: {
        display_name: "Mavo",
        stage: "Emerging",
        home_market: "Lagos",
        genres: ["afrobeats"],
        current_goal: "Build a repeatable audience without over-spending",
      },
      musicItems: [{ id: "call-me", title: "Call Me", released_at: "2026-05-01T00:00:00.000Z" }],
      musicProjects: [],
      evidenceRows: [
        {
          id: "ev_tiktok",
          evidence_type: "public_social_metric",
          subject_type: "music_item",
          subject_id: "call-me",
          subject_label: "Call Me",
          metric_name: "tiktok_track_posts",
          metric_value: 1_500_000,
          metric_unit: "posts",
          lens: "social_attention",
        },
      ],
    }) as any;

    const serialized = JSON.stringify(packet);
    expect(packet.strategic_diagnosis_json.current_priority).toBe("attention validation");
    expect(packet.mission_seed_json.mission_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pattern_key: "creator_content_validation",
          direction: expect.stringMatching(/attention|repeatable/i),
        }),
      ]),
    );
    expect(serialized).not.toMatch(/saves, follows|save\/follow|source-of-stream|private analytics/i);
  });

  it("diagnoses Blaqbonez and Chanel as a feature-leverage career condition before any creator pilot", () => {
    const packet = buildManagerIntelligencePacket({
      accountId: "account-1",
      artistWorkspaceId: "workspace-blaqbonez",
      artistId: "artist-blaqbonez",
      packetType: "setup",
      profile: {
        display_name: "Blaqbonez",
        stage: "Established",
        home_market: "Nigeria",
        genres: ["rap", "afrobeats"],
        artist_direction: "Use Chanel without losing Blaqbonez's rap-rooted identity or personality-led fan ownership",
      },
      musicItems: [{ id: "chanel", title: "Chanel (feat. Asake)", released_at: "2026-05-01T00:00:00.000Z" }],
      musicProjects: [{ id: "no-excuses", title: "No Excuses", released_at: "2025-01-01T00:00:00.000Z" }],
      evidenceRows: [
        {
          id: "ev_chanel_attention",
          evidence_type: "public_social_metric",
          subject_type: "music_item",
          subject_id: "chanel",
          subject_label: "Chanel (feat. Asake)",
          metric_name: "tiktok_track_posts",
          metric_value: 120_000,
          metric_unit: "posts",
          lens: "social_attention feature collaboration asake",
        },
        {
          id: "ev_asake_feature",
          evidence_type: "collaboration_signal",
          subject_type: "music_item",
          subject_id: "chanel",
          subject_label: "Chanel (feat. Asake)",
          metric_name: "asake_feature_leverage",
          lens: "collaboration feature leverage overshadowing mainstream crossover",
          limitation: "Public collaboration context; does not prove artist-level attachment.",
        },
        {
          id: "ev_public_identity",
          source: "public_web",
          source_kind: "public_web",
          evidence_type: "public_career_context",
          subject_type: "artist",
          subject_label: "Blaqbonez",
          metric_name: "public_context_artist_identity",
          lens: "public_context personality humor rap credibility mainstream crossover",
          raw_ref: "https://example.com/blaqbonez-profile",
          limitation: "Public web context only.",
        } as any,
        {
          id: "ev_nigeria_market",
          evidence_type: "market_metric",
          subject_type: "artist",
          subject_label: "Blaqbonez",
          metric_name: "city_affinity_lagos",
          metric_value: 91,
          metric_unit: "score",
          lens: "market nigeria lagos",
        },
      ],
    }) as any;

    expect(packet.strategic_diagnosis_json.dominant_conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ condition_key: "feature_leverage_moment" }),
        expect.objectContaining({ condition_key: "feature_overshadowing_risk" }),
        expect.objectContaining({ condition_key: "artist_identity_gap" }),
      ]),
    );
    expect(packet.strategic_diagnosis_json.primary_career_condition.condition_key).toBe("feature_leverage_moment");
    expect(packet.mission_seed_json.mission_implications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          career_condition: "feature_leverage_moment",
          best_mission_families: expect.arrayContaining(["Collaboration Strategy", "Artist Identity", "Catalog Song Asset", "PR Narrative"]),
          bad_mission_families: expect.arrayContaining(["Generic TikTok Conversion", "Smart URL Setup"]),
          possible_missions: expect.arrayContaining([
            "Turn the Asake feature into Blaqbonez-owned leverage",
            "Build Blaqbonez's next collaborator map",
          ]),
        }),
      ]),
    );
    expect(packet.conversation_memory_seed_json.artist_personality.primary_traits).toEqual(
      expect.arrayContaining(["humor", "confidence", "internet-native", "rap-rooted"]),
    );
    expect(packet.conversation_memory_seed_json.mission_guardrails).toEqual(
      expect.arrayContaining([
        "Do not let features become bigger than artist identity.",
        "Do not make every mission a creator pilot.",
        "Do not treat content engagement as artist attachment.",
      ]),
    );
  });
});
