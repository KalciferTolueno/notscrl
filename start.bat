@echo off
title BRB Studio Web
echo ======================================================
echo    BRB - Be Right Back. Carousel studio
echo ======================================================
echo.
echo Iniciando servidor local en http://localhost:3000 ...
set GIPHY_API_KEY=9QGk7vqJE7zLYTnbM9nIH6FKnpvJliGt
start http://localhost:3000
node server.js
pause
