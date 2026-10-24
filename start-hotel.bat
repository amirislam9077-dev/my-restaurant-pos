@echo off
rem ============================================================
rem  My Restaurant - sab kuch ek click mein start karta hai
rem   1. Database   (XAMPP MariaDB, port 3307)
rem   2. API server (port 5000)
rem   3. Admin + customer pages (port 5173, WiFi pe bhi; admin = home page)
rem  Jo cheez pehle se chal rahi ho usay dobara start nahi karta.
rem ============================================================
title My Restaurant - Start
cd /d "%~dp0"

echo.
echo  === My Restaurant start ho raha hai ===
echo.

call :is_running 3307
if errorlevel 1 (
  echo  [1/3] Database start ho raha hai...
  call :start_db
  call :wait_for 3307
  if errorlevel 1 (
    rem Pichla database abhi band ho raha ho to pehli koshish fail hoti hai - ek baar aur
    echo        Database dobara start kar rahe hain...
    timeout /t 5 >nul
    call :start_db
    call :wait_for 3307 || echo     ! Database start nahi hua - "Hotel Database" window check karein
  )
) else (
  echo  [1/3] Database pehle se chal raha hai
)

call :is_running 5000
if errorlevel 1 (
  echo  [2/3] API server start ho raha hai...
  start "Hotel API" /min cmd /c "cd /d "%~dp0server" && node index.js"
  call :wait_for 5000 || echo     ! API server start nahi hua - "Hotel API" window check karein
) else (
  echo  [2/3] API server pehle se chal raha hai
)

call :is_running 5173
if errorlevel 1 (
  echo  [3/3] Website + Admin start ho rahe hain...
  start "Hotel Website" /min cmd /c "cd /d "%~dp0client" && npx vite"
  call :wait_for 5173 || echo     ! Website start nahi hui - "Hotel Website" window check karein
) else (
  echo  [3/3] Website + Admin pehle se chal rahe hain
)

echo.
echo  Sab tayyar hai!
echo    Admin panel   : http://localhost:5173
echo    Online order  : http://localhost:5173/online
echo.
start "" "http://localhost:5173/"
timeout /t 5 >nul
exit /b 0

rem ---- helpers ----
:start_db
start "Hotel Database" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --port=3307 --standalone
exit /b 0

:is_running
rem errorlevel 0 = port pe koi sun raha hai
netstat -ano | findstr /r /c:":%1 .*LISTENING" >nul
exit /b %errorlevel%

:wait_for
rem port khulne ka 30 second tak intezar (errorlevel 1 = nahi khula)
for /l %%i in (1,1,30) do (
  netstat -ano | findstr /r /c:":%1 .*LISTENING" >nul && exit /b 0
  timeout /t 1 >nul
)
exit /b 1
