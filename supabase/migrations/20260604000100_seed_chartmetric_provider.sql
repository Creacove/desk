-- Seed Chartmetric as provider reference data.
--
-- Chartmetric edge functions run with the authenticated user's scoped client
-- after membership checks. Runtime users may read source_providers, but they
-- must not create provider reference rows. Keeping the provider seeded avoids
-- hidden queue failures when Spotify setup asks Chartmetric to enrich catalog
-- records.

insert into public.source_providers (
  provider_key,
  display_name,
  source_kind,
  default_confidence,
  claim_boundaries
)
values (
  'chartmetric',
  'Chartmetric',
  'third_party_provider',
  'medium',
  '{
    "supports": [
      "artist intelligence",
      "track intelligence",
      "project intelligence",
      "playlist movement",
      "chart movement",
      "platform metrics",
      "public social context"
    ],
    "forbidden": [
      "rights certainty",
      "royalty revenue without royalty statements",
      "campaign ROI without spend and conversion proof",
      "private Spotify saves",
      "source-of-stream"
    ]
  }'::jsonb
)
on conflict (provider_key) do update
set display_name = excluded.display_name,
    source_kind = excluded.source_kind,
    default_confidence = excluded.default_confidence,
    claim_boundaries = excluded.claim_boundaries;
