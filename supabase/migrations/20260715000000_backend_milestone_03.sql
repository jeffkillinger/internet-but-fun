-- Backend Milestone 03: first write path (join).
--
-- Two additive partial unique indexes. Both are the atomicity backbone for
-- the empty-queue shortcut and for idempotent join calls; see
-- docs/backend-milestone-03.md.

create unique index if not exists turns_one_live_turn_idx
  on turns (epoch_id)
  where status in ('ready_check', 'active');

create unique index if not exists queue_entries_one_live_entry_idx
  on queue_entries (epoch_id, actor_id)
  where status in ('queued', 'ready_check', 'active');
