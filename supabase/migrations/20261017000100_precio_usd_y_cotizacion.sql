-- Precio de lista en USD (USD 20/mes, USD 180/año) y cotización del dólar para el equivalente en pesos.
-- Mercado Pago Argentina cobra en ARS: el importe en pesos se calcula con la cotización vigente.
-- Reversión: supabase/rollback/20261017000100_precio_usd_y_cotizacion.down.sql

-- Cotizaciones obtenidas por el job diario (solo inserta el servidor; lectura pública).
create table public.fx_rates (
  id bigint generated always as identity primary key,
  source text not null check (source ~ '^[a-z0-9_-]{2,30}$'),
  rate_type text not null check (rate_type ~ '^[a-z0-9_-]{2,40}$'),
  base char(3) not null default 'USD' check (base ~ '^[A-Z]{3}$'),
  quote char(3) not null default 'ARS' check (quote ~ '^[A-Z]{3}$'),
  rate numeric(14, 4) not null check (rate > 0),
  quoted_at timestamptz not null,
  fetched_at timestamptz not null default now()
);
comment on table public.fx_rates is 'Cotizaciones USD→ARS (fuente y tipo configurables). Solo referencia y cálculo del importe en pesos.';
create index fx_rates_latest_idx on public.fx_rates (source, rate_type, fetched_at desc);

alter table public.fx_rates enable row level security;
create policy fx_rates_read on public.fx_rates for select to anon, authenticated using (true);
-- Sin políticas de escritura: solo el servidor (service_role) inserta.

-- Precios de lista nuevos. Las bases nuevas los reciben del seed 10_products.sql; acá se ajusta
-- una base existente, conservando el precio anterior como historial (inactivo).
do $$
begin
  if exists (select 1 from public.subscription_products where id = '00000000-0000-4000-8000-000000000002') then
    update public.product_prices set active = false
     where product_id = '00000000-0000-4000-8000-000000000002' and provider is null and active
       and not (currency = 'USD' and amount_minor = 2000);
    insert into public.product_prices (id, product_id, currency, amount_minor, provider, active)
    select '00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000002', 'USD', 2000, null, true
    where not exists (select 1 from public.product_prices
                      where product_id = '00000000-0000-4000-8000-000000000002' and provider is null and active);
  end if;
  if exists (select 1 from public.subscription_products where id = '00000000-0000-4000-8000-000000000003') then
    update public.product_prices set active = false
     where product_id = '00000000-0000-4000-8000-000000000003' and provider is null and active
       and not (currency = 'USD' and amount_minor = 18000);
    insert into public.product_prices (id, product_id, currency, amount_minor, provider, active)
    select '00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000003', 'USD', 18000, null, true
    where not exists (select 1 from public.product_prices
                      where product_id = '00000000-0000-4000-8000-000000000003' and provider is null and active);
  end if;
end $$;
