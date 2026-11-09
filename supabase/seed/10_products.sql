-- Catálogo inicial de productos y precios (configuración, no datos de usuarios).
-- Los precios se administran desde /admin/productos; estos valores son solo el punto de partida.
-- Precio de lista: USD 20/mes y USD 180/año. Mercado Pago Argentina cobra el equivalente en pesos
-- (cotización en public.fx_rates).
begin;

insert into public.subscription_products (id, code, name, description, tier, billing_interval, features, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', 'free', 'Free', 'Elegí cualquier plan y entrená gratis la primera semana.', 'free', null,
   array['Acceso a todos los planes: 5K, 10K, 21K y 42K', 'La primera semana del plan que elijas, día por día', 'Registro de entrenamientos y perfil del corredor', 'Para seguir entrenando después, te suscribís'], 0),
  ('00000000-0000-4000-8000-000000000002', 'premium_monthly', 'Premium mensual', 'Acceso completo con facturación mensual.', 'premium', 'month',
   array['Planes publicados incluidos en la suscripción', 'Calendario de entrenamiento', 'Historial y estadísticas avanzadas', 'Hidratación y competencias'], 1),
  ('00000000-0000-4000-8000-000000000003', 'premium_yearly', 'Premium anual', 'Acceso completo con facturación anual.', 'premium', 'year',
   array['Todo lo incluido en Premium mensual', 'Un único pago anual'], 2)
on conflict (id) do nothing;

insert into public.product_prices (id, product_id, currency, amount_minor, provider, active)
values ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000002', 'USD', 2000, null, true),
       ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000003', 'USD', 18000, null, true)
on conflict (id) do nothing;

commit;
