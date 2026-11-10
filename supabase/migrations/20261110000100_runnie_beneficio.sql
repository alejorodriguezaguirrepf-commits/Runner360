-- Runnie en la lista de beneficios de la suscripción mensual (la portada y Suscripción la muestran).
-- El plan anual ya dice "Todo lo incluido en Premium mensual". Solo textos del producto; no se repite.
update public.subscription_products
set features = array_append(features, 'Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app')
where code = 'premium_monthly'
  and not ('Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app' = any (features));
