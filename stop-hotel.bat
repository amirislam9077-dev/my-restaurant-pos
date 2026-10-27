@echo off
rem ============================================================
rem  My Restaurant - sab band karta hai (website + admin, API, database)
rem ============================================================
title My Restaurant - Stop
echo.
echo  === My Restaurant band ho raha hai ===

call :kill_port 5173 "Website + Admin"
call :kill_port 5001 "API server"

rem Database ko sahi tareeqe se band karein (data safe rahe)
netstat -ano | findstr /r /c:":3307 .*LISTENING" >nul
if errorlevel 1 goto done
echo  Database band ho raha hai...
"C:\xampp\mysql\bin\mysqladmin.exe" -h127.0.0.1 -P3307 -uroot shutdown
rem Database apni files band karne mein kuch second leta hai - poora band hone tak rukein
for /l %%i in (1,1,20) do (
  wmic process where "name='mysqld.exe' and commandline like '%%port=3307%%'" get processid 2>nul | findstr /r "[0-9]" >nul || goto done
  timeout /t 1 >nul
)

:done
echo.
echo  Sab band ho gaya.
timeout /t 3 >nul
exit /b 0

:kill_port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%1 .*LISTENING"') do (
  echo  %~2 band ho raha hai...
  taskkill /pid %%p /t /f >nul 2>&1
)
exit /b 0
