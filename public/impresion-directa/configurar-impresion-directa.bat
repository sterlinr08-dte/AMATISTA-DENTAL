@echo off
:: DeluXe Beauty Center - Configura la impresion directa de QZ Tray.
:: Deja el certificado de confianza en QZ Tray para que imprima SIN cuadros.
:: Pide permiso de administrador automaticamente.

net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)
chcp 65001 >nul
title DeluXe - Configurar impresion directa

set "QZ=%ProgramFiles%\QZ Tray"
if not exist "%QZ%\" set "QZ=%ProgramFiles(x86)%\QZ Tray"
if not exist "%QZ%\" (
  echo.
  echo   No se encontro QZ Tray instalado.
  echo   1^) Instala QZ Tray primero (boton "Descargar QZ Tray" en la app).
  echo   2^) Vuelve a abrir este archivo.
  echo.
  pause
  exit /b
)

echo.
echo   Configurando el certificado de confianza...

:: 1) Dejar el certificado publico en la carpeta de QZ Tray
(
echo -----BEGIN CERTIFICATE-----
echo MIIDdzCCAl+gAwIBAgIUIf1mqNgmWVkOc5YBQ6kfUh8gz7EwDQYJKoZIhvcNAQEL
echo BQAwSzEdMBsGA1UEAwwURGVsdVhlIEJlYXV0eSBDZW50ZXIxHTAbBgNVBAoMFERl
echo bHVYZSBCZWF1dHkgQ2VudGVyMQswCQYDVQQGEwJETzAeFw0yNjA2MzAxNzQ4Mjla
echo Fw0zNjA2MjcxNzQ4MjlaMEsxHTAbBgNVBAMMFERlbHVYZSBCZWF1dHkgQ2VudGVy
echo MR0wGwYDVQQKDBREZWx1WGUgQmVhdXR5IENlbnRlcjELMAkGA1UEBhMCRE8wggEi
echo MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDnbh82U+snsezPcDCiuSqB+kkb
echo 3Rp9J13sotCIuhRuaStFE1CSMoOupmRky0sKi7H7YBjzyuXEqHWJn3VQ6OIiXdvm
echo RJGaE62rvBGUgZBNTBBZ1JkWlMkDYSuul4Ex/8dMSqT/fBqKkeVSkSNFceSgeRMk
echo J56Wb46AbaFg6yFQo1t465eHTIFp2v78Yr92GGXw3+693dAh+/10qxW/MfxMHmIs
echo 6gui0OonYQ6HFZmtKxRmS8Yq7GaASn/48B1VO14aoSJ5arc25b5z1NBbraQzzGph
echo JOd79xDyH3VIXBWVwabkbKXWgA6LaBfegU7xWfHg6pSrmujD1dxVMWm6/McVAgMB
echo AAGjUzBRMB0GA1UdDgQWBBSkYqQf5xLX80o2WipQLsjNugugjzAfBgNVHSMEGDAW
echo gBSkYqQf5xLX80o2WipQLsjNugugjzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
echo DQEBCwUAA4IBAQArzUAKxEclTJMQ+D+6icP3eJKyhf3Lg5ga9F9pxn1quc08VsUq
echo ezJlMknuGPV5QMVFQhFJviKksPONFhPOPGuUhvB0ua22Wl9nDO4Gb1rjT6yI7n23
echo 63AhePbyF72gmJdIT3qaEfgp4JCSJ1hJHK0gTAJnAJsP51QBW1sVok2DWAckiFqO
echo q1ZwQ9GLYorM2JUunuXO3N/iZpQsJYNrR6KUehbtvgDYILwWDJ8N3g6k0TfyeXb0
echo 1Ky19575l+jgDwvWw1uYWQM4DLXNfsbqQj+ViILP2omDGUpvbLhxGnLa5dvHnAbo
echo ZlQYVgQ8BNs840nw5SVbOG7eo1bId9i/2FJ0
echo -----END CERTIFICATE-----
) > "%QZ%\override.crt"
echo   Certificado puesto en: "%QZ%\override.crt"

:: 2) Registrar el certificado en la configuracion de QZ Tray (authcert.override).
::    Esto es lo que hace que QZ confie y NO muestre el cuadro.
set "CRT=%QZ%\override.crt"
powershell -NoProfile -Command ^
  "$prop = Join-Path $env:ProgramFiles 'QZ Tray\qz-tray.properties';" ^
  "if (-not (Test-Path $prop)) { $prop = Join-Path ${env:ProgramFiles(x86)} 'QZ Tray\qz-tray.properties' }" ^
  "$crt = '%CRT%' -replace '\\','/';" ^
  "$lines = @(); if (Test-Path $prop) { $lines = Get-Content $prop | Where-Object { $_ -notmatch '^\s*authcert\.override' } }" ^
  "$lines += 'authcert.override=' + $crt;" ^
  "Set-Content -Path $prop -Value $lines -Encoding ASCII;" ^
  "Write-Host ('   Configuracion actualizada: ' + $prop)"

echo   Reiniciando QZ Tray...
taskkill /im "QZ Tray.exe" /f >nul 2>&1
timeout /t 2 >nul
start "" "%QZ%\QZ Tray.exe"

echo.
echo   ============================================
echo     LISTO. Impresion directa configurada.
echo   ============================================
echo.
echo   Vuelve a la app: Configuracion ^> Impresora ^>
echo   "Probar impresion directa".
echo   (Si quedaba un cuadro abierto, cierralo antes.)
echo.
pause
