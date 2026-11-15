@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0Set-OfficialStartup.ps1" -InstallRoot "%~dp0." -State Off
if errorlevel 1 pause
