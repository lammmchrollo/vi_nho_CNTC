@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.15 or newer, then run this file again.
  pause
  exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number); if(v[0]<22 || (v[0]===22 && v[1]<15)) process.exit(1)"
if errorlevel 1 (
  echo Node.js 22.15 or newer is required.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:3000 in your browser.
echo Keep this window open while using Vi Nho. Press Ctrl+C to stop.
node server.js
pause
