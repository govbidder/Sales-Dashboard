create table if not exists public.applications (
  id                   uuid primary key default gen_random_uuid(),
  first_name           text,
  last_name            text,
  email                text,
  whatsapp             text,
  instagram_handle     text,
  primary_channel      text,
  short_content_link   text,
  youtube_podcast_link text,
  email_list_size      text,
  monthly_revenue      text,
  paying_clients       text,
  client_work_style    text,
  income_goal          text,
  main_blocker         text,
  superpowers          text,
  contribution         text,
  motivation           text,
  one_year_goal        text,
  terms_accepted       boolean,
  status               text not null default 'nueva',
  notes                text,
  created_at           timestamptz not null default now()
);

alter table public.applications enable row level security;

create policy "service_role_all_applications" on public.applications
  for all to service_role using (true) with check (true);

-- Public can insert (application form is public)
create policy "public_insert_applications" on public.applications
  for insert with check (true);
