-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1+2 Cleanup: drop tables for features removed from the dashboard
-- Run this manually in Supabase → SQL Editor.
--
-- After running, only these tables should remain in `public`:
--   profiles, monthly_reports, personas_agendadas, seguimientos, resources
-- ─────────────────────────────────────────────────────────────────────────────

-- Wipe monthly_reports data (Phase 2 will redesign as company-wide)
truncate table public.monthly_reports restart identity;

-- Drop FK from profiles → clients (so we can drop clients table)
alter table public.profiles drop constraint if exists profiles_client_id_fkey;

-- Drop client management tables
drop table if exists public.crm_followups cascade;
drop table if exists public.crm_installments cascade;
drop table if exists public.crm_clients cascade;
drop table if exists public.clients cascade;

-- Drop the old leads table (replaced by personas_agendadas)
drop table if exists public.crm_leads cascade;

-- Drop billing / external comms tables
drop table if exists public.payments cascade;
drop table if exists public.applications cascade;
drop table if exists public.chi_chang cascade;
drop table if exists public.monday_wins cascade;

-- Drop AI diagnosis (audit feature replaced by placeholder)
drop table if exists public.ai_diagnosis_results cascade;
drop table if exists public.ai_diagnosis_requests cascade;

-- Drop dead outbound events queue (was for Slack/Zapier dispatch, never wired up)
drop table if exists public.outbound_events cascade;

-- Drop legacy content/research tables (already removed from migrations)
drop table if exists public.video_feed_accounts cascade;
drop table if exists public.competitor_posts cascade;
drop table if exists public.content_research_history cascade;
drop table if exists public.transcript_history cascade;
drop table if exists public.market_intelligence cascade;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- After this runs, also run the new migration to create personas_agendadas
-- and seguimientos tables. Either via the Supabase CLI:
--   supabase db push
-- or copy-paste the contents of:
--   supabase/migrations/20250504000001_personas_agendadas.sql
-- into the SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────
