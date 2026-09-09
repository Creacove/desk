-- Song Split Agreement V1.
--
-- This is a new legal-facing record.  The legacy music_splits publishing and
-- master columns remain historical data and are deliberately not relabelled or
-- copied into the three signed rights columns below.

create extension if not exists pgcrypto;

create type public.split_agreement_version_status as enum (
  'draft', 'ready_for_signature', 'locking', 'ready_to_send',
  'sent_for_signature', 'partially_signed', 'correction_requested',
  'finalizing', 'finalizing_failed', 'executed', 'voided', 'superseded',
  'disputed', 'expired'
);

create type public.split_signature_request_status as enum (
  'not_invited', 'sent', 'delivered', 'opened', 'verified', 'signed',
  'failed', 'expired', 'revoked', 'superseded'
);

create type public.split_agreement_event_type as enum (
  'draft_changed', 'version_locked', 'signature_requests_sent',
  'delivery_failed', 'request_opened', 'otp_verified',
  'correction_requested', 'signature_submitted', 'reminder_sent',
  'agreement_voided', 'finalization_started', 'finalization_failed',
  'agreement_executed', 'artifact_downloaded', 'version_discarded',
  'dispute_opened'
);

create type public.split_agreement_artifact_kind as enum (
  'pre_signature_pdf', 'final_pdf', 'execution_certificate',
  'evidence_manifest', 'signature_vector', 'signature_image'
);

create type public.split_agreement_participant_type as enum ('individual', 'organisation');
create type public.split_agreement_signing_authority as enum (
  'self', 'authorised_organisation_representative', 'parent_guardian'
);
create type public.split_agreement_participant_role as enum (
  'composer', 'lyricist', 'songwriter', 'arranger', 'producer', 'performer',
  'featured_artist', 'session_musician', 'engineer', 'publisher', 'label', 'other'
);
create type public.split_agreement_non_signing_reason as enum (
  'credit_only', 'represented_by_organisation_signer',
  'supporting_signed_document_on_file'
);
create type public.split_agreement_participant_signature_status as enum (
  'not_signed', 'signed', 'correction_requested', 'expired', 'superseded'
);
create type public.split_signature_kind as enum ('participant', 'coordinator');

create sequence public.split_agreement_document_id_seq;

create or replace function public.next_split_agreement_document_id()
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  return 'OS-SA-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.split_agreement_document_id_seq')::text, 6, '0');
end;
$$;

create table public.split_agreements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid not null references public.music_items(id) on delete cascade,
  music_split_id uuid not null references public.music_splits(id) on delete restrict,
  status public.split_agreement_version_status not null default 'draft',
  current_draft_version_number integer,
  current_draft_version_id uuid,
  latest_executed_version_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, music_item_id)
);

