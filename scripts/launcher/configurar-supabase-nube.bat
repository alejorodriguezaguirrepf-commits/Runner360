@echo off
REM Doble clic para conectar RUNNER 360 con tu proyecto de Supabase en la nube.
REM Al terminar crea el icono "RUNNER 360" en el Escritorio y abre la aplicacion.
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
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Creando el icono RUNNER 360 en el Escritorio...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0crear-acceso-directo-windows.ps1"
echo.
echo Abriendo RUNNER 360 en una ventana nueva (la primera vez tarda unos minutos)...
start "RUNNER 360" "%~dp0iniciar-windows.bat"
echo Ya podes cerrar esta ventana.
pause
