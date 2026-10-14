@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm.cmd install --no-fund --no-audit
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  call npm.cmd run build
  if errorlevel 1 exit /b 1
)
node launch.mjs
pause
