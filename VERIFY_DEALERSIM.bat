@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing DealerSim dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

call npm run verify:engine
if errorlevel 1 (
  pause
  exit /b 1
)

call npm run calibrate
if errorlevel 1 (
  pause
  exit /b 1
)

call npm run test
if errorlevel 1 (
  pause
  exit /b 1
)

call npm run build
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo DealerSim engine, calibration lab, tests and production build passed.
pause
