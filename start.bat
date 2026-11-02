@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Erste Installation, das dauert ein paar Minuten...
  call npm install
)
call npm start
pause
