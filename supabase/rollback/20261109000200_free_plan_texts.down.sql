-- Reversión manual de 20261109000200_free_plan_texts.sql: vuelve a los textos anteriores del plan gratis.
update public.subscription_products
set description = 'Para empezar a entrenar y registrar tu actividad.',
    features = array['Perfil del corredor', 'Registro básico de entrenamientos', 'Contenido introductorio', 'Plan gratuito o de demostración']
where code = 'free';
