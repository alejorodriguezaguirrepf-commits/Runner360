-- Reversión manual de 20261113000200_runnie_gratis.sql: vuelve a mostrar a Runnie entre los beneficios.
update public.subscription_products
set features = array_append(features, 'Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app')
where code = 'premium_monthly'
  and not ('Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app' = any (features));

update public.subscription_products
set features = array_remove(features, 'Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app')
where code = 'free';
