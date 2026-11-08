@echo off
REM ============================================================
REM  Auto-subida a GitHub - Ruben: En Busca de Angelo
REM  Dejalo abierto mientras trabajas: cada 60 segundos guarda
REM  los cambios de la carpeta y los sube a GitHub.
REM  Para detenerlo, cerra esta ventana (o Ctrl+C).
REM ============================================================
cd /d "%~dp0"
title Auto-subida a GitHub (Ruben)

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Git. Instalalo desde https://git-scm.com y volve a abrir este archivo.
  pause
  exit /b 1
)

echo Auto-subida activa. Repositorio:
git remote get-url origin
echo.

:loop
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -q -m "auto: guardado %date% %time:~0,5%"
  echo [%time:~0,8%] Cambios guardados.
)

REM Traer lo que haya en GitHub; si hay conflicto, gana lo que esta en esta carpeta
git pull -q --rebase -X theirs origin main
if errorlevel 1 (
  echo [%time:~0,8%] Aviso: no se pudo combinar con GitHub, se reintenta en 60 s.
  git rebase --abort >nul 2>nul
) else (
  git push -q origin main gh-pages
  if errorlevel 1 (
    echo [%time:~0,8%] Aviso: no se pudo subir ^(sin internet o sin permiso^). Se reintenta en 60 s.
  ) else (
    for /f %%h in ('git rev-parse --short HEAD') do echo [%time:~0,8%] GitHub al dia ^(%%h^).
  )
)

timeout /t 60 /nobreak >nul
goto loop
