-- ─────────────────────────────────────────────────────────────────────────────
-- ClickUp-style upgrade for tasks: subtasks, tags, multi-assignees, comments.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Subtasks: self-referencing parent
alter table public.tasks
  add column if not exists parent_id uuid references public.tasks(id) on delete cascade;

create index if not exists idx_tasks_parent on public.tasks(parent_id);

-- 2) Tags: text array for labels
alter table public.tasks
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_tasks_tags on public.tasks using gin(tags);

-- 3) Multi-assignees: text array of team members (emails / names)
--    Keeping the legacy `owner` column populated as the "primary owner"
--    for backward compat with existing kanban filters; also storing in `assignees`.
alter table public.tasks
  add column if not exists assignees text[] not null default '{}';

create index if not exists idx_tasks_assignees on public.tasks using gin(assignees);

-- Backfill: copy any existing owner into assignees on insert/update via trigger
create or replace function public.sync_task_owner_to_assignees()
returns trigger language plpgsql as $$
begin
  -- If owner is set and not yet in assignees, prepend it
  if new.owner is not null and new.owner <> '' then
    if not (new.owner = any(coalesce(new.assignees, '{}'))) then
      new.assignees = array_prepend(new.owner, coalesce(new.assignees, '{}'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_sync_owner on public.tasks;
create trigger trg_tasks_sync_owner
  before insert or update on public.tasks
  for each row execute function public.sync_task_owner_to_assignees();

-- 4) Comments / activity log
create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author      text,                          -- email or display name of author
  content     text not null,
  kind        text not null default 'comment', -- comment | system (auto status changes etc)
  created_at  timestamptz not null default now()
);

create index if not exists idx_task_comments_task on public.task_comments(task_id, created_at desc);

alter table public.task_comments enable row level security;

create policy "authenticated_all_task_comments" on public.task_comments
  for all to authenticated using (true) with check (true);
create policy "service_role_all_task_comments" on public.task_comments
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
