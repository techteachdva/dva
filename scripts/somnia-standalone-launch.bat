@echo off
title Somnia Local Server
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0\somnia-server.ps1"
