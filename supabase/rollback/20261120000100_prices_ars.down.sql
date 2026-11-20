-- Reversión manual de 20261120000100_prices_ars.sql (con autorización): vuelve a los precios de lista en
-- dólares (US$ 20 por mes y US$ 180 por año) desactivando los de pesos.
update public.product_prices pr set active = false
from public.subscription_products p
where p.id = pr.product_id and p.code in ('premium_monthly', 'premium_yearly') and pr.active and pr.provider is null and pr.currency = 'ARS';
update public.product_prices pr set active = true
from public.subscription_products p
where p.id = pr.product_id and pr.provider is null and pr.currency = 'USD'
  and ((p.code = 'premium_monthly' and pr.amount_minor = 2000) or (p.code = 'premium_yearly' and pr.amount_minor = 18000))
  and pr.created_at = (select max(x.created_at) from public.product_prices x where x.product_id = pr.product_id and x.currency = 'USD' and x.provider is null);
