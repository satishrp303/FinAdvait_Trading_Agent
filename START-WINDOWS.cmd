@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules call npm ci
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
call npm run db:local
if errorlevel 1 goto failed
echo Open the Local URL printed below in your browser.
call npm start
exit /b %ERRORLEVEL%
:failed
echo Setup failed. Read the message above, then retry.
pause
exit /b 1
