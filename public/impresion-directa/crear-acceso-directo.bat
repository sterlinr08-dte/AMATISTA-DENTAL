@echo off
chcp 65001 >nul
title DeluXe Beauty Center - Impresion directa
echo.
echo  ============================================================
echo    DELUXE BEAUTY CENTER  -  Impresion directa (sin cuadros)
echo  ============================================================
echo.

set "URL=https://sterlinr08-dte.github.io/DELUXE-BEAUTY-CENTER-/"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
  echo   No se encontro Google Chrome.
  echo   Instala Chrome y vuelve a abrir este archivo.
  echo.
  pause
  exit /b
)

set "ARGS=--app=%URL% --kiosk-printing --user-data-dir=%LocalAppData%\DeluxeCaja"

powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut($d+'\DeluXe Caja.lnk'); $s.TargetPath='%CHROME%'; $s.Arguments='%ARGS%'; $s.IconLocation='%CHROME%,0'; $s.Save()"

echo   LISTO: se creo el icono  "DeluXe Caja"  en el Escritorio.
echo.
echo   FALTAN 2 PASOS (una sola vez):
echo     1) Pon la impresora 2 Connect como PREDETERMINADA en Windows.
echo        (Configuracion ^> Bluetooth y dispositivos ^> Impresoras)
echo     2) Abre la app SIEMPRE con el icono  "DeluXe Caja"  del Escritorio.
echo.
echo   Desde ahi, al imprimir un recibo SALE SOLO, sin ningun cuadro.
echo.
pause
