@echo off

powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0Restore-Customization.ps1" -InstallRoot "%~dp0."

