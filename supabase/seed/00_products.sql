-- Productos de suscripción iniciales. Los precios se administran desde /admin/productos.
-- Precio de referencia inicial indicado por el negocio: USD 7,99 por mes (Premium).
-- El precio anual y el precio en ARS quedan PENDIENTES de definición comercial (no se inventan).
begin;
insert into public.subscription_products (id, code, name, description, tier, features, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'free', 'Free',
   'Perfil, registro básico de entrenamientos, contenido introductorio y planes de demostración.',
   'free', array['profile', 'basic_log', 'demo_plans'], 1),
  ('00000000-0000-4000-8000-000000000002', 'premium', 'Premium',
   'Planes publicados, calendario, estadísticas avanzadas, hidratación y competencias.',
   'premium', array['profile', 'basic_log', 'demo_plans', 'premium_plans', 'calendar', 'advanced_stats', 'hydration', 'competitions'], 2)
on conflict (id) do nothing;

insert into public.subscription_prices (id, product_id, currency, amount_minor, billing_interval) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002', 'USD', 799, 'month')
on conflict (id) do nothing;
commit;
