-- Reversión manual de 20261114000100_birthday_emails.sql (con autorización): borra el registro de los
-- correos de cumpleaños ya enviados y saca el tipo.
drop function if exists public.email_birthday_candidates(date);
delete from public.email_sends where kind = 'birthday';
alter table public.email_sends drop constraint email_sends_kind_check;
alter table public.email_sends add constraint email_sends_kind_check check (kind in ('invite', 'encourage'));
