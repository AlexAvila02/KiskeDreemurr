@echo off
REM Sube a GitHub una sola vez todos los cambios de la carpeta.
cd /d "%~dp0"
git add -A
git diff --cached --quiet
if errorlevel 1 git commit -q -m "Actualizacion %date% %time:~0,5%"
git pull -q --rebase -X theirs origin main
git push origin main gh-pages
if errorlevel 1 (
  echo.
  echo No se pudo subir. Revisa tu conexion o tu sesion de GitHub.
) else (
  echo.
  echo Listo: GitHub esta actualizado.
)
pause