create table public.split_agreement_versions (
  id uuid primary key default gen_random_uuid(),
  split_agreement_id uuid not null references public.split_agreements(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid not null references public.music_items(id) on delete cascade,
  music_split_id uuid not null references public.music_splits(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status public.split_agreement_version_status not null default 'draft',
  canonical_snapshot jsonb not null check (jsonb_typeof(canonical_snapshot) = 'object'),
  canonical_snapshot_sha256 text not null check (canonical_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  terms_version text not null,
  consent_version text not null,
  document_id text not null default public.next_split_agreement_document_id(),
  pre_signature_pdf_asset_id uuid,
  pre_signature_sha256 text not null check (pre_signature_sha256 ~ '^[0-9a-f]{64}$'),
  final_pdf_asset_id uuid,
  final_pdf_sha256 text,
  execution_certificate_asset_id uuid,
  execution_certificate_sha256 text,
  evidence_manifest_asset_id uuid,
  evidence_manifest_sha256 text,
  locked_at timestamptz,
  sent_at timestamptz,
  finalized_at timestamptz,
  executed_at timestamptz,
  voided_at timestamptz,
  superseded_at timestamptz,
  discarded_at timestamptz,
  coordinator_participant_id uuid,
  coordinator_name text,
  coordinator_role text,
  external_coordinator_name text,
  external_coordinator_email text,
  external_coordinator_organisation text,
  external_coordinator_authority text,
  coordinator_signature_required boolean not null default true,
  coordinator_signature_id uuid,
  lock_reason text,
  correction_reason text,
  finalization_error text,
  void_reason text,
  supersede_reason text,
  discarded_reason text,
  lock_idempotency_key text,
  lock_receipt_id text not null default ('OS-SA-LOCK-' || replace(gen_random_uuid()::text, '-', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (split_agreement_id, version_number),
  unique (id, version_number),
  unique (document_id),
  unique (lock_idempotency_key),
  check (document_id ~ '^OS-SA-[0-9]{4}-[0-9]{6}$'),
  check (final_pdf_sha256 is null or final_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  check (execution_certificate_sha256 is null or execution_certificate_sha256 ~ '^[0-9a-f]{64}$'),
  check (evidence_manifest_sha256 is null or evidence_manifest_sha256 ~ '^[0-9a-f]{64}$')
);

create table public.split_agreement_participants (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.split_agreement_versions(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  legal_name text not null,
  stage_name text,
  participant_type public.split_agreement_participant_type not null,
  signing_authority public.split_agreement_signing_authority not null,
  parent_guardian_legal_name text,
  parent_guardian_relationship text,
  organisation_name text,
  signing_capacity text,
  participant_roles public.split_agreement_participant_role[] not null default '{}',
  other_role text,
  email text not null,
  telephone text not null,
  rights_society_member_id text,
  ipi_cae_number text,
  performing numeric(5,2) check (performing is null or performing between 0 and 100),
  mechanical numeric(5,2) check (mechanical is null or mechanical between 0 and 100),
  neighbouring numeric(5,2) check (neighbouring is null or neighbouring between 0 and 100),
  signature_required boolean not null default true,
  non_signing_reason public.split_agreement_non_signing_reason,
  signature_status public.split_agreement_participant_signature_status not null default 'not_signed',
  display_order integer not null default 0 check (display_order >= 0),
  contact_metadata jsonb not null default '{}'::jsonb,
  identifiers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, id),
  check (signature_required or non_signing_reason is not null),
  check (signature_required or coalesce(performing, 0) = 0),
  check (signature_required or coalesce(mechanical, 0) = 0),
  check (signature_required or coalesce(neighbouring, 0) = 0),
  check (signature_required or (performing is null and mechanical is null and neighbouring is null) or non_signing_reason is not null),
  check (participant_type <> 'organisation' or (organisation_name is not null and signing_capacity is not null)),
  check (signing_authority <> 'parent_guardian' or (parent_guardian_legal_name is not null and parent_guardian_relationship is not null)),
  check (cardinality(participant_roles) > 0)
);

create table public.split_signature_requests (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.split_agreement_versions(id) on delete cascade,
  participant_id uuid not null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  capability_token_hash text not null check (capability_token_hash ~ '^[0-9a-f]{64}$'),
  otp_hash text check (otp_hash is null or otp_hash ~ '^[0-9a-f]{64}$'),
  otp_expires_at timestamptz,
  otp_attempt_count integer not null default 0 check (otp_attempt_count >= 0),
  status public.split_signature_request_status not null default 'not_invited',
  provider_name text,
  provider_delivery_id text,
  provider_delivery_status text,
  provider_failure_code text,
  failure_details text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  verified_at timestamptz,
  signed_at timestamptz,
  failed_at timestamptz,
  expired_at timestamptz,
  revoked_at timestamptz,
  superseded_at timestamptz,
  expires_at timestamptz not null,
  request_expires_at timestamptz,
  cooldown_until timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (version_id, participant_id)
    references public.split_agreement_participants(version_id, id) on delete cascade,
  unique (idempotency_key)
);

create table public.split_agreement_artifacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  version_id uuid not null references public.split_agreement_versions(id) on delete cascade,
  kind public.split_agreement_artifact_kind not null,
  storage_bucket text not null default 'split-agreement-artifacts',
  storage_key text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null,
  byte_length bigint not null check (byte_length >= 0),
  immutable boolean not null default true check (immutable),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_key),
  unique (id, version_id)
);

create table public.split_signatures (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.split_agreement_versions(id) on delete cascade,
  participant_id uuid,
  signature_request_id uuid,
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  kind public.split_signature_kind not null default 'participant',
  pre_signature_document_hash text not null check (pre_signature_document_hash ~ '^[0-9a-f]{64}$'),
  signature_vector_asset_id uuid not null,
  rendered_signature_image_asset_id uuid not null,
  signature_asset_hash text not null check (signature_asset_hash ~ '^[0-9a-f]{64}$'),
  printed_signer_name text not null,
  signing_authority public.split_agreement_signing_authority,
  parent_guardian_legal_name text,
  parent_guardian_relationship text,
  organisation_name text,
  signing_capacity text,
  organisation_or_capacity text,
  consent_version text not null,
  accepted_consent_text text not null,
  signed_at timestamptz not null,
  display_timezone text not null,
  hashed_ip text not null check (hashed_ip ~ '^[0-9a-f]{64}$'),
  hashed_user_agent text not null check (hashed_user_agent ~ '^[0-9a-f]{64}$'),
  receipt_id text not null default ('OS-SA-REC-' || replace(gen_random_uuid()::text, '-', '')),
  provider_event_id text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  check (
    (kind = 'participant' and participant_id is not null and signature_request_id is not null)
    or (kind = 'coordinator')
  ),
  check (kind = 'participant' or signature_request_id is null),
  check (kind = 'coordinator' or signing_authority is not null),
  unique (idempotency_key),
  unique (receipt_id)
);

create table public.split_agreement_events (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.split_agreements(id) on delete cascade,
  version_id uuid references public.split_agreement_versions(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  event_type public.split_agreement_event_type not null,
  triggered_by_type text not null check (triggered_by_type in ('workspace_member', 'participant', 'service', 'system')),
  triggered_by_id uuid,
  participant_id uuid,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (version_id, idempotency_key)
);

alter table public.split_agreement_events
  add constraint split_agreement_events_participant_fk
  foreign key (version_id, participant_id)
  references public.split_agreement_participants(version_id, id) on delete restrict;

alter table public.split_agreements
  add constraint split_agreements_current_draft_version_fk
  foreign key (current_draft_version_id) references public.split_agreement_versions(id) on delete set null;

alter table public.split_agreement_versions
  add constraint split_agreement_versions_coordinator_fk
  foreign key (id, coordinator_participant_id)
  references public.split_agreement_participants(version_id, id) on delete restrict;

alter table public.split_agreement_versions
  add constraint split_agreement_versions_pre_signature_artifact_fk
  foreign key (pre_signature_pdf_asset_id) references public.split_agreement_artifacts(id) on delete restrict;

alter table public.split_agreement_versions
  add constraint split_agreement_versions_final_artifact_fk
  foreign key (final_pdf_asset_id) references public.split_agreement_artifacts(id) on delete restrict;

alter table public.split_agreement_versions
  add constraint split_agreement_versions_certificate_artifact_fk
  foreign key (execution_certificate_asset_id) references public.split_agreement_artifacts(id) on delete restrict;

alter table public.split_agreement_versions
  add constraint split_agreement_versions_manifest_artifact_fk
  foreign key (evidence_manifest_asset_id) references public.split_agreement_artifacts(id) on delete restrict;

alter table public.split_signatures
  add constraint split_signatures_request_fk
  foreign key (signature_request_id) references public.split_signature_requests(id) on delete restrict;

alter table public.split_signatures
  add constraint split_signatures_participant_fk
  foreign key (version_id, participant_id)
  references public.split_agreement_participants(version_id, id) on delete restrict;

alter table public.split_signatures
  add constraint split_signatures_vector_artifact_fk
  foreign key (signature_vector_asset_id) references public.split_agreement_artifacts(id) on delete restrict;

alter table public.split_signatures
  add constraint split_signatures_image_artifact_fk
  foreign key (rendered_signature_image_asset_id) references public.split_agreement_artifacts(id) on delete restrict;

alter table public.split_agreement_versions
  add constraint split_agreement_versions_coordinator_signature_fk
  foreign key (coordinator_signature_id) references public.split_signatures(id) on delete restrict;

alter table public.split_agreements
  add constraint split_agreements_latest_executed_version_fk
  foreign key (latest_executed_version_id) references public.split_agreement_versions(id) on delete set null;

create unique index split_signature_requests_current_participant_idx
on public.split_signature_requests(version_id, participant_id)
where status in ('not_invited', 'sent', 'delivered', 'opened', 'verified');

create unique index split_signatures_participant_once_idx
on public.split_signatures(version_id, participant_id)
where kind = 'participant';

create unique index split_signatures_coordinator_once_idx
on public.split_signatures(version_id)
where kind = 'coordinator';

create index split_agreements_scope_idx
on public.split_agreements(account_id, artist_workspace_id, artist_id, music_item_id, status);
create index split_agreement_versions_status_idx
on public.split_agreement_versions(split_agreement_id, status, version_number desc);
create index split_agreement_participants_version_idx
on public.split_agreement_participants(version_id, display_order, id);
create index split_signature_requests_status_idx
on public.split_signature_requests(version_id, status, expires_at);
create index split_signatures_version_idx
on public.split_signatures(version_id, kind, signed_at);
create index split_agreement_events_version_idx
on public.split_agreement_events(agreement_id, version_id, occurred_at desc);
create index split_agreement_artifacts_version_idx
on public.split_agreement_artifacts(version_id, kind, created_at desc);

drop trigger if exists split_agreements_set_updated_at on public.split_agreements;
create trigger split_agreements_set_updated_at before update on public.split_agreements
for each row execute function public.set_updated_at();
drop trigger if exists split_agreement_versions_set_updated_at on public.split_agreement_versions;
create trigger split_agreement_versions_set_updated_at before update on public.split_agreement_versions
for each row execute function public.set_updated_at();
drop trigger if exists split_agreement_participants_set_updated_at on public.split_agreement_participants;
create trigger split_agreement_participants_set_updated_at before update on public.split_agreement_participants
for each row execute function public.set_updated_at();
drop trigger if exists split_signature_requests_set_updated_at on public.split_signature_requests;
create trigger split_signature_requests_set_updated_at before update on public.split_signature_requests
for each row execute function public.set_updated_at();

create or replace function public._split_agreement_scope_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
begin
  if new.current_draft_version_id is not null and not exists (
    select 1 from public.split_agreement_versions
    where id = new.current_draft_version_id and split_agreement_id = new.id
  ) then
    raise exception 'current draft version is not bound to agreement';
  end if;
  if new.latest_executed_version_id is not null and not exists (
    select 1 from public.split_agreement_versions
    where id = new.latest_executed_version_id and split_agreement_id = new.id and status = 'executed'
  ) then
    raise exception 'latest executed version is not bound to agreement';
  end if;
  return new;
end;
$$;

create or replace function public._split_agreement_version_scope_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
declare
  v_artifact public.split_agreement_artifacts%rowtype;
  v_signature public.split_signatures%rowtype;
begin
  if new.coordinator_participant_id is not null and not exists (
    select 1 from public.split_agreement_participants
    where id = new.coordinator_participant_id and version_id = new.id
  ) then
    raise exception 'coordinator participant is not bound to version';
  end if;
  if new.coordinator_signature_id is not null then
    select * into v_signature from public.split_signatures
    where id = new.coordinator_signature_id and version_id = new.id and kind = 'coordinator';
    if not found then raise exception 'coordinator signature is not bound to version'; end if;
  end if;
  if new.pre_signature_pdf_asset_id is not null then
    select * into v_artifact from public.split_agreement_artifacts
    where id = new.pre_signature_pdf_asset_id and version_id = new.id and kind = 'pre_signature_pdf';
    if not found or v_artifact.sha256 <> new.pre_signature_sha256 then raise exception 'pre-signature artifact is not bound to version or hash'; end if;
  end if;
  if new.final_pdf_asset_id is not null then
    select * into v_artifact from public.split_agreement_artifacts
    where id = new.final_pdf_asset_id and version_id = new.id and kind = 'final_pdf';
    if not found or new.final_pdf_sha256 is null or v_artifact.sha256 <> new.final_pdf_sha256 then raise exception 'final PDF artifact is not bound to version or hash'; end if;
  end if;
  if new.execution_certificate_asset_id is not null then
    select * into v_artifact from public.split_agreement_artifacts
    where id = new.execution_certificate_asset_id and version_id = new.id and kind = 'execution_certificate';
    if not found or new.execution_certificate_sha256 is null or v_artifact.sha256 <> new.execution_certificate_sha256 then raise exception 'execution certificate artifact is not bound to version or hash'; end if;
  end if;
  if new.evidence_manifest_asset_id is not null then
    select * into v_artifact from public.split_agreement_artifacts
    where id = new.evidence_manifest_asset_id and version_id = new.id and kind = 'evidence_manifest';
    if not found or new.evidence_manifest_sha256 is null or v_artifact.sha256 <> new.evidence_manifest_sha256 then raise exception 'evidence manifest artifact is not bound to version or hash'; end if;
  end if;
  return new;
end;
$$;

create or replace function public._split_signatures_scope_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
begin
  if new.signature_request_id is not null and not exists (
    select 1 from public.split_signature_requests
    where id = new.signature_request_id and version_id = new.version_id and participant_id = new.participant_id
  ) then
    raise exception 'signature request is not bound to signature version and participant';
  end if;
  if new.signature_vector_asset_id is not null and not exists (
    select 1 from public.split_agreement_artifacts
    where id = new.signature_vector_asset_id and version_id = new.version_id and kind = 'signature_vector'
  ) then
    raise exception 'signature vector artifact is not bound to signature version';
  end if;
  if new.rendered_signature_image_asset_id is not null and not exists (
    select 1 from public.split_agreement_artifacts
    where id = new.rendered_signature_image_asset_id and version_id = new.version_id and kind = 'signature_image'
  ) then
    raise exception 'signature image artifact is not bound to signature version';
  end if;
  if new.kind = 'participant' and (new.participant_id is null or new.signature_request_id is null) then
    raise exception 'participant signature references are required';
  end if;
  if new.kind = 'coordinator' and new.signature_request_id is not null then
    raise exception 'coordinator signatures cannot reference participant requests';
  end if;
  return new;
end;
$$;

create or replace function public._split_agreement_artifacts_scope_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
begin
  if new.storage_bucket <> 'split-agreement-artifacts'
     or new.storage_key not like new.account_id::text || '/%' then
    raise exception 'split agreement artifact storage key must be scoped to its account folder';
  end if;
  if not exists (
    select 1 from public.split_agreement_versions
    where id = new.version_id and account_id = new.account_id
      and artist_workspace_id = new.artist_workspace_id and artist_id = new.artist_id
  ) then
    raise exception 'split agreement artifact is not bound to version scope';
  end if;
  return new;
end;
$$;

create or replace function public._split_agreement_events_scope_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
begin
  if new.version_id is not null and not exists (
    select 1 from public.split_agreement_versions
    where id = new.version_id and split_agreement_id = new.agreement_id
      and account_id = new.account_id and artist_workspace_id = new.artist_workspace_id
      and artist_id = new.artist_id
  ) then
    raise exception 'split agreement event is not bound to agreement scope';
  end if;
  if new.participant_id is not null and (new.version_id is null or not exists (
    select 1 from public.split_agreement_participants
    where id = new.participant_id and version_id = new.version_id
  )) then
    raise exception 'split agreement event participant is not bound to version';
  end if;
  return new;
end;
$$;

create trigger split_agreements_scope_guard
before insert or update on public.split_agreements
for each row execute function public._split_agreement_scope_guard();
create trigger split_agreement_versions_scope_guard
before insert or update on public.split_agreement_versions
for each row execute function public._split_agreement_version_scope_guard();
create trigger split_signatures_scope_guard
before insert or update on public.split_signatures
for each row execute function public._split_signatures_scope_guard();
create trigger split_agreement_artifacts_scope_guard
before insert or update on public.split_agreement_artifacts
for each row execute function public._split_agreement_artifacts_scope_guard();
create trigger split_agreement_events_scope_guard
before insert or update on public.split_agreement_events
for each row execute function public._split_agreement_events_scope_guard();

create or replace function public._split_agreement_version_transition_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
begin
  if old.locked_at is not null and new.status = 'draft' then
    raise exception 'locked split agreement versions cannot revert to draft';
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'ready_for_signature') or
      (old.status = 'ready_for_signature' and new.status = 'locking') or
      (old.status = 'locking' and new.status in ('ready_to_send', 'draft')) or
      (old.status = 'ready_to_send' and new.status in ('sent_for_signature', 'partially_signed', 'finalizing', 'correction_requested', 'voided', 'superseded', 'draft')) or
      (old.status = 'sent_for_signature' and new.status in ('partially_signed', 'correction_requested', 'voided', 'finalizing')) or
      (old.status = 'partially_signed' and new.status in ('correction_requested', 'finalizing', 'voided')) or
      (old.status = 'correction_requested' and new.status = 'superseded') or
      (old.status = 'finalizing' and new.status in ('executed', 'finalizing_failed')) or
      (old.status = 'finalizing_failed' and new.status in ('finalizing', 'voided')) or
      (old.status = 'executed' and new.status in ('disputed', 'superseded')) or
      (old.status = 'disputed' and new.status = 'superseded')
    ) then
      raise exception 'illegal split agreement version transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public._split_agreement_immutable_version_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'split agreement versions cannot be deleted';
  end if;
  if old.locked_at is not null then
    if current_user not in ('postgres', 'service_role') then
      raise exception 'locked split agreement versions are service-role mutable only';
    end if;
    if new.split_agreement_id is distinct from old.split_agreement_id
       or new.account_id is distinct from old.account_id
       or new.artist_workspace_id is distinct from old.artist_workspace_id
       or new.artist_id is distinct from old.artist_id
       or new.music_item_id is distinct from old.music_item_id
       or new.music_split_id is distinct from old.music_split_id
       or new.version_number is distinct from old.version_number
       or new.canonical_snapshot is distinct from old.canonical_snapshot
       or new.canonical_snapshot_sha256 is distinct from old.canonical_snapshot_sha256
       or new.metadata is distinct from old.metadata
       or new.terms_version is distinct from old.terms_version
       or new.consent_version is distinct from old.consent_version
       or new.document_id is distinct from old.document_id
       or new.coordinator_participant_id is distinct from old.coordinator_participant_id
       or new.coordinator_name is distinct from old.coordinator_name
       or new.coordinator_role is distinct from old.coordinator_role
       or new.external_coordinator_name is distinct from old.external_coordinator_name
       or new.external_coordinator_email is distinct from old.external_coordinator_email
       or new.external_coordinator_organisation is distinct from old.external_coordinator_organisation
       or new.external_coordinator_authority is distinct from old.external_coordinator_authority
       or new.coordinator_signature_required is distinct from old.coordinator_signature_required
       or new.locked_at is distinct from old.locked_at
       or new.pre_signature_sha256 is distinct from old.pre_signature_sha256 then
      raise exception 'locked split agreement content cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public._split_agreement_participant_immutable_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
declare
  v_status public.split_agreement_version_status;
  v_locked_at timestamptz;
  v_version_id uuid;
begin
  v_version_id := case when TG_OP = 'INSERT' then new.version_id else old.version_id end;
  select status, locked_at into v_status, v_locked_at
  from public.split_agreement_versions where id = v_version_id;
  if v_locked_at is not null then
    raise exception 'participants are immutable after version lock';
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public._split_agreement_executed_transition_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
declare
  v_required_count integer;
  v_signed_count integer;
  v_coordinator_ok boolean;
  v_final_ok boolean;
  v_certificate_ok boolean;
  v_manifest_ok boolean;
begin
  if new.status = 'executed' then
    select count(*) filter (where signature_required),
           count(*) filter (where signature_required and exists (
             select 1 from public.split_signatures s
             where s.version_id = new.id and s.participant_id = p.id and s.kind = 'participant'
           ))
    into v_required_count, v_signed_count
    from public.split_agreement_participants p
    where p.version_id = new.id;
    v_coordinator_ok := not new.coordinator_signature_required
      or (new.coordinator_signature_id is not null and exists (
        select 1 from public.split_signatures s
        where s.id = new.coordinator_signature_id and s.version_id = new.id and s.kind = 'coordinator'
      ));
    v_final_ok := new.final_pdf_asset_id is not null and new.final_pdf_sha256 is not null and exists (
      select 1 from public.split_agreement_artifacts a
      where a.id = new.final_pdf_asset_id and a.version_id = new.id
        and a.kind = 'final_pdf' and a.sha256 = new.final_pdf_sha256
    );
    v_certificate_ok := new.execution_certificate_asset_id is not null and new.execution_certificate_sha256 is not null and exists (
      select 1 from public.split_agreement_artifacts a
      where a.id = new.execution_certificate_asset_id and a.version_id = new.id
        and a.kind = 'execution_certificate' and a.sha256 = new.execution_certificate_sha256
    );
    v_manifest_ok := new.evidence_manifest_asset_id is not null and new.evidence_manifest_sha256 is not null and exists (
      select 1 from public.split_agreement_artifacts a
      where a.id = new.evidence_manifest_asset_id and a.version_id = new.id
        and a.kind = 'evidence_manifest' and a.sha256 = new.evidence_manifest_sha256
    );
    if v_required_count = 0 or v_signed_count <> v_required_count or not v_coordinator_ok
       or not v_final_ok or not v_certificate_ok or not v_manifest_ok then
      raise exception 'executed split agreement requires all signatures and final evidence artifacts';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public._split_agreement_evidence_immutable_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
begin
  raise exception 'split agreement evidence is append-only and immutable';
end;
$$;

create trigger split_agreement_versions_transition_guard
before update on public.split_agreement_versions
for each row execute function public._split_agreement_version_transition_guard();
create trigger split_agreement_versions_executed_guard
before update on public.split_agreement_versions
for each row execute function public._split_agreement_executed_transition_guard();
create trigger split_agreement_versions_immutable_guard
before update or delete on public.split_agreement_versions
for each row execute function public._split_agreement_immutable_version_guard();
create trigger split_agreement_participants_immutable_guard
before insert or update or delete on public.split_agreement_participants
for each row execute function public._split_agreement_participant_immutable_guard();
create trigger split_signatures_immutable_guard
before update or delete on public.split_signatures
for each row execute function public._split_agreement_evidence_immutable_guard();
create trigger split_agreement_artifacts_immutable_guard
before update or delete on public.split_agreement_artifacts
for each row execute function public._split_agreement_evidence_immutable_guard();
create trigger split_agreement_events_immutable_guard
before update or delete on public.split_agreement_events
for each row execute function public._split_agreement_evidence_immutable_guard();

insert into storage.buckets (id, name, public)
values ('split-agreement-artifacts', 'split-agreement-artifacts', false)
on conflict (id) do update set public = false;

create policy split_agreement_artifacts_storage_service on storage.objects
for all to service_role
using (
  bucket_id = 'split-agreement-artifacts'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
)
with check (
  bucket_id = 'split-agreement-artifacts'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
);

alter table public.split_agreements enable row level security;
alter table public.split_agreement_versions enable row level security;
alter table public.split_agreement_participants enable row level security;
alter table public.split_signature_requests enable row level security;
alter table public.split_signatures enable row level security;
alter table public.split_agreement_events enable row level security;
alter table public.split_agreement_artifacts enable row level security;

revoke all on table public.split_agreements, public.split_agreement_versions,
  public.split_agreement_participants, public.split_signature_requests,
  public.split_signatures, public.split_agreement_events,
  public.split_agreement_artifacts from public, anon, authenticated;
grant select on table public.split_agreements, public.split_agreement_versions,
  public.split_agreement_participants, public.split_signatures,
  public.split_agreement_events, public.split_agreement_artifacts to authenticated;
grant select (
  id, version_id, participant_id, account_id, artist_workspace_id, artist_id,
  otp_expires_at, otp_attempt_count, status, provider_name, provider_delivery_id,
  provider_delivery_status, provider_failure_code, failure_details, sent_at,
  delivered_at, opened_at, verified_at, signed_at, failed_at, expired_at,
  revoked_at, superseded_at, expires_at, request_expires_at, cooldown_until,
  idempotency_key, created_at, updated_at
) on table public.split_signature_requests to authenticated;
revoke select (capability_token_hash, otp_hash)
  on table public.split_signature_requests from authenticated;
grant all on table public.split_agreements, public.split_agreement_versions,
  public.split_agreement_participants, public.split_signature_requests,
  public.split_signatures, public.split_agreement_events,
  public.split_agreement_artifacts to service_role;

create policy split_agreements_account_members_select on public.split_agreements
for select to authenticated using (public.is_account_member(account_id));
create policy split_agreement_versions_account_members_select on public.split_agreement_versions
for select to authenticated using (public.is_account_member(account_id));
create policy split_agreement_participants_account_members_select on public.split_agreement_participants
for select to authenticated using (public.is_account_member(account_id));
create policy split_signature_requests_account_members_select on public.split_signature_requests
for select to authenticated using (public.is_account_member(account_id));
create policy split_signatures_account_members_select on public.split_signatures
for select to authenticated using (public.is_account_member(account_id));
create policy split_agreement_events_account_members_select on public.split_agreement_events
for select to authenticated using (public.is_account_member(account_id));
create policy split_agreement_artifacts_account_members_select on public.split_agreement_artifacts
for select to authenticated using (public.is_account_member(account_id));

create or replace function public.lock_split_agreement_version_v1(
  p_split_agreement_id uuid,
  p_canonical_snapshot jsonb,
  p_terms_version text,
  p_consent_version text,
  p_pre_signature_sha256 text,
  p_coordinator_signature_required boolean,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_agreement public.split_agreements%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_canonical_hash text;
  v_metadata jsonb;
  v_participant jsonb;
  v_coordinator_id uuid;
  v_coordinator_participant jsonb;
  v_participant_ids uuid[] := '{}';
  v_participant_count integer := 0;
  v_performing_total numeric := 0;
  v_mechanical_total numeric := 0;
  v_neighbouring_total numeric := 0;
  v_performing_used boolean := false;
  v_mechanical_used boolean := false;
  v_neighbouring_used boolean := false;
  v_share numeric;
  v_signature_required boolean;
  v_existing public.split_agreement_versions%rowtype;
  v_required_metadata text;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'lock idempotency key is required';
  end if;
  select * into v_agreement from public.split_agreements where id = p_split_agreement_id for update;
  if not found then raise exception 'split agreement not found'; end if;
  select * into v_existing from public.split_agreement_versions
  where split_agreement_id = p_split_agreement_id and lock_idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'agreementId', v_existing.split_agreement_id, 'versionId', v_existing.id,
      'versionNumber', v_existing.version_number, 'documentId', v_existing.document_id,
      'preSignatureSha256', v_existing.pre_signature_sha256, 'status', v_existing.status,
      'receiptId', v_existing.lock_receipt_id
    );
  end if;
  if p_canonical_snapshot is null or jsonb_typeof(p_canonical_snapshot) <> 'object'
     or jsonb_typeof(p_canonical_snapshot -> 'metadata') <> 'object'
     or jsonb_typeof(p_canonical_snapshot -> 'participants') <> 'array'
     or jsonb_array_length(p_canonical_snapshot -> 'participants') = 0 then
    raise exception 'canonical split agreement snapshot is malformed';
  end if;
  foreach v_required_metadata in array array['workTitle', 'recordingTitle', 'agreementDate', 'dateCreated', 'releaseScheduledOrReleased'] loop
    if p_canonical_snapshot -> 'metadata' ->> v_required_metadata is null
       or btrim(p_canonical_snapshot -> 'metadata' ->> v_required_metadata) = '' then
      raise exception 'lock metadata field is required: %', v_required_metadata;
    end if;
  end loop;
  if jsonb_typeof(p_canonical_snapshot -> 'metadata' -> 'releaseScheduledOrReleased') <> 'boolean' then
    raise exception 'releaseScheduledOrReleased must be boolean';
  end if;
  if p_terms_version is null or btrim(p_terms_version) = ''
     or p_consent_version is null or btrim(p_consent_version) = '' then
    raise exception 'terms and consent versions are required';
  end if;
  if p_pre_signature_sha256 is null or p_pre_signature_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'pre-signature PDF SHA-256 must be lowercase hexadecimal';
  end if;

  if exists (select 1 from public.split_agreement_versions where split_agreement_id = p_split_agreement_id and locked_at is not null) then
    raise exception 'agreement already has a locked version; discard or supersede it before creating another';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.split_agreement_versions where split_agreement_id = p_split_agreement_id;
  v_metadata := p_canonical_snapshot -> 'metadata';
  v_canonical_hash := encode(extensions.digest(convert_to(p_canonical_snapshot::text, 'utf8'), 'sha256'), 'hex');

  for v_participant in select value from jsonb_array_elements(p_canonical_snapshot -> 'participants') loop
    v_participant_count := v_participant_count + 1;
    if (v_participant ->> 'id') is null or btrim(v_participant ->> 'id') = '' then raise exception 'participant id is required'; end if;
    if (v_participant ->> 'id')::uuid = any(v_participant_ids) then raise exception 'participant ids must be unique'; end if;
    v_participant_ids := array_append(v_participant_ids, (v_participant ->> 'id')::uuid);
    if nullif(btrim(v_participant ->> 'legalName'), '') is null then raise exception 'participant legal identity is required'; end if;
    if nullif(btrim(v_participant ->> 'email'), '') is null or nullif(btrim(v_participant ->> 'telephone'), '') is null then raise exception 'participant contact is required'; end if;
    if v_participant ->> 'participantType' not in ('individual', 'organisation') then raise exception 'participant type is invalid'; end if;
    if v_participant ->> 'signingAuthority' not in ('self', 'authorised_organisation_representative', 'parent_guardian') then raise exception 'participant signing authority is invalid'; end if;
    if jsonb_typeof(v_participant -> 'roles') <> 'array' or jsonb_array_length(v_participant -> 'roles') = 0
       or exists (select 1 from jsonb_array_elements_text(v_participant -> 'roles') role_value where role_value not in ('composer', 'lyricist', 'songwriter', 'arranger', 'producer', 'performer', 'featured_artist', 'session_musician', 'engineer', 'publisher', 'label', 'other')) then
      raise exception 'participant roles are required and must use the approved vocabulary';
    end if;
    if v_participant ->> 'signingAuthority' = 'parent_guardian'
       and (nullif(btrim(v_participant ->> 'parentGuardianLegalName'), '') is null or nullif(btrim(v_participant ->> 'parentGuardianRelationship'), '') is null) then
      raise exception 'guardian identity and relationship are required';
    end if;
    if (v_participant ->> 'participantType' = 'organisation' or v_participant ->> 'signingAuthority' = 'authorised_organisation_representative')
       and (nullif(btrim(v_participant ->> 'organisationName'), '') is null or nullif(btrim(v_participant ->> 'signingCapacity'), '') is null) then
      raise exception 'organisation identity and signing capacity are required';
    end if;
    v_signature_required := coalesce((v_participant ->> 'signatureRequired')::boolean, true);
    if not v_signature_required and nullif(btrim(v_participant ->> 'nonSigningReason'), '') is null then
      raise exception 'non-signing participants require a reason';
    end if;
    foreach v_required_metadata in array array['performing', 'mechanical', 'neighbouring'] loop
      if v_participant ? v_required_metadata and jsonb_typeof(v_participant -> v_required_metadata) not in ('number', 'null') then
        raise exception 'participant share must be numeric or null: %', v_required_metadata;
      end if;
    end loop;
    v_share := nullif(v_participant ->> 'performing', '')::numeric;
    if v_share is not null then
      if v_share < 0 or v_share > 100 then raise exception 'performing share must be between 0 and 100'; end if;
      v_performing_used := true; v_performing_total := v_performing_total + v_share;
      if v_share > 0 and not v_signature_required then raise exception 'positive participant share requires a signature'; end if;
    end if;
    v_share := nullif(v_participant ->> 'mechanical', '')::numeric;
    if v_share is not null then
      if v_share < 0 or v_share > 100 then raise exception 'mechanical share must be between 0 and 100'; end if;
      v_mechanical_used := true; v_mechanical_total := v_mechanical_total + v_share;
      if v_share > 0 and not v_signature_required then raise exception 'positive participant share requires a signature'; end if;
    end if;
    v_share := nullif(v_participant ->> 'neighbouring', '')::numeric;
    if v_share is not null then
      if v_share < 0 or v_share > 100 then raise exception 'neighbouring share must be between 0 and 100'; end if;
      v_neighbouring_used := true; v_neighbouring_total := v_neighbouring_total + v_share;
      if v_share > 0 and not v_signature_required then raise exception 'positive participant share requires a signature'; end if;
    end if;
  end loop;
  if v_performing_used and v_performing_total <> 100 then raise exception 'performing shares must total exactly 100'; end if;
  if v_mechanical_used and v_mechanical_total <> 100 then raise exception 'mechanical shares must total exactly 100'; end if;
  if v_neighbouring_used and v_neighbouring_total <> 100 then raise exception 'neighbouring shares must total exactly 100'; end if;
  v_coordinator_id := nullif(v_metadata ->> 'coordinatorParticipantId', '')::uuid;
  if v_coordinator_id is not null then
    select value into v_coordinator_participant
    from jsonb_array_elements(p_canonical_snapshot -> 'participants') value
    where (value ->> 'id')::uuid = v_coordinator_id;
    if not found then raise exception 'coordinator participant is not in the participant snapshot'; end if;
    if nullif(btrim(v_metadata ->> 'coordinatorName'), '') is null or nullif(btrim(v_metadata ->> 'coordinatorRole'), '') is null then
      raise exception 'coordinator identity and role are required';
    end if;
    if v_metadata ->> 'coordinatorName' <> v_coordinator_participant ->> 'legalName' then raise exception 'coordinator identity does not match participant'; end if;
    if p_coordinator_signature_required and coalesce((v_coordinator_participant ->> 'signatureRequired')::boolean, true) is not true then raise exception 'coordinator participant must sign'; end if;
  elsif p_coordinator_signature_required then
    if nullif(btrim(v_metadata ->> 'externalCoordinatorName'), '') is null
       or nullif(btrim(v_metadata ->> 'coordinatorRole'), '') is null
       or nullif(btrim(v_metadata ->> 'externalCoordinatorEmail'), '') is null
       or nullif(btrim(v_metadata ->> 'externalCoordinatorAuthority'), '') is null then
      raise exception 'external coordinator identity, role, email, and authority are required';
    end if;
  end if;

  insert into public.split_agreement_versions (
    split_agreement_id, account_id, artist_workspace_id, artist_id, music_item_id,
    music_split_id, version_number, canonical_snapshot, canonical_snapshot_sha256,
    metadata, terms_version, consent_version, pre_signature_sha256,
    coordinator_name, coordinator_role, external_coordinator_name,
    external_coordinator_email, external_coordinator_organisation,
    external_coordinator_authority, coordinator_signature_required, lock_reason,
    lock_idempotency_key
  ) values (
    v_agreement.id, v_agreement.account_id, v_agreement.artist_workspace_id,
    v_agreement.artist_id, v_agreement.music_item_id, v_agreement.music_split_id,
    v_version_number, p_canonical_snapshot, v_canonical_hash, v_metadata,
    p_terms_version, p_consent_version, p_pre_signature_sha256,
    nullif(v_metadata ->> 'coordinatorName', ''), nullif(v_metadata ->> 'coordinatorRole', ''),
    nullif(v_metadata ->> 'externalCoordinatorName', ''), nullif(v_metadata ->> 'externalCoordinatorEmail', ''),
    nullif(v_metadata ->> 'externalCoordinatorOrganisation', ''),
    nullif(v_metadata ->> 'externalCoordinatorAuthority', ''),
    p_coordinator_signature_required, p_reason, p_idempotency_key
  ) returning id into v_version_id;

  for v_participant in select value from jsonb_array_elements(p_canonical_snapshot -> 'participants') loop
    insert into public.split_agreement_participants (
      id, version_id, account_id, artist_workspace_id, artist_id, legal_name,
      stage_name, participant_type, signing_authority, parent_guardian_legal_name,
      parent_guardian_relationship, organisation_name, signing_capacity,
      participant_roles, other_role, email, telephone, rights_society_member_id,
      ipi_cae_number, performing, mechanical, neighbouring, signature_required,
      non_signing_reason, display_order
    ) values (
      (v_participant ->> 'id')::uuid, v_version_id, v_agreement.account_id,
      v_agreement.artist_workspace_id, v_agreement.artist_id,
      nullif(v_participant ->> 'legalName', ''), nullif(v_participant ->> 'stageName', ''),
      (v_participant ->> 'participantType')::public.split_agreement_participant_type,
      (v_participant ->> 'signingAuthority')::public.split_agreement_signing_authority,
      nullif(v_participant ->> 'parentGuardianLegalName', ''), nullif(v_participant ->> 'parentGuardianRelationship', ''),
      nullif(v_participant ->> 'organisationName', ''), nullif(v_participant ->> 'signingCapacity', ''),
      coalesce((select array_agg(role_text::public.split_agreement_participant_role)
                from jsonb_array_elements_text(coalesce(v_participant -> 'roles', '[]'::jsonb)) as role_value(role_text)),
               '{}'::public.split_agreement_participant_role[]),
      nullif(v_participant ->> 'otherRole', ''), nullif(v_participant ->> 'email', ''),
      nullif(v_participant ->> 'telephone', ''), nullif(v_participant ->> 'rightsSocietyMemberId', ''),
      nullif(v_participant ->> 'ipiCaeNumber', ''), (v_participant ->> 'performing')::numeric(5,2),
      (v_participant ->> 'mechanical')::numeric(5,2), (v_participant ->> 'neighbouring')::numeric(5,2),
      coalesce((v_participant ->> 'signatureRequired')::boolean, true),
      nullif(v_participant ->> 'nonSigningReason', '')::public.split_agreement_non_signing_reason,
      coalesce((v_participant ->> 'displayOrder')::integer, 0)
    );
  end loop;

  v_coordinator_id := nullif(v_metadata ->> 'coordinatorParticipantId', '')::uuid;
  update public.split_agreement_versions
  set coordinator_participant_id = v_coordinator_id,
      status = 'ready_for_signature'
  where id = v_version_id;
  update public.split_agreement_versions set status = 'locking' where id = v_version_id;
  update public.split_agreement_versions
  set status = 'ready_to_send', locked_at = now()
  where id = v_version_id;
  update public.split_agreements
  set status = 'ready_to_send', current_draft_version_number = v_version_number,
      current_draft_version_id = v_version_id
  where id = p_split_agreement_id;
  insert into public.split_agreement_events (
    agreement_id, version_id, account_id, artist_workspace_id, artist_id,
    event_type, triggered_by_type, payload, idempotency_key
  ) values (
    p_split_agreement_id, v_version_id, v_agreement.account_id,
    v_agreement.artist_workspace_id, v_agreement.artist_id, 'version_locked',
    'service', jsonb_build_object('reason', p_reason, 'versionNumber', v_version_number), p_idempotency_key
  );
  return jsonb_build_object(
    'agreementId', p_split_agreement_id, 'versionId', v_version_id,
    'versionNumber', v_version_number, 'documentId',
    (select document_id from public.split_agreement_versions where id = v_version_id),
    'preSignatureSha256', p_pre_signature_sha256, 'status', 'ready_to_send',
    'receiptId', (select lock_receipt_id from public.split_agreement_versions where id = v_version_id)
  );
end;
$$;

create or replace function public.invalidate_split_signature_requests_v1(
  p_version_id uuid,
  p_reason text,
  p_invalidation_status public.split_agreement_version_status,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_version public.split_agreement_versions%rowtype;
  v_request_count integer;
  v_request_status public.split_signature_request_status;
  v_event public.split_agreement_event_type;
  v_existing_event public.split_agreement_events%rowtype;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'invalidation idempotency key is required';
  end if;
  select * into v_existing_event from public.split_agreement_events
  where version_id = p_version_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'versionId', p_version_id, 'status', v_existing_event.payload ->> 'status',
      'invalidatedRequestCount', (v_existing_event.payload ->> 'invalidatedRequestCount')::integer,
      'eventId', v_existing_event.id, 'receiptId', v_existing_event.id
    );
  end if;
  if p_invalidation_status is null or p_invalidation_status not in ('correction_requested', 'voided', 'superseded') then
    raise exception 'invalid request invalidation status %', p_invalidation_status;
  end if;
  select * into v_version from public.split_agreement_versions where id = p_version_id for update;
  if not found then raise exception 'split agreement version not found'; end if;
  v_request_status := case when p_invalidation_status = 'voided' then 'revoked' else 'superseded' end;
  update public.split_signature_requests
  set status = v_request_status,
      superseded_at = case when v_request_status = 'superseded' then now() else superseded_at end,
      revoked_at = case when v_request_status = 'revoked' then now() else revoked_at end,
      failure_details = p_reason
  where version_id = p_version_id
    and status not in ('signed', 'expired', 'revoked', 'superseded');
  get diagnostics v_request_count = row_count;
  v_event := case when p_invalidation_status = 'voided' then 'agreement_voided'
                  when p_invalidation_status = 'superseded' then 'version_discarded'
                  else 'correction_requested' end;
  update public.split_agreement_versions
  set status = p_invalidation_status,
      correction_reason = case when p_invalidation_status = 'correction_requested' then p_reason else correction_reason end,
      void_reason = case when p_invalidation_status = 'voided' then p_reason else void_reason end,
      supersede_reason = case when p_invalidation_status = 'superseded' then p_reason else supersede_reason end,
      voided_at = case when p_invalidation_status = 'voided' then now() else voided_at end,
      superseded_at = case when p_invalidation_status = 'superseded' then now() else superseded_at end
  where id = p_version_id;
  insert into public.split_agreement_events (
    agreement_id, version_id, account_id, artist_workspace_id, artist_id,
    event_type, triggered_by_type, payload, idempotency_key
  ) values (
    v_version.split_agreement_id, v_version.id, v_version.account_id,
    v_version.artist_workspace_id, v_version.artist_id, v_event, 'service',
    jsonb_build_object('reason', p_reason, 'status', p_invalidation_status, 'invalidatedRequestCount', v_request_count), p_idempotency_key
  );
  return jsonb_build_object('versionId', p_version_id, 'status', p_invalidation_status,
                            'invalidatedRequestCount', v_request_count,
                            'eventId', (select id from public.split_agreement_events where version_id = p_version_id and idempotency_key = p_idempotency_key),
                            'receiptId', (select id from public.split_agreement_events where version_id = p_version_id and idempotency_key = p_idempotency_key));
exception when unique_violation then
  select * into v_existing_event from public.split_agreement_events
  where version_id = p_version_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'versionId', p_version_id, 'status', v_existing_event.payload ->> 'status',
      'invalidatedRequestCount', (v_existing_event.payload ->> 'invalidatedRequestCount')::integer,
      'eventId', v_existing_event.id, 'receiptId', v_existing_event.id
    );
  end if;
  raise;
end;
$$;

create or replace function public.submit_split_signature_v1(
  p_version_id uuid,
  p_participant_id uuid,
  p_signature_request_id uuid,
  p_pre_signature_document_hash text,
  p_kind public.split_signature_kind,
  p_signature_vector_asset_id uuid,
  p_rendered_signature_image_asset_id uuid,
  p_signature_asset_hash text,
  p_printed_signer_name text,
  p_signing_authority public.split_agreement_signing_authority,
  p_parent_guardian_legal_name text,
  p_parent_guardian_relationship text,
  p_organisation_name text,
  p_signing_capacity text,
  p_organisation_or_capacity text,
  p_consent_version text,
  p_accepted_consent_text text,
  p_display_timezone text,
  p_hashed_ip text,
  p_hashed_user_agent text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_existing public.split_signatures%rowtype;
  v_version public.split_agreement_versions%rowtype;
  v_request public.split_signature_requests%rowtype;
  v_participant public.split_agreement_participants%rowtype;
  v_signature public.split_signatures%rowtype;
  v_account_id uuid;
  v_workspace_id uuid;
  v_artist_id uuid;
  v_required_count integer;
  v_signed_count integer;
  v_coordinator_signed boolean;
  v_next_status public.split_agreement_version_status;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then raise exception 'signature idempotency key is required'; end if;
  select * into v_existing from public.split_signatures where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.version_id <> p_version_id
       or v_existing.participant_id is distinct from p_participant_id
       or v_existing.signature_request_id is distinct from p_signature_request_id
       or v_existing.kind is distinct from p_kind then
      raise exception 'signature idempotency key is already bound to another submission';
    end if;
    return jsonb_build_object('status', 'existing', 'signatureId', v_existing.id, 'receiptId', v_existing.receipt_id);
  end if;
  select * into v_version from public.split_agreement_versions where id = p_version_id for update;
  if not found then raise exception 'split agreement version not found'; end if;
  if p_kind is null then raise exception 'signature kind is required'; end if;
  if v_version.status not in ('ready_to_send', 'sent_for_signature', 'partially_signed') then
    raise exception 'split agreement version is not signable in status %', v_version.status;
  end if;
  if p_pre_signature_document_hash <> v_version.pre_signature_sha256 then raise exception 'pre-signature hash mismatch'; end if;
  if p_consent_version <> v_version.consent_version then raise exception 'consent version mismatch'; end if;
  if p_signature_asset_hash is null or p_signature_asset_hash !~ '^[0-9a-f]{64}$' then raise exception 'signature asset hash is required'; end if;
  if p_kind = 'participant' then
    if p_participant_id is null or p_signature_request_id is null then raise exception 'participant signatures require participant and request'; end if;
    select * into v_request from public.split_signature_requests where id = p_signature_request_id for update;
    if not found or v_request.version_id <> p_version_id or v_request.participant_id <> p_participant_id then raise exception 'signature request is not bound to participant and version'; end if;
    if v_request.status <> 'verified' then raise exception 'signature request must be verified before signing'; end if;
    if coalesce(v_request.expires_at, v_request.request_expires_at) <= now() then raise exception 'signature request has expired'; end if;
    select * into v_participant from public.split_agreement_participants
    where id = p_participant_id and version_id = p_version_id;
    if not found then raise exception 'participant not found for version'; end if;
    if not v_participant.signature_required then raise exception 'participant signature is not required'; end if;
    if p_printed_signer_name is distinct from v_participant.legal_name
       or p_signing_authority is distinct from v_participant.signing_authority
       or p_parent_guardian_legal_name is distinct from v_participant.parent_guardian_legal_name
       or p_parent_guardian_relationship is distinct from v_participant.parent_guardian_relationship
       or p_organisation_name is distinct from v_participant.organisation_name
       or p_signing_capacity is distinct from v_participant.signing_capacity
       or p_organisation_or_capacity is distinct from v_participant.signing_capacity then
      raise exception 'submitted signer identity or authority does not match participant snapshot';
    end if;
    v_account_id := v_participant.account_id;
    v_workspace_id := v_participant.artist_workspace_id;
    v_artist_id := v_participant.artist_id;
  else
    if p_signature_request_id is not null then raise exception 'coordinator signatures cannot use participant requests'; end if;
    if not v_version.coordinator_signature_required then raise exception 'coordinator signature is not required'; end if;
    if v_version.coordinator_participant_id is not null and p_participant_id is null then raise exception 'coordinator participant is required for this locked coordinator'; end if;
    if p_participant_id is not null and p_participant_id is distinct from v_version.coordinator_participant_id then raise exception 'coordinator participant does not match the locked coordinator'; end if;
    if p_participant_id is not null then
      select * into v_participant from public.split_agreement_participants where id = p_participant_id and version_id = p_version_id;
      if not found then raise exception 'coordinator participant is not bound to version'; end if;
      if p_printed_signer_name is distinct from v_participant.legal_name
         or p_signing_authority is distinct from v_participant.signing_authority
         or p_parent_guardian_legal_name is distinct from v_participant.parent_guardian_legal_name
         or p_parent_guardian_relationship is distinct from v_participant.parent_guardian_relationship
         or p_organisation_name is distinct from v_participant.organisation_name
         or p_signing_capacity is distinct from v_participant.signing_capacity
         or p_organisation_or_capacity is distinct from v_participant.signing_capacity then
        raise exception 'coordinator identity or authority does not match participant snapshot';
      end if;
    else
      if p_printed_signer_name is distinct from v_version.external_coordinator_name
         or p_organisation_name is distinct from v_version.external_coordinator_organisation
         or p_organisation_or_capacity is distinct from v_version.external_coordinator_authority then
        raise exception 'external coordinator identity or authority does not match locked coordinator';
      end if;
    end if;
    v_account_id := v_version.account_id; v_workspace_id := v_version.artist_workspace_id; v_artist_id := v_version.artist_id;
  end if;
  if not exists (select 1 from public.split_agreement_artifacts where id = p_signature_vector_asset_id and version_id = p_version_id and kind = 'signature_vector') then raise exception 'signature vector artifact is not bound to version'; end if;
  if not exists (select 1 from public.split_agreement_artifacts where id = p_rendered_signature_image_asset_id and version_id = p_version_id and kind = 'signature_image') then raise exception 'signature image artifact is not bound to version'; end if;

  insert into public.split_signatures (
    version_id, participant_id, signature_request_id, account_id, artist_workspace_id,
    artist_id, kind, pre_signature_document_hash, signature_vector_asset_id,
    rendered_signature_image_asset_id, signature_asset_hash, printed_signer_name,
    signing_authority, parent_guardian_legal_name, parent_guardian_relationship,
    organisation_name, signing_capacity, organisation_or_capacity, consent_version,
    accepted_consent_text, signed_at, display_timezone, hashed_ip, hashed_user_agent,
    idempotency_key
  ) values (
    p_version_id, p_participant_id, p_signature_request_id, v_account_id,
    v_workspace_id, v_artist_id, p_kind, p_pre_signature_document_hash,
    p_signature_vector_asset_id, p_rendered_signature_image_asset_id,
    p_signature_asset_hash, p_printed_signer_name, p_signing_authority,
    p_parent_guardian_legal_name, p_parent_guardian_relationship, p_organisation_name,
    p_signing_capacity, p_organisation_or_capacity, p_consent_version,
    p_accepted_consent_text, now(), p_display_timezone, p_hashed_ip, p_hashed_user_agent,
    p_idempotency_key
  ) returning * into v_signature;
  if p_signature_request_id is not null then
    update public.split_signature_requests set status = 'signed', signed_at = now() where id = p_signature_request_id;
  end if;
  select count(*) filter (where participant.signature_required), count(*) filter (where participant.signature_required and signature.id is not null)
  into v_required_count, v_signed_count
  from public.split_agreement_participants participant
  left join public.split_signatures signature on signature.version_id = participant.version_id and signature.participant_id = participant.id and signature.kind = 'participant'
  where participant.version_id = p_version_id;
  select exists (select 1 from public.split_signatures where version_id = p_version_id and kind = 'coordinator') into v_coordinator_signed;
  v_next_status := case when v_signed_count = v_required_count and (not v_version.coordinator_signature_required or v_coordinator_signed) then 'finalizing'
                        when v_signed_count > 0 then 'partially_signed' else v_version.status end;
  update public.split_agreement_versions set status = v_next_status, finalized_at = case when v_next_status = 'finalizing' then now() else finalized_at end, coordinator_signature_id = case when p_kind = 'coordinator' then v_signature.id else coordinator_signature_id end where id = p_version_id;
  insert into public.split_agreement_events (agreement_id, version_id, account_id, artist_workspace_id, artist_id, event_type, triggered_by_type, participant_id, payload, idempotency_key)
  values (v_version.split_agreement_id, p_version_id, v_version.account_id, v_version.artist_workspace_id, v_version.artist_id, 'signature_submitted', case when p_kind = 'coordinator' then 'workspace_member' else 'participant' end, p_participant_id, jsonb_build_object('signatureId', v_signature.id, 'status', v_next_status), p_idempotency_key);
  return jsonb_build_object('status', 'submitted', 'signatureId', v_signature.id, 'receiptId', v_signature.receipt_id, 'versionStatus', v_next_status);
exception when unique_violation then
  select * into v_existing from public.split_signatures where idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('status', 'existing', 'signatureId', v_existing.id, 'receiptId', v_existing.receipt_id); end if;
  raise;
end;
$$;

create or replace function public.can_finalize_split_agreement_v1(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_version public.split_agreement_versions%rowtype;
  v_required_count integer;
  v_signed_count integer;
  v_coordinator_ok boolean;
  v_pre_artifact_ok boolean;
  v_final_pdf_artifact_ok boolean;
  v_execution_certificate_artifact_ok boolean;
  v_evidence_manifest_artifact_ok boolean;
  v_missing text[] := '{}';
begin
  select * into v_version from public.split_agreement_versions where id = p_version_id;
  if not found then raise exception 'split agreement version not found'; end if;
  select count(*) filter (where participant.signature_required), count(*) filter (where participant.signature_required and signature.id is not null)
  into v_required_count, v_signed_count
  from public.split_agreement_participants participant
  left join public.split_signatures signature on signature.version_id = participant.version_id and signature.participant_id = participant.id and signature.kind = 'participant'
  where participant.version_id = p_version_id;
  v_coordinator_ok := not v_version.coordinator_signature_required or exists (select 1 from public.split_signatures where version_id = p_version_id and kind = 'coordinator');
  v_pre_artifact_ok := v_version.pre_signature_pdf_asset_id is not null and v_version.pre_signature_sha256 is not null and exists (select 1 from public.split_agreement_artifacts where id = v_version.pre_signature_pdf_asset_id and version_id = p_version_id and kind = 'pre_signature_pdf' and sha256 = v_version.pre_signature_sha256);
  v_final_pdf_artifact_ok := v_version.final_pdf_asset_id is not null and v_version.final_pdf_sha256 is not null and exists (select 1 from public.split_agreement_artifacts where id = v_version.final_pdf_asset_id and version_id = p_version_id and kind = 'final_pdf' and sha256 = v_version.final_pdf_sha256);
  v_execution_certificate_artifact_ok := v_version.execution_certificate_asset_id is not null and v_version.execution_certificate_sha256 is not null and exists (select 1 from public.split_agreement_artifacts where id = v_version.execution_certificate_asset_id and version_id = p_version_id and kind = 'execution_certificate' and sha256 = v_version.execution_certificate_sha256);
  v_evidence_manifest_artifact_ok := v_version.evidence_manifest_asset_id is not null and v_version.evidence_manifest_sha256 is not null and exists (select 1 from public.split_agreement_artifacts where id = v_version.evidence_manifest_asset_id and version_id = p_version_id and kind = 'evidence_manifest' and sha256 = v_version.evidence_manifest_sha256);
  if v_signed_count < v_required_count then v_missing := array_append(v_missing, 'participant_signatures'); end if;
  if v_required_count = 0 then v_missing := array_append(v_missing, 'participant_signatures'); end if;
  if not v_coordinator_ok then v_missing := array_append(v_missing, 'coordinator_signature'); end if;
  if not v_pre_artifact_ok then v_missing := array_append(v_missing, 'pre_signature_artifact'); end if;
  if not v_final_pdf_artifact_ok then v_missing := array_append(v_missing, 'final_pdf_artifact'); end if;
  if not v_execution_certificate_artifact_ok then v_missing := array_append(v_missing, 'execution_certificate_artifact'); end if;
  if not v_evidence_manifest_artifact_ok then v_missing := array_append(v_missing, 'evidence_manifest_artifact'); end if;
  return jsonb_build_object(
    'canFinalize', cardinality(v_missing) = 0 and v_required_count > 0,
    'requiredParticipantSignatures', v_required_count,
    'signedParticipantSignatures', v_signed_count,
    'coordinatorSignatureRequired', v_version.coordinator_signature_required,
    'coordinatorSignaturePresent', v_coordinator_ok,
    'preSignatureArtifactPresent', v_pre_artifact_ok,
    'finalPdfArtifactPresent', v_final_pdf_artifact_ok,
    'executionCertificateArtifactPresent', v_execution_certificate_artifact_ok,
    'evidenceManifestArtifactPresent', v_evidence_manifest_artifact_ok,
    'missing', to_jsonb(v_missing)
  );
end;
$$;

revoke all on function public.next_split_agreement_document_id() from public, anon, authenticated;
grant execute on function public.next_split_agreement_document_id() to service_role;
revoke all on function public.lock_split_agreement_version_v1(uuid, jsonb, text, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.lock_split_agreement_version_v1(uuid, jsonb, text, text, text, boolean, text, text) to service_role;
revoke all on function public.invalidate_split_signature_requests_v1(uuid, text, public.split_agreement_version_status, text) from public, anon, authenticated;
grant execute on function public.invalidate_split_signature_requests_v1(uuid, text, public.split_agreement_version_status, text) to service_role;
revoke all on function public.submit_split_signature_v1(uuid, uuid, uuid, text, public.split_signature_kind, uuid, uuid, text, text, public.split_agreement_signing_authority, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_split_signature_v1(uuid, uuid, uuid, text, public.split_signature_kind, uuid, uuid, text, text, public.split_agreement_signing_authority, text, text, text, text, text, text, text, text, text, text, text) to service_role;
revoke all on function public.can_finalize_split_agreement_v1(uuid) from public, anon, authenticated;
grant execute on function public.can_finalize_split_agreement_v1(uuid) to service_role;
revoke all on function public._split_agreement_version_transition_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_immutable_version_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_participant_immutable_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_evidence_immutable_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_scope_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_version_scope_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_signatures_scope_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_artifacts_scope_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_events_scope_guard() from public, anon, authenticated, service_role;
revoke all on function public._split_agreement_executed_transition_guard() from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
