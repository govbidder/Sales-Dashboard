-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications: feed in-app de eventos relevantes para cada usuario.
-- Triggers automáticos cuando:
--   - Te asignan una tarea
--   - Mencionan tu email en un comentario
--   - Una tarea que tenés asignada vence
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  recipient   text not null,                          -- email del destinatario
  kind        text not null,                          -- task_assigned | task_mention | task_overdue | system
  title       text not null,                          -- "Nueva tarea asignada"
  body        text,                                   -- "Marcelo te asignó: Mandar capability statement"
  href        text,                                   -- /admin/tasks?task_id=...
  payload     jsonb default '{}'::jsonb,              -- contexto adicional (task_id, comment_id, etc)
  read_at     timestamptz,                            -- null = no leída
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient, created_at desc)
  where read_at is null;
create index if not exists idx_notifications_recipient_all
  on public.notifications(recipient, created_at desc);

alter table public.notifications enable row level security;

-- Cada usuario lee/marca solo sus propias notificaciones (matching por email)
create policy "users_read_own_notifications" on public.notifications
  for select to authenticated
  using (recipient = auth.jwt() ->> 'email');

create policy "users_update_own_notifications" on public.notifications
  for update to authenticated
  using (recipient = auth.jwt() ->> 'email')
  with check (recipient = auth.jwt() ->> 'email');

create policy "service_role_all_notifications" on public.notifications
  for all to service_role using (true) with check (true);

-- ─── Triggers ────────────────────────────────────────────────────────────────

-- 1) Cuando se asigna una tarea (insert con assignees), crear notif por cada uno
--    excluyendo al que la creó (no notificarte vos mismo).
create or replace function public.notify_task_assignees()
returns trigger language plpgsql security definer as $$
declare
  a text;
begin
  if new.assignees is null or array_length(new.assignees, 1) is null then
    return new;
  end if;

  foreach a in array new.assignees loop
    if a is not null and a <> '' and (new.created_by is distinct from a) then
      insert into public.notifications (recipient, kind, title, body, href, payload)
      values (
        a,
        'task_assigned',
        'Nueva tarea asignada',
        coalesce(new.created_by, 'Alguien') || ' te asignó: ' || new.title,
        '/admin/tasks',
        jsonb_build_object('task_id', new.id, 'priority', new.priority)
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_task_assignees on public.tasks;
create trigger trg_notify_task_assignees
  after insert on public.tasks
  for each row execute function public.notify_task_assignees();

-- 2) Update: detectar asignados nuevos (no estaban antes, ahora sí)
create or replace function public.notify_task_assignees_diff()
returns trigger language plpgsql security definer as $$
declare
  a text;
  old_set text[];
begin
  old_set := coalesce(old.assignees, '{}');
  if new.assignees is null or array_length(new.assignees, 1) is null then
    return new;
  end if;

  foreach a in array new.assignees loop
    if a is not null and a <> '' and not (a = any(old_set)) then
      insert into public.notifications (recipient, kind, title, body, href, payload)
      values (
        a,
        'task_assigned',
        'Te asignaron una tarea',
        'Te asignaron: ' || new.title,
        '/admin/tasks',
        jsonb_build_object('task_id', new.id, 'priority', new.priority)
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_task_assignees_diff on public.tasks;
create trigger trg_notify_task_assignees_diff
  after update of assignees on public.tasks
  for each row execute function public.notify_task_assignees_diff();

-- 3) Comentario en tarea: notificar a todos los assignees del task
--    (excepto al autor del comentario)
create or replace function public.notify_task_comment_mentions()
returns trigger language plpgsql security definer as $$
declare
  a text;
  task_row record;
begin
  if new.kind = 'system' then return new; end if;

  select id, title, assignees, created_by
    into task_row
    from public.tasks
    where id = new.task_id;

  if not found then return new; end if;

  -- Notificar a assignees (excepto al autor del comentario)
  if task_row.assignees is not null then
    foreach a in array task_row.assignees loop
      if a is not null and a <> '' and (new.author is distinct from a) then
        insert into public.notifications (recipient, kind, title, body, href, payload)
        values (
          a,
          'task_mention',
          'Nuevo comentario',
          coalesce(new.author, 'Alguien') || ' comentó en: ' || task_row.title,
          '/admin/tasks',
          jsonb_build_object('task_id', new.task_id, 'comment_id', new.id)
        );
      end if;
    end loop;
  end if;

  -- Notificar también al created_by si no está ya en assignees
  if task_row.created_by is not null
     and (new.author is distinct from task_row.created_by)
     and not (task_row.created_by = any(coalesce(task_row.assignees, '{}'))) then
    insert into public.notifications (recipient, kind, title, body, href, payload)
    values (
      task_row.created_by,
      'task_mention',
      'Nuevo comentario en tu tarea',
      coalesce(new.author, 'Alguien') || ' comentó en: ' || task_row.title,
      '/admin/tasks',
      jsonb_build_object('task_id', new.task_id, 'comment_id', new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_task_comment_mentions on public.task_comments;
create trigger trg_notify_task_comment_mentions
  after insert on public.task_comments
  for each row execute function public.notify_task_comment_mentions();

notify pgrst, 'reload schema';
