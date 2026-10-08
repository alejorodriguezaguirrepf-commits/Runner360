@echo off
REM RUNNER 360 - inicio local en Windows. Doble clic para abrir la app.
chcp 65001 >nul
title RUNNER 360
cd /d "%~dp0..\.."
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js. Instalalo desde https://nodejs.org ^(version LTS^) y volve a intentar.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)
node scripts\launcher\runner360.mjs %*
if errorlevel 1 pause
