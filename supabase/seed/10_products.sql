-- Catálogo inicial de productos y precios (configuración, no datos de usuarios).
-- Los precios se administran desde /admin/productos; estos valores son solo el punto de partida.
-- Precio de referencia inicial: USD 7,99/mes. El precio anual y en ARS quedan pendientes de definición
-- (sin precio activo, la interfaz muestra "a definir").
begin;

insert into public.subscription_products (id, code, name, description, tier, billing_interval, features, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', 'free', 'Free', 'Para empezar a entrenar y registrar tu actividad.', 'free', null,
   array['Perfil del corredor', 'Registro básico de entrenamientos', 'Contenido introductorio', 'Plan gratuito o de demostración'], 0),
  ('00000000-0000-4000-8000-000000000002', 'premium_monthly', 'Premium mensual', 'Acceso completo con facturación mensual.', 'premium', 'month',
   array['Planes publicados incluidos en la suscripción', 'Calendario de entrenamiento', 'Historial y estadísticas avanzadas', 'Hidratación y competencias'], 1),
  ('00000000-0000-4000-8000-000000000003', 'premium_yearly', 'Premium anual', 'Acceso completo con facturación anual.', 'premium', 'year',
   array['Todo lo incluido en Premium mensual', 'Un único pago anual'], 2)
on conflict (id) do nothing;

insert into public.product_prices (id, product_id, currency, amount_minor, provider, active)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002', 'USD', 799, null, true)
on conflict (id) do nothing;

commit;
