@echo off
cd /d "%~dp0"
echo Deploying to Netlify...
call npx netlify deploy --prod --dir dist --no-build
echo.
echo Deploy complete!
pause
