-- Runnie pasa a ser gratis para todas las personas con cuenta (responde la propia app, sin costo):
-- deja de figurar entre los beneficios de la suscripción mensual y pasa a la lista del plan gratis.
-- Solo textos del producto.
-- El cupo diario (runnie_usage y sus funciones) queda sin uso; no se borra nada.
update public.subscription_products
set features = array_remove(features, 'Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app')
where code = 'premium_monthly';

update public.subscription_products
set features = array_append(features, 'Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app')
where code = 'free'
  and not ('Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app' = any (features));
