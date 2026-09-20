@echo off
setlocal
title ASCII Walk
cd /d "%~dp0"
set "ASCII_NODE=node.exe"
where node.exe >nul 2>nul
if not errorlevel 1 goto run
set "ASCII_NODE=%ProgramFiles%\nodejs\node.exe"
if exist "%ASCII_NODE%" goto run
set "ASCII_NODE=%LOCALAPPDATA%\hermes\node\node.exe"
if exist "%ASCII_NODE%" goto run
echo ASCII Walk needs Node.js 22.12 or newer installed on this computer.
echo Install it from https://nodejs.org and then double-click this launcher again.
pause
exit /b 1
:run
"%ASCII_NODE%" "%~dp0tools\launch.mjs" %*
if errorlevel 1 pause
