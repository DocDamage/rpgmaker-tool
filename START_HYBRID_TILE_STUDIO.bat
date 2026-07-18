@echo off
setlocal
cd /d "%~dp0"
if exist "node_modules\electron\dist\electron.exe" (
  call npm start
) else (
  start "Hybrid Tile Studio" "HybridTileStudio.html"
)
endlocal
