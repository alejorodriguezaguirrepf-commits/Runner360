-- Reversión manual de 20261109000100_admin_subscribers.sql. Solo quita las dos consultas del panel.
begin;
drop function if exists public.admin_debits(uuid, integer, integer);
drop function if exists public.admin_subscribers();
commit;
