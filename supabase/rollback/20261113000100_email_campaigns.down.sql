-- Reversión manual de 20261113000100_email_campaigns.sql (con autorización): borra preferencias y envíos.
begin;
drop function if exists public.email_unsubscribe(uuid);
drop function if exists public.email_campaign_candidates();
drop table if exists public.email_sends;
drop trigger if exists profiles_email_preferences on public.profiles;
drop function if exists public.create_email_preferences();
drop table if exists public.email_preferences;
commit;
