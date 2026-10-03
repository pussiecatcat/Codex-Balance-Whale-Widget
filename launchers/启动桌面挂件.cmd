@echo off
node "%~dp0..\scripts\control.mjs" desktop
if errorlevel 1 pause
