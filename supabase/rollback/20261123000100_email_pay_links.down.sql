-- Reversión manual de 20261123000100_email_pay_links.sql (con autorización): los links de pago de los
-- correos ya enviados dejan de funcionar.
drop function if exists public.email_campaign_candidates();
-- Volver a crear email_campaign_candidates() como en 20261113000100_email_campaigns.sql (sin pay_token).
alter table public.email_preferences drop column if exists pay_token;
