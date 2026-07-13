create extension if not exists pgcrypto;

create table if not exists epochs (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  status text not null,
  scramble jsonb not null,
  cube_version integer not null default 0,
  state_hash text not null,
  move_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint epochs_game_id_check check (game_id = 'rubiks-cube'),
  constraint epochs_status_check check (status in ('active', 'completed')),
  constraint epochs_scramble_array_check check (jsonb_typeof(scramble) = 'array'),
  constraint epochs_cube_version_nonnegative_check check (cube_version >= 0),
  constraint epochs_move_count_nonnegative_check check (move_count >= 0),
  constraint epochs_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or (status = 'active' and completed_at is null)
  )
);

create unique index if not exists epochs_one_active_rubiks_cube_idx
  on epochs (game_id)
  where status = 'active';

create index if not exists epochs_completed_score_idx
  on epochs (game_id, move_count)
  where status = 'completed';

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  seq integer not null,
  game_id text not null,
  epoch_id uuid not null references epochs(id) on delete restrict,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint events_game_id_check check (game_id = 'rubiks-cube'),
  constraint events_seq_positive_check check (seq > 0),
  constraint events_event_type_check check (
    event_type in (
      'epoch_started',
      'queue_joined',
      'ready_check_started',
      'turn_started',
      'turn_expired',
      'move_committed',
      'epoch_completed'
    )
  )
);

create unique index if not exists events_epoch_seq_idx
  on events (epoch_id, seq);

create index if not exists events_epoch_order_idx
  on events (epoch_id, seq, id);

create table if not exists queue_entries (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  epoch_id uuid not null references epochs(id) on delete restrict,
  actor_id uuid not null,
  status text not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint queue_entries_game_id_check check (game_id = 'rubiks-cube'),
  constraint queue_entries_status_check check (
    status in (
      'queued',
      'ready_check',
      'active',
      'expired',
      'skipped',
      'completed'
    )
  )
);

create index if not exists queue_entries_epoch_status_joined_idx
  on queue_entries (epoch_id, status, joined_at);

create table if not exists turns (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  epoch_id uuid not null references epochs(id) on delete restrict,
  actor_id uuid not null,
  turn_token_hash text not null,
  status text not null,
  pending_move text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  constraint turns_game_id_check check (game_id = 'rubiks-cube'),
  constraint turns_status_check check (
    status in ('ready_check', 'active', 'expired', 'skipped', 'completed')
  ),
  constraint turns_pending_move_check check (
    pending_move is null or pending_move ~ '^[URFDLB](''|2)?$'
  )
);

create index if not exists turns_epoch_status_expires_idx
  on turns (epoch_id, status, expires_at);

create table if not exists actor_claims (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  epoch_id uuid not null references epochs(id) on delete restrict,
  actor_id uuid not null,
  claimed_at timestamptz not null default now(),
  constraint actor_claims_game_id_check check (game_id = 'rubiks-cube'),
  constraint actor_claims_epoch_actor_unique unique (epoch_id, actor_id)
);

create index if not exists actor_claims_actor_idx
  on actor_claims (actor_id);

comment on column events.actor_id is
  'Durable anonymous actor IDs stored in Postgres are UUIDs. The signed HTTP-only actor cookie will contain or resolve to that UUID; the cookie may be a signed envelope and does not need to equal the raw database value. TypeScript ActorId remains string-compatible because UUIDs are represented as strings at the API boundary.';
comment on column queue_entries.actor_id is
  'Durable anonymous actor IDs stored in Postgres are UUIDs. The signed HTTP-only actor cookie will contain or resolve to that UUID; the cookie may be a signed envelope and does not need to equal the raw database value. TypeScript ActorId remains string-compatible because UUIDs are represented as strings at the API boundary.';
comment on column turns.actor_id is
  'Durable anonymous actor IDs stored in Postgres are UUIDs. The signed HTTP-only actor cookie will contain or resolve to that UUID; the cookie may be a signed envelope and does not need to equal the raw database value. TypeScript ActorId remains string-compatible because UUIDs are represented as strings at the API boundary.';
comment on column actor_claims.actor_id is
  'Durable anonymous actor IDs stored in Postgres are UUIDs. The signed HTTP-only actor cookie will contain or resolve to that UUID; the cookie may be a signed envelope and does not need to equal the raw database value. TypeScript ActorId remains string-compatible because UUIDs are represented as strings at the API boundary.';

alter table epochs enable row level security;
alter table events enable row level security;
alter table queue_entries enable row level security;
alter table turns enable row level security;
alter table actor_claims enable row level security;
