@echo off
REM Doble clic para conectar RUNNER 360 con tu proyecto de Supabase en la nube.
chcp 65001 >nul
title RUNNER 360 - Configurar Supabase
cd /d "%~dp0..\.."
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y volve a intentar.
  pause
  exit /b 1
)
node scripts\launcher\configurar-nube.mjs
pause
