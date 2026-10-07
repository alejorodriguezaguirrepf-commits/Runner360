# Crea el acceso directo "RUNNER 360" en el Escritorio de Windows (y en el menu Inicio).
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$target = Join-Path $root "scripts\launcher\iniciar-windows.bat"
$icon = Join-Path $root "scripts\launcher\icons\runner360.ico"
$shell = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath("Desktop"), (Join-Path ([Environment]::GetFolderPath("Programs")) ""))
foreach ($dir in $places) {
  $lnk = $shell.CreateShortcut((Join-Path $dir "RUNNER 360.lnk"))
  $lnk.TargetPath = $target
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = "Iniciar RUNNER 360 (Entrena. Medi. Progresa.)"
  $lnk.Save()
}
Write-Host ""
Write-Host "Listo: acceso directo 'RUNNER 360' creado en el Escritorio y en el menu Inicio." -ForegroundColor Green
