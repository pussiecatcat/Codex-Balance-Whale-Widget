@echo off
node "%~dp0..\scripts\control.mjs" open
if errorlevel 1 pause
