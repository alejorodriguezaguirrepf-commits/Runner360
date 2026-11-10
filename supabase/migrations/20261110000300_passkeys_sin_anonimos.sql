-- Llaves de acceso: los visitantes sin cuenta no tienen ningún permiso sobre la tabla (las reglas
-- ya no les mostraban filas; esto es una capa más).
revoke all on public.passkeys from anon;
