-- Precio de lista en USD (20/mes, 180/año) y cotizaciones: lectura pública, escritura solo del servidor.
begin;
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'Falló: %', p_label; end if;
end; $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_label;
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

select pg_temp.check((select array_agg(p.code || ':' || pr.currency || ':' || pr.amount_minor order by p.code)
  from public.product_prices pr join public.subscription_products p on p.id = pr.product_id
  where pr.active and pr.provider is null) = array['premium_monthly:USD:2000', 'premium_yearly:USD:18000'], 'precios de lista USD 20 y 180');
select pg_temp.check(not exists (select 1 from public.product_prices where active and amount_minor = 799), 'sin el precio anterior activo');

insert into public.fx_rates (source, rate_type, rate, quoted_at) values ('dolarapi', 'oficial', 1499.95, now());
select pg_temp.expect_error($$insert into public.fx_rates (source, rate_type, rate, quoted_at) values ('dolarapi', 'oficial', 0, now())$$, 'cotización 0');

set role anon;
select pg_temp.check((select rate from public.fx_rates order by fetched_at desc limit 1) = 1499.95, 'anon lee la cotización');
select pg_temp.expect_error($$insert into public.fx_rates (source, rate_type, rate, quoted_at) values ('dolarapi', 'oficial', 1, now())$$, 'anon no escribe');
reset role;

insert into auth.users (id, email) values ('c8c8c8c8-0000-4000-8000-0000000000c8', 'fx@test.local');
set role authenticated;
set request.jwt.claim.sub = 'c8c8c8c8-0000-4000-8000-0000000000c8';
select pg_temp.expect_error($$insert into public.fx_rates (source, rate_type, rate, quoted_at) values ('dolarapi', 'oficial', 1, now())$$, 'usuario no escribe');
update public.fx_rates set rate = 1;
select pg_temp.check((select count(*) from public.fx_rates where rate = 1) = 0, 'sin cambios');
reset role;
rollback;
