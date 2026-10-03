@echo off
node "%~dp0..\scripts\control.mjs" stop
if errorlevel 1 pause
