-- Precios en pesos argentinos (precio final, sin cotización del dólar): Premium mensual $ 25.000 y
-- Premium anual $ 250.000. Los precios anteriores quedan desactivados (no se borran) y el cambio queda
-- en la auditoría de precios. Las suscripciones mensuales que ya existen siguen con el importe con el
-- que se dieron de alta en Mercado Pago.
with wanted(code, amount) as (values ('premium_monthly', 2500000::bigint), ('premium_yearly', 25000000::bigint))
update public.product_prices pr
set active = false
from public.subscription_products p, wanted w
where p.id = pr.product_id and p.code = w.code
  and pr.active and pr.provider is null
  and not (pr.currency = 'ARS' and pr.amount_minor = w.amount);

with wanted(code, amount) as (values ('premium_monthly', 2500000::bigint), ('premium_yearly', 25000000::bigint))
insert into public.product_prices (product_id, currency, amount_minor, provider, active)
select p.id, 'ARS', w.amount, null, true
from wanted w join public.subscription_products p on p.code = w.code
where not exists (
  select 1 from public.product_prices pr
  where pr.product_id = p.id and pr.active and pr.provider is null and pr.currency = 'ARS' and pr.amount_minor = w.amount
);
