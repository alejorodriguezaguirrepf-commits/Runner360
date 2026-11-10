-- Reversión manual de 20261110000100_runnie_beneficio.sql: saca a Runnie de la lista de beneficios.
update public.subscription_products
set features = array_remove(features, 'Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app')
where code = 'premium_monthly';
