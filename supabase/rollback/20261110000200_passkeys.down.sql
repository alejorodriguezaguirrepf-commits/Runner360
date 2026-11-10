-- Reversión manual de 20261110000200_passkeys.sql (con autorización): borra las llaves de acceso
-- registradas (las personas vuelven a ingresar con contraseña).
begin;
drop table if exists public.passkey_challenges;
drop table if exists public.passkeys;
commit;
