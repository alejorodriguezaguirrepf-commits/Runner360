-- Plan gratis: la descripción y la lista de la portada dicen qué incluye (todos los planes, con la
-- primera semana liberada) y que para seguir entrenando hay que suscribirse. Solo textos del producto.
update public.subscription_products
set description = 'Elegí cualquier plan y entrená gratis la primera semana.',
    features = array[
      'Acceso a todos los planes: 5K, 10K, 21K y 42K',
      'La primera semana del plan que elijas, día por día',
      'Registro de entrenamientos y perfil del corredor',
      'Para seguir entrenando después, te suscribís'
    ]
where code = 'free';
