-- Reversión manual de 20261017000100_precio_usd_y_cotizacion.sql (con autorización).
-- Vuelve a activar el precio anterior (USD 7,99/mes) y borra las cotizaciones guardadas.
begin;
update public.product_prices set active = false
 where id in ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000112');
update public.product_prices set active = true where id = '00000000-0000-4000-8000-000000000101' and amount_minor = 799;
drop table if exists public.fx_rates;
commit;
