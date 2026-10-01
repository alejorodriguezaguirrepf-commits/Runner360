-- Contenido educativo inicial (borrador editorial). Orientativo, no reemplaza consulta profesional.
begin;
insert into public.educational_contents (id, slug, title, category, summary, body, access_tier, status, published_at) values
('00000000-0000-4000-8000-000000000201', 'hidratacion-conceptos-basicos', 'Hidratación: conceptos básicos para corredores', 'hydration',
 'Por qué no existe una cantidad universal de agua y qué factores influyen en tus necesidades.',
 E'Las necesidades de líquido varían mucho entre personas. Influyen el clima (calor y humedad), la duración e intensidad del entrenamiento, el tamaño corporal, la tasa de sudoración y la aclimatación.\n\nPor eso RUNNER 360 no indica una cantidad fija de agua para todos. La app te permite registrar lo que tomás para que puedas observar tus hábitos, pero no mide tu estado de hidratación.\n\nAlgunas pautas generales:\n- Planificá cómo vas a hidratarte en sesiones largas o con calor.\n- Beber en exceso también puede ser riesgoso: no fuerces la ingesta por encima de la sed sin indicación profesional.\n- Ante mareos, confusión, náuseas, calambres intensos o malestar, detené la actividad y buscá asistencia.\n\nSi tenés una condición de salud (por ejemplo renal o cardíaca) o tomás medicación, consultá con tu médico cómo hidratarte al entrenar.',
 'free', 'published', now()),
('00000000-0000-4000-8000-000000000202', 'entrenar-con-calor', 'Entrenar con calor: precauciones', 'hydration',
 'Señales de alerta y ajustes razonables cuando la temperatura sube.',
 E'Con calor, el mismo ritmo exige más esfuerzo. Es razonable bajar la intensidad, elegir horarios más frescos y llevar bebida en sesiones prolongadas.\n\nSeñales para detenerte y pedir ayuda: dolor de cabeza intenso, mareos, confusión, piel muy caliente y seca, náuseas o vómitos.\n\nEste contenido es educativo y no reemplaza la indicación de un profesional de la salud.',
 'free', 'published', now()),
('00000000-0000-4000-8000-000000000203', 'que-es-el-rpe', '¿Qué es el RPE (esfuerzo percibido)?', 'training',
 'Una escala de 1 a 10 para registrar qué tan duro se sintió un entrenamiento.',
 E'El RPE (Rating of Perceived Exertion) es una escala subjetiva del esfuerzo. En RUNNER 360 usamos una escala de 1 a 10:\n\n- 1-2: muy suave, podés conversar sin problema.\n- 3-4: suave, conversación cómoda.\n- 5-6: moderado, frases cortas.\n- 7-8: exigente, pocas palabras.\n- 9-10: máximo o casi máximo.\n\nRegistrar el RPE ayuda a comparar lo planificado con lo que realmente sentiste.',
 'free', 'published', now())
on conflict (id) do nothing;
commit;
