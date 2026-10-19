@echo off
echo ============================================================
echo Reparation automatique de la connexion DNS (Google 8.8.8.8)
echo ============================================================
echo.

netsh interface ip set dns name="Wi-Fi" static 8.8.8.8
netsh interface ip add dns name="Wi-Fi" 1.1.1.1 index=2

netsh interface ip set dns name="Wi-Fi 3" static 8.8.8.8
netsh interface ip add dns name="Wi-Fi 3" 1.1.1.1 index=2

netsh interface ip set dns name="Ethernet" static 8.8.8.8
netsh interface ip add dns name="Ethernet" 1.1.1.1 index=2

ipconfig /flushdns

echo.
echo ============================================================
echo Succes ! Les DNS ont ete configures sur 8.8.8.8 et 1.1.1.1.
echo Le cache DNS a ete vide. Vous pouvez fermer cette fenetre.
echo ============================================================
pause
