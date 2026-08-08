@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed or is not available on PATH.
  echo Install the current Node.js LTS release, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing DealerSim dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Review the npm error above.
    pause
    exit /b 1
  )
)

echo Starting DealerSim...
call npm run dev
