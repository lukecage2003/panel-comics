@echo off
rem Lance Panel avec tous ses outils (scanners, Comic Vine, GCD, Metron, couvertures, mode hors ligne).
rem Ouvrir index.html directement comme fichier bloque la camera et les relais : passez par ce lanceur.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez-le depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
start "" "http://localhost:8080"
echo Panel tourne sur http://localhost:8080 - laissez cette fenetre ouverte (Ctrl+C pour arreter).
node serve.js
pause
