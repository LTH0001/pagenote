@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0register-project-files.ps1"
if errorlevel 1 pause
